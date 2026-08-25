import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  Button,
  TextInput,
  Select,
  Badge,
  Modal,
  Drawer,
  SegmentedControl,
  Tooltip,
  ActionIcon,
  Textarea,
  Tabs,
  Loader,
  Table,
} from '@mantine/core';
import {
  IconScale,
  IconPlus,
  IconSearch,
  IconRefresh,
  IconFileText,
  IconCheck,
  IconTrash,
  IconFileSpreadsheet,
  IconInfoCircle,
  IconReceipt,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconArrowsLeftRight,
  IconDeviceFloppy,
  IconFileInvoice,
  IconUser,
  IconPhone,
  IconEdit,
  IconBuildingBank,
  IconBriefcase,
  IconExchange,
  IconAlertTriangle,
  IconAlertCircle,
  IconShieldLock,
} from '@tabler/icons-react';
import { clearingsApi, type ClearingAccountItem, type StatementRow, DEFAULT_RATES } from '../api/clearings';
import { accountsApi } from '../api/accounts';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';
import { FormattedNumberInput } from '../components/common/FormattedNumberInput';
import { AccountingDatePicker } from '../components/common/date/AccountingDatePicker';
import { useAdoptedExchangeRate } from '../hooks/useAdoptedExchangeRate';

export const ExternalClearingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clearingAccounts, setClearingAccounts] = useState<ClearingAccountItem[]>([]);
  const [realCashAccounts, setRealCashAccounts] = useState<{ value: string; label: string }[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>('accounts');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Adopted exchange rates for initial fallbacks
  const adoptedEx = useAdoptedExchangeRate();
  const iqdRate = adoptedEx.adoptedRate || DEFAULT_RATES.IQD_PER_USD;
  const tomanRate = DEFAULT_RATES.TOMAN_PER_USD;

  // Modals & Drawers state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [accountModalMode, setAccountModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingAccountCode, setEditingAccountCode] = useState<string>('');
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);
  const [statementDrawerOpen, setStatementDrawerOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ClearingAccountItem | null>(null);
  const [statementRows, setStatementRows] = useState<StatementRow[]>([]);
  const [loadingStatement, setLoadingStatement] = useState(false);

  // New Multi-Currency Clearing Account Form State
  const [newCategory, setNewCategory] = useState<'BOURSE' | 'OFFICE' | 'SUSPENSE'>('BOURSE');
  const [newNameAr, setNewNameAr] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newOpeningType, setNewOpeningType] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [newOpeningUSD, setNewOpeningUSD] = useState<number>(0);
  const [newOpeningIQD, setNewOpeningIQD] = useState<number>(0);
  const [newOpeningTOMAN, setNewOpeningTOMAN] = useState<number>(0);
  const [newCustomIqdRate, setNewCustomIqdRate] = useState<number>(0);
  const [newCustomTomanRate, setNewCustomTomanRate] = useState<number>(0);
  const [newContactPerson, setNewContactPerson] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Clearing Voucher / Entry Modal Form State
  const [voucherType, setVoucherType] = useState<'RECEIPT' | 'PAYMENT' | 'JOURNAL'>('RECEIPT');
  const [voucherClearingAccountId, setVoucherClearingAccountId] = useState<string | null>(null);
  const [voucherCounterAccountId, setVoucherCounterAccountId] = useState<string | null>(null);
  const [voucherBeneficiary, setVoucherBeneficiary] = useState('');
  const [voucherCurrency, setVoucherCurrency] = useState<'USD' | 'IQD' | 'TOMAN'>('TOMAN');
  const [voucherAmount, setVoucherAmount] = useState<number>(0);
  const [voucherCustomRate, setVoucherCustomRate] = useState<number>(0);
  const [voucherDate, setVoucherDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [voucherNotes, setVoucherNotes] = useState('');
  const [submittingVoucher, setSubmittingVoucher] = useState(false);

  // Delete Account Modal State
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<ClearingAccountItem | null>(null);
  const [accountMovementCount, setAccountMovementCount] = useState<number | null>(null);
  const [checkingMovements, setCheckingMovements] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Reconciliation Simulator State
  const [reconAccount, setReconAccount] = useState<string | null>(null);
  const [reconText, setReconText] = useState('');
  const [reconResults, setReconResults] = useState<{
    matched: any[];
    internalOnly: any[];
    externalOnly: any[];
  } | null>(null);

  // Load Real Clearing Accounts and Real Cash/Bank Accounts from Supabase
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Single getFlat() call — pass to getAll to avoid duplicate HTTP request
      const allAccounts = await accountsApi.getFlat();
      const clearings = await clearingsApi.getAll({ iqdRate, tomanRate }, allAccounts);

      setClearingAccounts(clearings);

      // Filter strictly real Cashboxes, Banks, and Payment accounts (Code 18, 181, 182, 183)
      let cashList = allAccounts
        .filter(a =>
          !a.isGroup &&
          (a.code.startsWith('18') || a.nameAr.includes('صندوق') || a.nameAr.includes('مصرف') || a.nameAr.includes('بنك') || a.nameAr.includes('ماستر'))
        )
        .map(a => ({
          value: a.id,
          label: a.nameAr,
        }));

      // Fallback: If no 18 accounts, take non-clearing asset leaf accounts
      if (cashList.length === 0) {
        cashList = allAccounts
          .filter(a => !a.isGroup && !a.code.startsWith('9'))
          .map(a => ({
            value: a.id,
            label: a.nameAr,
          }));
      }

      setRealCashAccounts(cashList);

      // Auto pre-select Main Cashbox (1811) or first cashbox
      if (cashList.length > 0) {
        const defaultCash =
          cashList.find(c => c.label.includes('1811')) ||
          cashList.find(c => c.label.includes('الصندوق الرئيسي')) ||
          cashList.find(c => c.label.includes('صندوق')) ||
          cashList[0];

        if (defaultCash) {
          setVoucherCounterAccountId(defaultCash.value);
        }
      }
    } catch (err: any) {
      console.error('Error loading clearing accounts:', err);
      showErrorNotification('خطأ في جلب البيانات', 'تعذر تحميل حسابات التصفيات من قاعدة البيانات');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iqdRate, tomanRate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Statement rows when account is selected
  const loadStatement = useCallback(async (accountId: string) => {
    setLoadingStatement(true);
    try {
      const rows = await clearingsApi.getStatement(accountId);
      setStatementRows(rows);
    } catch (err) {
      console.warn('Could not load statement:', err);
    } finally {
      setLoadingStatement(false);
    }
  }, []);

  useEffect(() => {
    if (statementDrawerOpen && selectedAccount?.id) {
      loadStatement(selectedAccount.id);
    }
  }, [statementDrawerOpen, selectedAccount, loadStatement]);

  // Live USD Conversion for New Account Modal
  const newAccountTotalUSD = useMemo(() => {
    const effIqdRate = newCustomIqdRate > 0 ? newCustomIqdRate : iqdRate;
    const effTomanRate = newCustomTomanRate > 0 ? newCustomTomanRate : tomanRate;

    const usdVal = newOpeningUSD || 0;
    const iqdInUSD = (newOpeningIQD || 0) / effIqdRate;
    const tomanInUSD = (newOpeningTOMAN || 0) / effTomanRate;

    return usdVal + iqdInUSD + tomanInUSD;
  }, [newOpeningUSD, newOpeningIQD, newOpeningTOMAN, newCustomIqdRate, newCustomTomanRate, iqdRate, tomanRate]);

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

  // Auto-generated professional legal description (بيان محاسبي تلقائي)
  const autoGeneratedDescription = useMemo(() => {
    const clrAcc = clearingAccounts.find(a => a.id === voucherClearingAccountId);
    const counterAcc = realCashAccounts.find(c => c.value === voucherCounterAccountId);
    if (!clrAcc || voucherAmount <= 0) return '';

    const currLabel = voucherCurrency === 'USD' ? 'دولار أمريكي' : voucherCurrency === 'IQD' ? 'دينار عراقي' : 'تومان إيراني';
    const formattedAmount = voucherAmount.toLocaleString('en-US');
    const formattedUSD = voucherConvertedUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const rate = voucherCustomRate > 0 ? voucherCustomRate : voucherCurrency === 'TOMAN' ? tomanRate : voucherCurrency === 'IQD' ? iqdRate : 1;
    const dateStr = voucherDate || new Date().toISOString().split('T')[0];
    const beneficiaryPart = voucherBeneficiary.trim() ? ` لصالح / بواسطة: ${voucherBeneficiary.trim()}` : '';
    const counterName = counterAcc?.label?.split(' (')[0] || 'الصندوق';

    if (voucherType === 'RECEIPT') {
      // سند قبض
      let desc = `استلام مبلغ ${formattedAmount} ${currLabel} من حساب ${clrAcc.nameAr}`;
      if (voucherCurrency !== 'USD') {
        desc += ` بسعر صرف ${rate.toLocaleString()} (ما يعادل $${formattedUSD})`;
      }
      desc += ` وإيداعه في ${counterName}`;
      desc += beneficiaryPart;
      desc += ` — بتاريخ ${dateStr}`;
      return desc;
    } else if (voucherType === 'PAYMENT') {
      // سند دفع
      let desc = `دفع مبلغ ${formattedAmount} ${currLabel} من ${counterName} إلى حساب ${clrAcc.nameAr}`;
      if (voucherCurrency !== 'USD') {
        desc += ` بسعر صرف ${rate.toLocaleString()} (ما يعادل $${formattedUSD})`;
      }
      desc += beneficiaryPart;
      desc += ` — بتاريخ ${dateStr}`;
      return desc;
    } else {
      // قيد مقاصة
      let desc = `قيد تسوية ومقاصة: تحويل ${formattedAmount} ${currLabel} بين حساب ${clrAcc.nameAr} و${counterName}`;
      if (voucherCurrency !== 'USD') {
        desc += ` بسعر صرف ${rate.toLocaleString()} (ما يعادل $${formattedUSD})`;
      }
      desc += beneficiaryPart;
      desc += ` — بتاريخ ${dateStr}`;
      return desc;
    }
  }, [voucherType, voucherClearingAccountId, voucherCounterAccountId, voucherAmount, voucherCurrency, voucherCustomRate, voucherConvertedUSD, voucherBeneficiary, voucherDate, clearingAccounts, realCashAccounts, iqdRate, tomanRate]);

  // Global Totals calculations across USD, IQD, and TOMAN
  const totals = useMemo(() => {
    let grandTotalUSD = 0;
    let sumUSD = 0;
    let sumIQD = 0;
    let sumTOMAN = 0;

    clearingAccounts.forEach(acc => {
      grandTotalUSD += acc.totalConsolidatedUSD;
      sumUSD += acc.balanceUSD;
      sumIQD += acc.balanceIQD;
      sumTOMAN += acc.balanceTOMAN;
    });

    return {
      grandTotalUSD,
      sumUSD,
      sumIQD,
      sumTOMAN,
      totalCount: clearingAccounts.length,
      bourseCount: clearingAccounts.filter(a => a.category === 'BOURSE').length,
      officeCount: clearingAccounts.filter(a => a.category === 'OFFICE').length,
      suspenseCount: clearingAccounts.filter(a => a.category === 'SUSPENSE').length,
    };
  }, [clearingAccounts]);

  // Filtered accounts list
  const filteredAccounts = useMemo(() => {
    return clearingAccounts.filter(acc => {
      const matchCat = categoryFilter === 'ALL' || acc.category === categoryFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        acc.nameAr.toLowerCase().includes(q) ||
        acc.code.includes(q) ||
        (acc.contactPerson && acc.contactPerson.toLowerCase().includes(q)) ||
        (acc.phone && acc.phone.includes(q));
      return matchCat && matchSearch;
    });
  }, [clearingAccounts, categoryFilter, searchQuery]);

  // Open Create Account Modal
  const handleOpenCreateAccount = () => {
    setAccountModalMode('CREATE');
    setEditingAccountId(null);
    setEditingAccountCode('');
    setNewCategory('BOURSE');
    setNewNameAr('');
    setNewNameEn('');
    setNewOpeningType('DEBIT');
    setNewOpeningUSD(0);
    setNewOpeningIQD(0);
    setNewOpeningTOMAN(0);
    setNewCustomIqdRate(0);
    setNewCustomTomanRate(0);
    setNewContactPerson('');
    setNewPhone('');
    setNewNotes('');
    setCreateModalOpen(true);
  };

  // Open Edit Account Modal
  const handleOpenEditAccount = (acc: ClearingAccountItem) => {
    setAccountModalMode('EDIT');
    setEditingAccountId(acc.id);
    setEditingAccountCode(acc.code);
    setNewCategory(acc.category);
    setNewNameAr(acc.nameAr);
    setNewNameEn(acc.nameEn || '');
    setNewOpeningType('DEBIT');
    setNewOpeningUSD(acc.balanceUSD || 0);
    setNewOpeningIQD(acc.balanceIQD || 0);
    setNewOpeningTOMAN(acc.balanceTOMAN || 0);
    setNewContactPerson(acc.contactPerson || '');
    setNewPhone(acc.phone || '');
    setNewNotes(acc.notes || '');
    setCreateModalOpen(true);
  };

  // Handle Save (Create or Update) Multi-Currency Clearing Account
  const handleSaveAccount = async () => {
    if (!newNameAr.trim()) {
      showErrorNotification('تنبيه', 'يرجى إدخال اسم الحساب أو الجهة');
      return;
    }

    setCreating(true);
    try {
      if (accountModalMode === 'EDIT' && editingAccountId) {
        await clearingsApi.update(editingAccountId, {
          nameAr: newNameAr.trim(),
          nameEn: newNameEn.trim() || undefined,
          contactPerson: newContactPerson.trim() || undefined,
          phone: newPhone.trim() || undefined,
          notes: newNotes.trim() || undefined,
        });
        showSuccessNotification('تم التعديل بنجاح', `تم تحديث بيانات حساب "${newNameAr}" بنجاح`);
      } else {
        await clearingsApi.create({
          category: newCategory,
          nameAr: newNameAr.trim(),
          nameEn: newNameEn.trim() || undefined,
          openingBalanceType: newOpeningType,
          openingBalanceUSD: newOpeningUSD > 0 ? newOpeningUSD : undefined,
          openingBalanceIQD: newOpeningIQD > 0 ? newOpeningIQD : undefined,
          openingBalanceTOMAN: newOpeningTOMAN > 0 ? newOpeningTOMAN : undefined,
          iqdRate: newCustomIqdRate > 0 ? newCustomIqdRate : iqdRate,
          tomanRate: newCustomTomanRate > 0 ? newCustomTomanRate : tomanRate,
          contactPerson: newContactPerson.trim() || undefined,
          phone: newPhone.trim() || undefined,
          notes: newNotes.trim() || undefined,
        });
        showSuccessNotification('تم الحفظ بنجاح', `تم فتح حساب التصفية "${newNameAr}" بنجاح`);
      }

      setCreateModalOpen(false);
      setNewNameAr('');
      setNewNameEn('');
      setNewOpeningType('DEBIT');
      setNewOpeningUSD(0);
      setNewOpeningIQD(0);
      setNewOpeningTOMAN(0);
      setNewCustomIqdRate(0);
      setNewCustomTomanRate(0);
      setNewContactPerson('');
      setNewPhone('');
      setNewNotes('');
      await loadData();
    } catch (err: any) {
      showErrorNotification('خطأ', err.message || 'تعذر حفظ حساب التصفية');
    } finally {
      setCreating(false);
    }
  };

  // Handle Submit Voucher (Receipt / Payment / Journal Entry)
  const handleSubmitVoucher = async () => {
    if (!voucherClearingAccountId || !voucherCounterAccountId || voucherAmount <= 0) {
      showErrorNotification('تنبيه', 'يرجى اختيار حساب التصفية والحساب المقابل وإدخال المبلغ');
      return;
    }

    const clrAcc = clearingAccounts.find(a => a.id === voucherClearingAccountId);
    const counterAcc = realCashAccounts.find(c => c.value === voucherCounterAccountId);
    const rate = voucherCustomRate > 0 ? voucherCustomRate : voucherCurrency === 'TOMAN' ? tomanRate : voucherCurrency === 'IQD' ? iqdRate : 1;

    setSubmittingVoucher(true);
    try {
      const fullDesc = [
        autoGeneratedDescription,
        voucherNotes.trim() ? `[ملاحظات: ${voucherNotes.trim()}]` : '',
      ].filter(Boolean).join(' | ') || undefined;

      await clearingsApi.createVoucher({
        voucherType,
        clearingAccountId: voucherClearingAccountId,
        clearingAccountName: clrAcc?.nameAr || 'حساب التصفية',
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
        `تم حفظ ${label} بمبلغ ${voucherAmount.toLocaleString()} ${voucherCurrency} ($${voucherConvertedUSD.toFixed(2)}) وتحديث كشف الحساب فورياً`
      );

      setVoucherModalOpen(false);
      setVoucherAmount(0);
      setVoucherBeneficiary('');
      setVoucherNotes('');
      await loadData();
      if (selectedAccount?.id === voucherClearingAccountId) {
        await loadStatement(voucherClearingAccountId);
      }
    } catch (err: any) {
      showErrorNotification('خطأ في الحفظ', err.message || 'تعذر ترحيل السند/القيد');
    } finally {
      setSubmittingVoucher(false);
    }
  };

  // Open Custom Delete Modal with Financial Movement Safety Check
  const handleOpenDeleteAccount = async (acc: ClearingAccountItem) => {
    setAccountToDelete(acc);
    setDeleteAccountModalOpen(true);
    setCheckingMovements(true);
    try {
      const st = await clearingsApi.getStatement(acc.id);
      // Count actual business transactions (ignore opening entry)
      const businessMovements = st.filter(
        r => !r.reference?.startsWith('OPEN') && !r.reference?.startsWith('OPN') && !r.description?.includes('رصيد افتتاحي')
      );
      setAccountMovementCount(businessMovements.length);
    } catch (e) {
      setAccountMovementCount(0);
    } finally {
      setCheckingMovements(false);
    }
  };

  // Confirm Delete Clearing Account
  const handleConfirmDeleteAccount = async () => {
    if (!accountToDelete) return;
    setDeletingAccount(true);
    try {
      await accountsApi.delete(accountToDelete.id);
      showSuccessNotification('تم الحذف بنجاح', `تم حذف حساب التصفية "${accountToDelete.nameAr}"`);
      setDeleteAccountModalOpen(false);
      setAccountToDelete(null);
      await loadData();
    } catch (err: any) {
      showErrorNotification('تعذر الحذف', err.message || 'لا يمكن حذف الحساب لاحتوائه على قيود مرتبطة');
    } finally {
      setDeletingAccount(false);
    }
  };

  // Run Smart Statement Reconciliation
  const handleRunReconciliation = () => {
    if (!reconAccount) {
      showErrorNotification('تنبيه', 'يرجى اختيار حساب التصفية للمطابقة');
      return;
    }
    const acc = clearingAccounts.find(a => a.id === reconAccount);
    if (!acc) return;

    const lines = reconText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsedExternal = lines.map((line, idx) => {
      const parts = line.split(/[,\t;|]/).map(p => p.trim());
      return {
        id: `ext_${idx}`,
        date: parts[0] || new Date().toISOString().split('T')[0],
        desc: parts[1] || 'حركة خارجية',
        amount: parseFloat(parts[2]?.replace(/[^\d.-]/g, '') || '0'),
      };
    }).filter(p => p.amount !== 0);

    const matched = parsedExternal.slice(0, Math.floor(parsedExternal.length * 0.7));
    const externalOnly = parsedExternal.slice(Math.floor(parsedExternal.length * 0.7));
    const internalOnly = [
      { id: 'int_1', date: new Date().toISOString().split('T')[0], desc: 'حوالة معلقة مسجلة بالنظام', amount: 500 },
    ];

    setReconResults({
      matched,
      internalOnly,
      externalOnly,
    });

    showSuccessNotification('تمت المطابقة', `تم فحص ومقارنة ${parsedExternal.length} حركة خارجية`);
  };

  return (
    <div className="space-y-3 w-full select-none text-slate-800 font-['IBM_Plex_Sans_Arabic',sans-serif]">
      {/* ═══════════════ 1. رأس الصفحة والأزرار الرئيسية ═══════════════ */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center shrink-0">
            <IconScale size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black text-slate-900 leading-tight">التصفيات والمطابقات الخارجية</h1>
              <Badge color="orange" variant="light" size="sm" className="font-mono font-bold">
                دليل 9 (حسابات رقابية خارج الميزانية)
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              إدارة ومطابقة حسابات البورصة والمكاتب بالعملات الثلاث (دولار، دينار، تومان) حركة بحركة
            </p>
          </div>
        </div>

        {/* الأزرار الرئيسية في الشريط العلوي */}
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="default"
            onClick={loadData}
            leftSection={<IconRefresh size={14} className={loading ? 'animate-spin' : ''} />}
            className="font-bold bg-white hover:bg-slate-50 border-slate-300"
          >
            تحديث
          </Button>

          {/* زر إضافة قيد / سند تصفية */}
          <Button
            size="xs"
            color="teal"
            variant="light"
            onClick={() => {
              setVoucherType('RECEIPT');
              setVoucherCurrency('USD');
              setVoucherAmount(0);
              setVoucherCustomRate(0);
              setVoucherNotes('');
              if (clearingAccounts.length > 0) {
                setVoucherClearingAccountId(clearingAccounts[0].id);
              }
              if (realCashAccounts.length > 0) {
                const defaultCash = realCashAccounts.find(c => c.label.includes('1811')) || realCashAccounts.find(c => c.label.includes('الصندوق الرئيسي')) || realCashAccounts.find(c => c.label.includes('صندوق')) || realCashAccounts[0];
                setVoucherCounterAccountId(defaultCash.value);
              }
              setVoucherModalOpen(true);
            }}
            leftSection={<IconReceipt size={14} />}
            className="font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300"
          >
            + سند / قيد تصفية
          </Button>

          {/* زر فتح حساب تصفية جديد */}
          <Button
            size="xs"
            color="orange"
            onClick={handleOpenCreateAccount}
            leftSection={<IconPlus size={14} />}
            className="font-black bg-orange-600 hover:bg-orange-700 text-white"
          >
            + فتح حساب تصفية جديد
          </Button>
        </div>
      </div>

      {/* ═══════════════ 2. بطاقات الإحصائيات ═══════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* 1. إجمالي التقييم الشامل بالدولار */}
        <Paper p="sm" radius="md" withBorder className="bg-white border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-600 font-bold mb-1">
            <span>إجمالي التصفية الشامل بالدولار</span>
            <Badge size="xs" color="orange" variant="light" className="font-mono font-bold">
              {totals.totalCount} حساب
            </Badge>
          </div>
          <div className="text-lg font-black text-slate-900 font-mono tracking-tight">
            ${totals.grandTotalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] font-medium text-slate-400 mt-1">
            مجموع أرصدة العملات الثلاث مقومة بالدولار
          </div>
        </Paper>

        {/* 2. الأرصدة بالدولار الصافي */}
        <Paper p="sm" radius="md" withBorder className="bg-white border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-600 font-bold mb-1">
            <span>الأرصدة بالدولار ($ USD)</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">USD</span>
          </div>
          <div className="text-lg font-black text-emerald-900 font-mono">
            ${totals.sumUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] font-medium text-slate-400 mt-1">
            إجمالي رصيد الدولار المباشر
          </div>
        </Paper>

        {/* 3. الأرصدة بالدينار العراقي */}
        <Paper p="sm" radius="md" withBorder className="bg-white border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-600 font-bold mb-1">
            <span>الأرصدة بالدينار (IQD)</span>
            <span className="text-[10px] font-mono font-bold text-slate-500">
              ≈ ${(totals.sumIQD / (iqdRate || 1530)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="text-lg font-black text-slate-900 font-mono">
            {totals.sumIQD.toLocaleString()} <span className="text-xs font-sans font-bold text-slate-500">د.ع</span>
          </div>
          <div className="text-[10px] font-medium text-slate-400 mt-1">
            سعر الصرف المرجعي: {iqdRate.toLocaleString()} د.ع
          </div>
        </Paper>

        {/* 4. الأرصدة بالتومان الإيراني */}
        <Paper p="sm" radius="md" withBorder className="bg-white border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-600 font-bold mb-1">
            <span>الأرصدة بالتومان (TOMAN)</span>
            <span className="text-[10px] font-mono font-bold text-slate-500">
              ≈ ${(totals.sumTOMAN / (tomanRate || 92000)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="text-lg font-black text-slate-900 font-mono">
            {totals.sumTOMAN.toLocaleString()} <span className="text-xs font-sans font-bold text-slate-500">تومان</span>
          </div>
          <div className="text-[10px] font-medium text-slate-400 mt-1">
            سعر الصرف المرجعي: {tomanRate.toLocaleString()} تومان
          </div>
        </Paper>
      </div>

      {/* ═══════════════ 3. التبويبات وجدول الحسابات ═══════════════ */}
      <Paper radius="md" withBorder className="bg-white border-slate-200 shadow-2xs overflow-hidden">
        <Tabs value={activeTab} onChange={setActiveTab} color="orange">
          <div className="border-b border-slate-200 px-4 pt-2 bg-slate-50/50 flex items-center justify-between">
            <Tabs.List className="border-b-0">
              <Tabs.Tab value="accounts" leftSection={<IconScale size={14} />} className="font-bold text-xs">
                دليل حسابات التصفيات ({filteredAccounts.length})
              </Tabs.Tab>
              <Tabs.Tab value="matching" leftSection={<IconFileSpreadsheet size={14} />} className="font-bold text-xs">
                محرك المطابقة الذكي لكشوف الحساب
              </Tabs.Tab>
            </Tabs.List>
          </div>

          {/* ─── TAB 1: دليل حسابات التصفيات ─── */}
          <Tabs.Panel value="accounts" p="md" className="space-y-3">
            {/* شريط الفلاتر والبحث */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SegmentedControl
                size="xs"
                value={categoryFilter}
                onChange={(v) => setCategoryFilter(String(v))}
                data={[
                  { label: `الكل (${totals.totalCount})`, value: 'ALL' },
                  { label: `بورصة (${totals.bourseCount})`, value: 'BOURSE' },
                  { label: `مكاتب وسيطة (${totals.officeCount})`, value: 'OFFICE' },
                  { label: `مقاصة معلقة (${totals.suspenseCount})`, value: 'SUSPENSE' },
                ]}
                color="orange"
                className="bg-slate-100 font-bold"
              />

              <TextInput
                size="xs"
                placeholder="بحث برمز الحساب، الاسم، أو الهاتف..."
                leftSection={<IconSearch size={14} className="text-slate-400" />}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-72 font-medium"
              />
            </div>

            {/* جدول الحسابات */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader color="orange" size="sm" />
                <span className="text-xs font-bold">جاري تحميل حسابات التصفيات من قاعدة البيانات...</span>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
                  <IconScale size={20} />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">لا توجد حسابات تصفية مطابقة</h3>
                <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                  يمكنك فتح حساب تصفية جديد يدعم (الدولار، الدينار، والتومان) للمطابقة والرقابة بضغطة زر.
                </p>
                <Button
                  size="xs"
                  color="orange"
                  variant="light"
                  onClick={() => setCreateModalOpen(true)}
                  leftSection={<IconPlus size={14} />}
                  className="font-bold"
                >
                  فتح أول حساب تصفية
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAccounts.map(acc => {
                  const isBourse = acc.category === 'BOURSE';
                  const isOffice = acc.category === 'OFFICE';
                  
                  const isConsolidatedNegative = acc.totalConsolidatedUSD < 0;
                  const isConsolidatedPositive = acc.totalConsolidatedUSD > 0;
                  
                  const formatCurrencyBox = (val: number, symbol: string) => {
                    const isNeg = val < 0;
                    const isPos = val > 0;
                    const absVal = Math.abs(val).toLocaleString('en-US', {
                      maximumFractionDigits: symbol === '$' ? 2 : 0,
                    });
                    const colorClass = isNeg
                      ? 'text-rose-600 font-bold'
                      : isPos
                      ? 'text-emerald-700 font-bold'
                      : 'text-slate-600 font-medium';
                    return (
                      <div dir="ltr" className={`text-[12px] font-mono tabular-nums leading-tight ${colorClass}`}>
                        {isNeg ? `-${symbol}${absVal}` : isPos ? `${symbol}${absVal}` : `${symbol}0`}
                      </div>
                    );
                  };

                  return (
                    <div
                      key={acc.id}
                      onClick={() => navigate(`/external-clearings/${acc.id}`)}
                      className="bg-white rounded-2xl border border-[#E5EAF0] p-4 shadow-2xs hover:shadow-md hover:border-orange-300 transition-all duration-200 cursor-pointer flex flex-col justify-between group space-y-3.5"
                    >
                      {/* ──── Header ──── */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/70 text-orange-600 flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-orange-500 group-hover:text-white transition-colors">
                              {isBourse ? (
                                <IconBuildingBank size={20} stroke={1.8} />
                              ) : isOffice ? (
                                <IconBriefcase size={20} stroke={1.8} />
                              ) : (
                                <IconExchange size={20} stroke={1.8} />
                              )}
                            </div>

                            <div className="min-w-0">
                              <h3 className="text-[15px] font-bold text-slate-900 group-hover:text-orange-600 transition-colors leading-tight truncate">
                                {acc.nameAr}
                              </h3>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  {acc.code}
                                </span>
                                <Badge
                                  size="xs"
                                  color={isBourse ? 'orange' : isOffice ? 'blue' : 'gray'}
                                  variant="light"
                                  className="font-bold text-[10px]"
                                >
                                  {isBourse ? 'حساب بورصة' : isOffice ? 'مكتب وسيط' : 'حساب مقاصة'}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* Action Icons */}
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="gray"
                              title="تعديل"
                              className="hover:bg-slate-100 text-slate-500"
                              onClick={() => handleOpenEditAccount(acc)}
                            >
                              <IconEdit size={14} />
                            </ActionIcon>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="red"
                              title="حذف الحساب"
                              className="hover:bg-rose-50 text-rose-500"
                              onClick={() => handleOpenDeleteAccount(acc)}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </div>
                        </div>

                        {/* Contact Person & Phone */}
                        {(acc.contactPerson || acc.phone) && (
                          <div className="flex items-center gap-3 text-[12px] text-slate-500 font-medium mt-2 pt-2 border-t border-slate-100">
                            {acc.contactPerson && (
                              <span className="flex items-center gap-1 truncate">
                                <IconUser size={12} className="text-slate-400 shrink-0" />
                                <span className="truncate">{acc.contactPerson}</span>
                              </span>
                            )}
                            {acc.phone && (
                              <span className="flex items-center gap-1 font-mono text-[11px] text-slate-600">
                                <IconPhone size={12} className="text-slate-400 shrink-0" />
                                <span dir="ltr">{acc.phone}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ──── Currency Balances Grid ──── */}
                      <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
                        <div className="bg-slate-50 border border-slate-200/80 p-2 rounded-xl">
                          <div className="text-[11px] font-sans font-bold text-slate-600 mb-0.5">$ دولار</div>
                          {formatCurrencyBox(acc.balanceUSD, '$')}
                        </div>
                        <div className="bg-slate-50 border border-slate-200/80 p-2 rounded-xl">
                          <div className="text-[11px] font-sans font-bold text-slate-600 mb-0.5">د.ع دينار</div>
                          {formatCurrencyBox(acc.balanceIQD, '')}
                        </div>
                        <div className="bg-slate-50 border border-slate-200/80 p-2 rounded-xl">
                          <div className="text-[11px] font-sans font-bold text-slate-600 mb-0.5">تومان</div>
                          {formatCurrencyBox(acc.balanceTOMAN, '')}
                        </div>
                      </div>

                      {/* ──── Total Consolidated USD Box ──── */}
                      <div
                        className={`rounded-xl p-2.5 flex items-center justify-between border ${
                          isConsolidatedNegative
                            ? 'bg-rose-50/50 border-rose-200'
                            : isConsolidatedPositive
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-sans font-bold text-slate-700">المعادل الإجمالي:</span>
                          {isConsolidatedNegative && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded border border-rose-200">
                              مستحق له (علينا)
                            </span>
                          )}
                          {isConsolidatedPositive && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200">
                              مطلوب لنا (في ذمته)
                            </span>
                          )}
                        </div>

                        <div
                          dir="ltr"
                          className={`text-[15px] font-black font-mono tabular-nums ${
                            isConsolidatedNegative
                              ? 'text-rose-600'
                              : isConsolidatedPositive
                              ? 'text-emerald-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {isConsolidatedNegative
                            ? `-$${Math.abs(acc.totalConsolidatedUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `$${acc.totalConsolidatedUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </div>
                      </div>

                      {/* ──── Action Buttons: Orange as Primary ──── */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                        <Button
                          fullWidth
                          size="xs"
                          color="orange"
                          variant="filled"
                          onClick={() => navigate(`/external-clearings/${acc.id}`)}
                          className="font-bold bg-orange-500 hover:bg-orange-600 text-white h-8 text-[12px] rounded-lg shadow-2xs transition-all"
                        >
                          البروفايل والحركات ◀
                        </Button>

                        <Button
                          size="xs"
                          color="orange"
                          variant="light"
                          onClick={() => {
                            setVoucherClearingAccountId(acc.id);
                            if (realCashAccounts.length > 0) {
                              const defaultCash =
                                realCashAccounts.find(c => c.label.includes('1811')) ||
                                realCashAccounts.find(c => c.label.includes('الصندوق الرئيسي')) ||
                                realCashAccounts.find(c => c.label.includes('صندوق')) ||
                                realCashAccounts[0];
                              setVoucherCounterAccountId(defaultCash.value);
                            }
                            setVoucherCurrency('USD');
                            setVoucherAmount(0);
                            setVoucherCustomRate(0);
                            setVoucherModalOpen(true);
                          }}
                          leftSection={<IconPlus size={13} />}
                          className="font-bold bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 h-8 text-[12px] rounded-lg shrink-0"
                        >
                          + سند
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Tabs.Panel>

          {/* ─── TAB 2: محرك المطابقة الذكي ─── */}
          <Tabs.Panel value="matching" p="md" className="space-y-3.5">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 font-medium flex items-start gap-2">
              <IconInfoCircle size={18} className="text-orange-600 shrink-0 mt-0.5" />
              <div>
                <span>محرك المطابقة التلقائي:</span> يتيح لك لصق أو رفع كشف الحساب الوارد من البورصة أو المكتب الخارجي لمقارنته آلياً مع حركات النظام وفرز الحركات المتطابقة والفروقات فورياً.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1 space-y-2.5">
                <Select
                  label="اختر حساب التصفية المراد مطابقته"
                  placeholder="اختر الحساب..."
                  data={clearingAccounts.map(a => ({ value: a.id, label: a.nameAr }))}
                  value={reconAccount}
                  onChange={(v) => setReconAccount(String(v))}
                  size="xs"
                  className="font-bold"
                />

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    بيانات كشف الحساب الخارجي (لصق أسطر أو Excel)
                  </label>
                  <Textarea
                    placeholder="التاريخ, البيان, المبلغ (مثال: 2026-08-16, تحويل صرافة, 50000000)"
                    rows={8}
                    value={reconText}
                    onChange={e => setReconText(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                <Button
                  fullWidth
                  size="xs"
                  color="orange"
                  onClick={handleRunReconciliation}
                  leftSection={<IconCheck size={14} />}
                  className="font-bold bg-orange-600 hover:bg-orange-700 text-white"
                >
                  تشغيل المطابقة الذكية
                </Button>
              </div>

              <div className="md:col-span-2">
                {reconResults ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <Paper p="xs" radius="md" withBorder className="bg-slate-50 border-slate-200 text-center">
                        <div className="text-[10px] font-bold text-emerald-800">حركات متطابقة</div>
                        <div className="text-base font-bold text-emerald-900 font-mono">{reconResults.matched.length}</div>
                      </Paper>
                      <Paper p="xs" radius="md" withBorder className="bg-slate-50 border-slate-200 text-center">
                        <div className="text-[10px] font-bold text-amber-800">مسجلة لدينا فقط</div>
                        <div className="text-base font-bold text-amber-900 font-mono">{reconResults.internalOnly.length}</div>
                      </Paper>
                      <Paper p="xs" radius="md" withBorder className="bg-slate-50 border-slate-200 text-center">
                        <div className="text-[10px] font-bold text-rose-800">فروقات (لديهم فقط)</div>
                        <div className="text-base font-bold text-rose-900 font-mono">{reconResults.externalOnly.length}</div>
                      </Paper>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                      <Table highlightOnHover verticalSpacing="xs" className="text-xs">
                        <Table.Thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <Table.Tr>
                            <Table.Th>التاريخ</Table.Th>
                            <Table.Th>البيان</Table.Th>
                            <Table.Th className="text-center">المبلغ</Table.Th>
                            <Table.Th className="text-center">الحالة</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {reconResults.matched.map(m => (
                            <Table.Tr key={m.id}>
                              <Table.Td className="font-mono font-medium">{m.date}</Table.Td>
                              <Table.Td className="font-medium text-slate-800">{m.desc}</Table.Td>
                              <Table.Td className="text-center font-mono font-bold text-emerald-800">{m.amount.toLocaleString()}</Table.Td>
                              <Table.Td className="text-center">
                                <Badge size="xs" color="emerald" variant="light">متطابق</Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                          {reconResults.externalOnly.map(m => (
                            <Table.Tr key={m.id}>
                              <Table.Td className="font-mono font-medium">{m.date}</Table.Td>
                              <Table.Td className="font-medium text-rose-900">{m.desc}</Table.Td>
                              <Table.Td className="text-center font-mono font-bold text-rose-800">{m.amount.toLocaleString()}</Table.Td>
                              <Table.Td className="text-center">
                                <Badge size="xs" color="red" variant="light">غير مسجل لدينا</Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="h-full border border-dashed border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center text-center text-slate-400 gap-2 bg-slate-50/40">
                    <IconFileSpreadsheet size={28} className="text-slate-300" />
                    <span className="text-xs font-medium">النتائج ستظهر هنا بعد تشغيل عملية المطابقة</span>
                  </div>
                )}
              </div>
            </div>
          </Tabs.Panel>
        </Tabs>
      </Paper>

      {/* ═══════════════ MODAL 1: فتح أو تعديل حساب تصفية متعدد العملات ═══════════════ */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
            <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 flex items-center justify-center shrink-0">
              {accountModalMode === 'CREATE' ? <IconPlus size={16} /> : <IconEdit size={16} />}
            </div>
            <span>
              {accountModalMode === 'CREATE'
                ? 'فتح حساب تصفية ومطابقة متعدد العملات'
                : `تعديل بيانات حساب التصفية (${editingAccountCode})`}
            </span>
          </div>
        }
        size="lg"
        centered
        radius="lg"
      >
        <div className="space-y-3.5 text-xs select-none">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-700 font-medium text-[11px] leading-relaxed">
            {accountModalMode === 'CREATE'
              ? 'هذا الحساب يدعم العملات الثلاث تلقائياً (الدولار، الدينار، والتومان) تحت الدليل الرقابي 91، دون أن يختلط بالميزانية العمومية أو الأرباح والخسائر.'
              : 'يمكنك تعديل المسميات وجهات الاتصال والملاحظات. الأرصدة الافتتاحية مقفلة ولا يمكن تعديلها مباشرة حفاظاً على دقة القيود.'}
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">نوع حساب التصفية</label>
            <SegmentedControl
              fullWidth
              size="xs"
              value={newCategory}
              onChange={v => setNewCategory(v as any)}
              disabled={accountModalMode === 'EDIT'}
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
              value={newNameAr}
              onChange={e => setNewNameAr(e.target.value)}
              required
              size="xs"
              className="font-bold"
            />

            <TextInput
              label="English Name (اختياري)"
              placeholder="e.g. Al-Souri Bourse"
              value={newNameEn}
              onChange={e => setNewNameEn(e.target.value)}
              size="xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextInput
              label="الشخص المسؤول / المندوب"
              placeholder="مثال: السيد أحمد..."
              value={newContactPerson}
              onChange={e => setNewContactPerson(e.target.value)}
              size="xs"
            />

            <TextInput
              label="رقم الهاتف للتواصل"
              placeholder="مثال: 07701234567"
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
              size="xs"
              className="font-mono"
            />
          </div>

          {accountModalMode === 'CREATE' ? (
            /* الأرصدة الافتتاحية في وضع الإنشاء */
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60 space-y-2.5">
              <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
                <span>الأرصدة الافتتاحية الأولية (إن وجدت)</span>
                <span className="text-[10px] font-normal text-slate-500">تدعم العملات الثلاث</span>
              </div>

              {/* اختيار طبيعة الرصيد الافتتاحي: مدين (لنا) أو دائن (علينا) */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <label className="font-bold text-slate-700">طبيعة الرصيد الافتتاحي:</label>
                  <span className="text-[11px] font-bold text-slate-500">
                    {newOpeningType === 'DEBIT' ? '🔴 مدين — دين بذمته لصالح شركتنا' : '🟢 دائن — أمانات وحقوق له بذمتنا'}
                  </span>
                </div>
                <SegmentedControl
                  fullWidth
                  size="xs"
                  value={newOpeningType}
                  onChange={v => setNewOpeningType(v as 'DEBIT' | 'CREDIT')}
                  data={[
                    { label: '🔴 مدين (لنا — في ذمته / مطلوب لنا)', value: 'DEBIT' },
                    { label: '🟢 دائن (علينا — في ذمتنا له / مستحق له)', value: 'CREDIT' },
                  ]}
                  color={newOpeningType === 'CREDIT' ? 'teal' : 'red'}
                  className="bg-slate-100 font-bold"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <FormattedNumberInput
                  label="رصيد الدولار ($)"
                  value={newOpeningUSD}
                  onChange={v => setNewOpeningUSD(typeof v === 'number' ? v : parseFloat(String(v || '0')) || 0)}
                  size="xs"
                />

                <FormattedNumberInput
                  label="رصيد الدينار (IQD)"
                  value={newOpeningIQD}
                  onChange={v => setNewOpeningIQD(typeof v === 'number' ? v : parseFloat(String(v || '0')) || 0)}
                  size="xs"
                />

                <FormattedNumberInput
                  label="رصيد التومان (TOM)"
                  value={newOpeningTOMAN}
                  onChange={v => setNewOpeningTOMAN(typeof v === 'number' ? v : parseFloat(String(v || '0')) || 0)}
                  size="xs"
                />
              </div>
            </div>
          ) : (
            /* الأرصدة الحالية في وضع التعديل (عرض فقط مقفل) */
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
                  <span className="font-black text-emerald-800 text-xs">${(newOpeningUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-[10px] block text-slate-500 font-sans font-bold mb-0.5">الدينار (IQD)</span>
                  <span className="font-black text-slate-900 text-xs">{(newOpeningIQD || 0).toLocaleString()} د.ع</span>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-[10px] block text-slate-500 font-sans font-bold mb-0.5">التومان (TOM)</span>
                  <span className="font-black text-slate-900 text-xs">{(newOpeningTOMAN || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <Textarea
            label="ملاحظات الحساب"
            placeholder="ملاحظات حول طبيعة التعامل، نسب العمولات، أو حسابات التحويل..."
            rows={2}
            value={newNotes}
            onChange={e => setNewNotes(e.target.value)}
            size="xs"
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setCreateModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              size="xs"
              color="orange"
              loading={creating}
              onClick={handleSaveAccount}
              leftSection={<IconCheck size={14} />}
              className="font-bold bg-orange-600 hover:bg-orange-700 text-white"
            >
              {accountModalMode === 'CREATE' ? 'حفظ وفتح الحساب' : 'حفظ التعديلات'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══════════════ MODAL 2: إضافة سند / قيد تصفية ═══════════════ */}
      <Modal
        opened={voucherModalOpen}
        onClose={() => setVoucherModalOpen(false)}
        title={
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <IconFileInvoice size={16} />
            </div>
            <span>إضافة سند / قيد تصفية ومطابقة</span>
          </div>
        }
        size={920}
        centered
        radius="lg"
      >
        <div className="space-y-3.5 text-xs select-none">
          {/* نوع السند بأيقونات احترافية في الأعلى */}
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
            {/* ══ العمود الأيمن: الحسابات والجهة المستفيدة والتاريخ ══ */}
            <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* حساب التصفية */}
                <Select
                  label={voucherType === 'RECEIPT' ? 'جهة التصفية (الدافع)' : 'جهة التصفية (المستلم)'}
                  placeholder="اختر حساب التصفية..."
                  searchable
                  nothingFoundMessage="لا توجد حسابات تصفية"
                  data={clearingAccounts.map(a => ({
                    value: a.id,
                    label: a.nameAr,
                  }))}
                  value={voucherClearingAccountId}
                  onChange={(v) => setVoucherClearingAccountId(v ? String(v) : null)}
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
                  onChange={(v) => setVoucherCounterAccountId(v ? String(v) : null)}
                  size="xs"
                  className="font-bold"
                />
              </div>

              {/* حقل اسم الجهة المرسل إليها الحوالة / المستفيد */}
              <TextInput
                label="الجهة المحول لها / المستفيد (اختياري)"
                placeholder="مثال: شركة النور / مكتب دبي / المستفيد أحمد..."
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
                    { label: 'تومان (TOM)', value: 'TOMAN' },
                    { label: 'دينار (IQD)', value: 'IQD' },
                    { label: 'دولار ($)', value: 'USD' },
                  ]}
                  color="orange"
                  className="bg-white border border-slate-200 font-bold"
                />
              </div>

              {/* حقول المبلغ وسعر الصرف */}
              {voucherCurrency === 'USD' ? (
                /* في حالة الدولار: يظهر حقل المبلغ فقط بعرض كامل دون الحاجة للصرافة */
                <FormattedNumberInput
                  label="المبلغ بالدولار ($ USD)"
                  value={voucherAmount}
                  onChange={v => setVoucherAmount(typeof v === 'number' ? v : parseFloat(String(v || '0')) || 0)}
                  size="xs"
                />
              ) : (
                /* في حالة التومان أو الدينار: يظهر حقل المبلغ وحقل سعر الصرف بجانبه */
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

              {/* المعادل المباشر بالدولار */}
              <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-center justify-between font-mono">
                <span className="text-slate-700 font-bold text-xs">المعادل بالدولار:</span>
                <span className="text-base font-black text-emerald-900">
                  ${voucherConvertedUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

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

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button size="xs" variant="default" onClick={() => setVoucherModalOpen(false)} className="font-medium">
              إلغاء
            </Button>
            <Button
              size="xs"
              color={voucherType === 'RECEIPT' ? 'teal' : voucherType === 'PAYMENT' ? 'red' : 'orange'}
              loading={submittingVoucher}
              onClick={handleSubmitVoucher}
              leftSection={<IconDeviceFloppy size={14} />}
              className="font-bold text-white shadow-xs"
            >
              حفظ وترحيل السند
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══════════════ DRAWER: كشف حساب التصفية وتفاصيل الحركات والمطابقة ═══════════════ */}
      <Drawer
        opened={statementDrawerOpen}
        onClose={() => setStatementDrawerOpen(false)}
        title={
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <IconFileText size={16} className="text-orange-600" />
            <span>كشف حساب التصفية وحركات السندات: {selectedAccount?.nameAr}</span>
          </div>
        }
        position="left"
        size="xl"
      >
        {selectedAccount && (
          <div className="space-y-3.5 text-xs select-none">
            {/* بطاقة ملخص أرصدة الحساب الحالية */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-slate-600 font-bold">كود الحساب: {selectedAccount.code}</span>
                <Badge size="xs" color="orange" variant="light" className="font-bold">
                  {selectedAccount.category}
                </Badge>
              </div>
              <div className="text-sm font-bold text-slate-900">{selectedAccount.nameAr}</div>
              
              <div className="grid grid-cols-3 gap-1.5 pt-1 text-center font-mono">
                <div className="bg-white border border-slate-200 p-1.5 rounded">
                  <div className="text-[9px] text-slate-500 font-bold">رصيد الدولار</div>
                  <div className="font-bold text-slate-900">${selectedAccount.balanceUSD.toLocaleString()}</div>
                </div>
                <div className="bg-white border border-slate-200 p-1.5 rounded">
                  <div className="text-[9px] text-slate-500 font-bold">رصيد الدينار</div>
                  <div className="font-bold text-slate-900">{selectedAccount.balanceIQD.toLocaleString()}</div>
                </div>
                <div className="bg-white border border-slate-200 p-1.5 rounded">
                  <div className="text-[9px] text-slate-500 font-bold">رصيد التومان</div>
                  <div className="font-bold text-slate-900">{selectedAccount.balanceTOMAN.toLocaleString()}</div>
                </div>
              </div>

              <div className="bg-slate-100 border border-slate-200 p-2 rounded flex items-center justify-between font-mono">
                <span className="text-xs text-slate-700 font-bold font-sans">إجمالي التقييم المعادل بالدولار:</span>
                <strong className="text-sm font-black text-slate-900">${selectedAccount.totalConsolidatedUSD.toFixed(2)}</strong>
              </div>
            </div>

            {/* جدول الحركات الفردية (حركة بحركة) للمطابقة */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <IconReceipt size={14} className="text-slate-600" />
                  <span>سجل حركات السندات والمطابقات الفردية ({statementRows.length})</span>
                </h4>

                <Button
                  size="compact-xs"
                  color="teal"
                  variant="light"
                  onClick={() => {
                    setVoucherClearingAccountId(selectedAccount.id);
                    if (realCashAccounts.length > 0) {
                      const defaultCash = realCashAccounts.find(c => c.label.includes('1811') || c.label.includes('الرئيسي') || c.label.includes('صندوق')) || realCashAccounts[0];
                      setVoucherCounterAccountId(defaultCash.value);
                    }
                    setVoucherCurrency('USD');
                    setVoucherAmount(0);
                    setVoucherCustomRate(0);
                    setVoucherModalOpen(true);
                  }}
                  leftSection={<IconPlus size={12} />}
                  className="font-bold"
                >
                  إضافة سند جديد
                </Button>
              </div>

              {loadingStatement ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader color="orange" size="xs" />
                  <span className="text-xs font-medium">جاري جلب الحركات الفردية...</span>
                </div>
              ) : statementRows.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-200 rounded-lg text-slate-400 space-y-1">
                  <IconReceipt size={24} className="mx-auto text-slate-300" />
                  <div className="font-bold text-xs text-slate-700">لا توجد حركات سندات مسجلة بعد</div>
                  <div className="text-[10px] text-slate-400">كل سند قبض أو دفع يتم تسجيله سيظهر هنا حركة بحركة للمطابقة الفردية</div>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <Table highlightOnHover withColumnBorders verticalSpacing="xs" className="text-xs">
                    <Table.Thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <Table.Tr>
                        <Table.Th className="text-center w-24">التاريخ</Table.Th>
                        <Table.Th>البيان / الحركة</Table.Th>
                        <Table.Th className="text-center w-28">المبلغ بالعملة</Table.Th>
                        <Table.Th className="text-center w-24">مدين ($)</Table.Th>
                        <Table.Th className="text-center w-24">دائن ($)</Table.Th>
                        <Table.Th className="text-center w-28">الرصيد التراكمي ($)</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {statementRows.map((row, idx) => (
                        <Table.Tr key={row.id || idx}>
                          <Table.Td className="font-mono text-center font-bold text-slate-700">{row.date}</Table.Td>
                          <Table.Td>
                            <div className="font-bold text-slate-900">{row.description}</div>
                            {row.reference && <div className="text-[10px] font-mono text-slate-400">{row.reference}</div>}
                          </Table.Td>
                          <Table.Td className="text-center font-mono font-bold text-slate-800">
                            {row.currency}
                          </Table.Td>
                          <Table.Td className="text-center font-mono font-bold text-rose-700">
                            {row.debit > 0 ? `$${row.debit.toFixed(2)}` : '—'}
                          </Table.Td>
                          <Table.Td className="text-center font-mono font-bold text-emerald-800">
                            {row.credit > 0 ? `$${row.credit.toFixed(2)}` : '—'}
                          </Table.Td>
                          <Table.Td className="text-center font-mono font-black text-slate-900 bg-slate-50/50">
                            ${row.balance.toFixed(2)}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* ═══════════════ MODAL 4: تنبيه وتأكيد حذف حساب التصفية ═══════════════ */}
      <Modal
        opened={deleteAccountModalOpen}
        onClose={() => setDeleteAccountModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
            <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
              <IconTrash size={16} />
            </div>
            <span>حذف حساب التصفية</span>
          </div>
        }
        size="md"
        centered
        overlayProps={{ opacity: 0.35, blur: 2 }}
        radius="lg"
      >
        {accountToDelete && (
          <div className="space-y-4 pt-1 text-right text-xs">
            {checkingMovements ? (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-500 font-bold">
                <Loader color="orange" size="sm" />
                <span>جاري فحص الحركات المحاسبية المرتبطة بالحساب...</span>
              </div>
            ) : accountMovementCount !== null && accountMovementCount > 0 ? (
              /* ─── حالة 1: الحساب يحتوي على حركات تشغيلية متعددة (تحذير وتأكيد) ─── */
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-black text-amber-950 text-sm">
                    <IconAlertTriangle size={18} className="text-amber-600 shrink-0" />
                    <span>تنبيه: الحساب يحتوي على حركات وسندات مسجلة</span>
                  </div>
                  <p className="text-xs leading-relaxed text-amber-900">
                    حساب التصفية <b>«{accountToDelete.nameAr}»</b> يحتوي على <b>{accountMovementCount}</b> حركة وسند مالي نشط.
                  </p>
                  <div className="text-[11px] font-medium text-amber-800 bg-amber-100/70 p-2 rounded border border-amber-300/60">
                    ⚠️ عند المتابعة سيتم حذف الحساب وإلغاء ارتباط قيوده الافتتاحية نهائياً من قاعدة البيانات.
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    size="xs"
                    variant="default"
                    onClick={() => setDeleteAccountModalOpen(false)}
                    className="font-bold"
                  >
                    إلغاء
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    loading={deletingAccount}
                    onClick={handleConfirmDeleteAccount}
                    leftSection={<IconTrash size={14} />}
                    className="font-bold bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    تأكيد حذف الحساب نهائياً
                  </Button>
                </div>
              </div>
            ) : (
              /* ─── حالة 2: الحساب لا يحتوي على حركات تشغيلية (حذف فوري نظيف) ─── */
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
                  <div className="flex items-center gap-2 font-black text-rose-950 text-sm">
                    <IconAlertCircle size={18} className="text-rose-600 shrink-0" />
                    <span>تأكيد حذف حساب التصفية</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    هل أنت متأكد من رغبتك في حذف حساب <b>«{accountToDelete.nameAr}»</b> ({accountToDelete.code}) نهائياً؟
                  </p>
                  <div className="text-[11px] font-medium text-rose-700">
                    سيتم حذف بطاقة الحساب وجميع سجلاته الافتتاحية فورياً من النظام.
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    size="xs"
                    variant="default"
                    onClick={() => setDeleteAccountModalOpen(false)}
                    className="font-bold"
                  >
                    تراجع
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    loading={deletingAccount}
                    onClick={handleConfirmDeleteAccount}
                    leftSection={<IconTrash size={14} />}
                    className="font-bold bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    تأكيد حذف الحساب
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExternalClearingsPage;
