import React, { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '../api/client';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';
import {
  Button,
  Badge,
  Switch,
  TextInput,
  Select,
  Modal,
  Drawer,
  Tooltip,
  ActionIcon,
  Loader,
  Checkbox,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconSearch,
  IconFilterOff,
  IconPrinter,
  IconPaperclip,
  IconUser,
  IconReceipt,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconCheck,
  IconClock,
  IconRefresh,
  IconWallet,
  IconEye,
  IconShieldCheck,
  IconArrowsTransferDown,
  IconArrowsExchange,
  IconCash,
  IconCrown,
  IconBuildingBank,
  IconChecklist,
  IconCreditCard,
  IconCoins,
  IconCircleCheck,
  IconCalendar,
} from '@tabler/icons-react';
import { useLanguageStore } from '../store/useLanguageStore';

interface CashboxCardData {
  id: string;
  code: string;
  nameAr: string;
  isMain: boolean;
  type: 'CASH' | 'MASTER' | 'BANK';
  balanceIQD: number;
  balanceUSD: number;
  pendingCount: number;
  pendingAmountIQD: number;
  pendingAmountUSD: number;
  clearedCount: number;
  totalReceiptsIQD: number;
  totalReceiptsUSD: number;
  totalPaymentsIQD: number;
  totalPaymentsUSD: number;
}

interface SettlementItem {
  id: string;
  voucherNumber: string;
  type: 'RECEIPT' | 'PAYMENT';
  typeLabel: string;
  date: string;
  dateFormatted: string;
  amount: number;
  currency: 'IQD' | 'USD';
  cashboxAccountId: string;
  cashboxName: string;
  isMainCashbox: boolean;
  accountId: string;
  accountName: string;
  description: string;
  userName: string;
  slipsCount: number;
  isSettled: boolean;
}

export const SubCashboxesSettlementPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [loading, setLoading] = useState(true);
  const [allItems, setAllItems] = useState<SettlementItem[]>([]);
  const [cashboxCards, setCashboxCards] = useState<CashboxCardData[]>([]);
  const [mainCashboxAccount, setMainCashboxAccount] = useState<any>(null);
  const [allAccountsList, setAllAccountsList] = useState<any[]>([]);
  const [showMainCashbox, setShowMainCashbox] = useState(false);

  // Selected Cashbox Card Filter (null or 'ALL' or specific cashbox ID)
  const [activeCardFilter, setActiveCardFilter] = useState<string>('ALL');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>('ALL');
  const [statusFilter, setStatusFilter] = useState<string | null>('ALL'); // ALL, PENDING, SETTLED
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals & Details
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [selectedSlipItem, setSelectedSlipItem] = useState<SettlementItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<SettlementItem | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // ── Unconfirmed Vouchers Batch Settlement Modal ──
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchModalSelectedBoxId, setBatchModalSelectedBoxId] = useState<string>('ALL');
  const [batchModalTypeFilter, setBatchModalTypeFilter] = useState<string>('ALL');
  const [batchSelectedVoucherIds, setBatchSelectedVoucherIds] = useState<Set<string>>(new Set());
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  /*
   * لا localStorage هنا بعد اليوم.
   *
   * كانت حالة «تم التحصيل» تُقرأ من خريطة في متصفح الجهاز إلى جانب القاعدة —
   * فجهازٌ آخر يرى حالات مختلفة، ومسح بيانات المتصفح يمحو التأكيدات مع أن قيود
   * التوريد موجودة، ورفعُ تحصيلٍ من جهاز لا يظهر على غيره أبداً لأن خريطة الجهاز
   * الآخر تقول «محصَّل» إلى الأبد. مصدر الحقيقة الوحيد الآن هو قاعدة البيانات:
   * السند محصَّل ⇔ قيدُ توريده CLR-<رقم السند> موجود في القيود.
   */

  const formatDateEn = (dateVal: any): string => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const detectCurrency = (v: any): 'IQD' | 'USD' => {
    if (v.currency === 'USD' || v.currency === '$') return 'USD';
    if (v.currency === 'IQD' || v.currency === 'د.ع') return 'IQD';
    const desc = v.description || '';
    if (desc.includes('$') || desc.includes('USD') || desc.includes('دولار')) return 'USD';
    return 'IQD';
  };

  const fetchSettlementData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const noCacheOpt = silent ? { noCache: true } : {};
      const [receipts, payments, accounts, cbData, journalEntries] = await Promise.all([
        apiRequest('/api/receipt-vouchers', noCacheOpt).catch(() => []),
        apiRequest('/api/payment-vouchers', noCacheOpt).catch(() => []),
        apiRequest('/api/accounts', noCacheOpt).catch(() => []),
        apiRequest('/api/cashboxes-banks/cashboxes', noCacheOpt).catch(() => []),
        apiRequest('/api/journal-entries', noCacheOpt).catch(() => []),
      ]);

      const loadedAccounts = accounts || [];
      setAllAccountsList(loadedAccounts);

      const accountsMap: Record<string, any> = {};
      loadedAccounts.forEach((acc: any) => {
        if (acc.id) accountsMap[acc.id] = acc;
      });

      const settledRefsSet = new Set(
        (journalEntries || []).map((j: any) => j.reference).filter(Boolean)
      );

      // 1. Identify all parent accounts in the accounts tree
      const parentIdSet = new Set(loadedAccounts.map((a: any) => a.parentId).filter(Boolean));
      const hasChildren = (code: string, id: string) => {
        return (
          parentIdSet.has(id) ||
          loadedAccounts.some(
            (a: any) =>
              a.parentId === id ||
              (a.code && a.code !== code && a.code.startsWith(code) && a.code.length > code.length)
          )
        );
      };

      // 2. Filter ONLY real operational cashboxes (exclude Mastercards, cards, banks)
      const cashAccounts = loadedAccounts.filter((a: any) => {
        const code = String(a.code || '');
        const name = (a.nameAr || '').trim();

        // Must NOT be parent/group
        if (a.isGroup || a.isParent || hasChildren(code, a.id)) return false;

        // Exclude cards, mastercards, banks, clearing, liabilities
        if (
          code.startsWith('1343') ||
          code.startsWith('1342') ||
          code.startsWith('183') ||
          code.startsWith('182') ||
          code.startsWith('2') ||
          code.startsWith('9') ||
          code.startsWith('3') ||
          code.startsWith('4') ||
          code.startsWith('5') ||
          name.includes('ماستر') ||
          name.includes('Master') ||
          name.includes('بطاقات') ||
          name.includes('محافظ') ||
          name.includes('بنك') ||
          name.includes('Bank')
        ) {
          return false;
        }

        // Must NOT be system category headers
        if (
          name.includes('(الصناديق النقدية)') ||
          name.includes('حماية اجتماعية') ||
          name.includes('صكوك وحوالات') ||
          name.includes('مرفوضة')
        ) {
          return false;
        }

        // Must belong to Cashboxes (1341, 181, 1101 or CASH category with صندوق / قاصة)
        const isCashbox =
          code.startsWith('1341') ||
          code.startsWith('181') ||
          code.startsWith('1101') ||
          a.category === 'CASH' ||
          name.includes('صندوق') ||
          name.includes('قاصة');

        return isCashbox;
      });

      /*
       * الصندوق الرئيسي — بنفس منطق الخادم حرفاً بحرف (resolveMainCashbox).
       *
       * كان اختلاف التعريف بين الطرفين يجعل الواجهة تعرض سنداً على الصندوق
       * الرئيسي كأنه فرعيّ قابل للتحصيل، فيبدو التبديل ناجحاً ثم لا يصمد لأن
       * الخادم لا ينشئ قيد توريد لسندٍ هو أصلاً في القاصة الرئيسية.
       */
      const MAIN_CODES = ['13411', '1341101', '11011', '181021'];
      const mainBox =
        cashAccounts.find((a: any) => MAIN_CODES.includes(a.code)) ||
        cashAccounts.find(
          (a: any) =>
            a.nameAr?.includes('حسابات الشرك') ||
            a.nameAr?.includes('القاصة') ||
            a.nameAr?.includes('الصندوق الرئيسي')
        ) ||
        cashAccounts[0] ||
        null;

      setMainCashboxAccount(mainBox);

      const cashboxIdsSet = new Set(cashAccounts.map((c: any) => c.id));

      const formatVoucher = (v: any, type: 'RECEIPT' | 'PAYMENT'): SettlementItem => {
        const boxId = v.cashboxOrBankAccountId;
        const boxAcc = accountsMap[boxId];
        const isMain = Boolean(
          mainBox &&
            (boxId === mainBox.id ||
              boxAcc?.code === mainBox.code ||
              (boxAcc?.code && MAIN_CODES.includes(boxAcc.code)) ||
              boxAcc?.nameAr?.includes('حسابات الشرك') ||
              boxAcc?.nameAr?.includes('القاصة') ||
              boxAcc?.nameAr?.includes('الصندوق الرئيسي'))
        );

        const vNum = v.voucherNumber || (type === 'RECEIPT' ? `RV-${v.id.slice(0, 6)}` : `PV-${v.id.slice(0, 6)}`);
        const curr = detectCurrency(v);
        // Source of truth from real DB clearance journal entries — and nothing else
        const isSettled = settledRefsSet.has(`CLR-${vNum}`);

        return {
          id: v.id,
          voucherNumber: vNum,
          type,
          typeLabel: type === 'RECEIPT' ? 'سند قبض' : 'سند دفع',
          date: v.date || v.createdAt,
          dateFormatted: formatDateEn(v.date || v.createdAt),
          amount: Number(v.amount || 0),
          currency: curr,
          cashboxAccountId: boxId,
          cashboxName: boxAcc?.nameAr || boxId || 'صندوق فرعي',
          isMainCashbox: Boolean(isMain),
          accountId: v.accountId,
          accountName: v.account?.nameAr || accountsMap[v.accountId]?.nameAr || 'حساب فرعي',
          description: v.description || (type === 'RECEIPT' ? 'سند قبض' : 'سند دفع'),
          userName: v.createdBy?.name || v.createdBy?.fullName || 'علي جعفر محمود',
          slipsCount: v.slipsCount || (v.hasSlip || (v.description && v.description.includes('ماستر')) ? 1 : 0),
          isSettled,
        };
      };

      const receiptsFormatted = (receipts || [])
        .filter((r: any) => cashboxIdsSet.has(r.cashboxOrBankAccountId))
        .map((r: any) => formatVoucher(r, 'RECEIPT'));

      const paymentsFormatted = (payments || [])
        .filter((p: any) => cashboxIdsSet.has(p.cashboxOrBankAccountId))
        .map((p: any) => formatVoucher(p, 'PAYMENT'));

      const combined = [...receiptsFormatted, ...paymentsFormatted].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setAllItems(combined);

      const cards: CashboxCardData[] = cashAccounts.map((box: any) => {
        const isMain =
          mainBox && (box.id === mainBox.id || box.code === '13411' || box.nameAr?.includes('حسابات الشركة') || box.nameAr?.includes('الرئيسي') || box.code === mainBox.code);

        const code = String(box.code || '');
        const name = (box.nameAr || '').toLowerCase();
        let boxType: 'CASH' | 'MASTER' | 'BANK' = 'CASH';
        if (code.startsWith('1343') || code.startsWith('183') || name.includes('ماستر') || name.includes('master') || name.includes('بطاق') || name.includes('محفظ')) {
          boxType = 'MASTER';
        } else if (code.startsWith('1342') || code.startsWith('182') || name.includes('مصرف') || name.includes('بنك') || name.includes('bank')) {
          boxType = 'BANK';
        }

        // Calculate pending & cleared vouchers for this box in BOTH IQD and USD
        const boxVouchers = combined.filter((v) => v.cashboxAccountId === box.id);
        let pendingCount = 0;
        let pendingAmountIQD = 0;
        let pendingAmountUSD = 0;
        let clearedCount = 0;
        let totalReceiptsIQD = 0;
        let totalReceiptsUSD = 0;
        let totalPaymentsIQD = 0;
        let totalPaymentsUSD = 0;

        boxVouchers.forEach((v) => {
          if (v.isSettled) {
            clearedCount++;
          } else {
            pendingCount++;
            if (v.currency === 'USD') pendingAmountUSD += v.amount;
            else pendingAmountIQD += v.amount;
          }
          if (v.type === 'RECEIPT') {
            if (v.currency === 'USD') totalReceiptsUSD += v.amount;
            else totalReceiptsIQD += v.amount;
          } else {
            if (v.currency === 'USD') totalPaymentsUSD += v.amount;
            else totalPaymentsIQD += v.amount;
          }
        });

        const cbInfo = (cbData || []).find(
          (c: any) => c.id === box.id || c.accountId === box.id || c.code === box.code
        );
        const liveBalIQD = Number(cbInfo?.balanceIQD ?? box.balanceIQD ?? box.balance ?? 0);
        const liveBalUSD = Number(cbInfo?.balanceUSD ?? box.balanceUSD ?? 0);

        return {
          id: box.id,
          code: box.code,
          nameAr: box.nameAr,
          isMain: Boolean(isMain),
          type: boxType,
          balanceIQD: liveBalIQD,
          balanceUSD: liveBalUSD,
          pendingCount,
          pendingAmountIQD,
          pendingAmountUSD,
          clearedCount,
          totalReceiptsIQD,
          totalReceiptsUSD,
          totalPaymentsIQD,
          totalPaymentsUSD,
        };
      });

      // Sort: Sub-cashboxes with pending items first, then others, then main box
      cards.sort((a, b) => {
        if (a.isMain && !b.isMain) return 1;
        if (!a.isMain && b.isMain) return -1;
        return b.pendingCount - a.pendingCount;
      });

      setCashboxCards(cards);
    } catch (err: any) {
      console.error('Error fetching settlement data:', err);
      showErrorNotification('خطأ التحميل', err.message || 'تعذر تحميل بيانات تحصيل الصناديق');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlementData();
  }, []);

  /**
   * رفعُ تأكيد التحصيل ليس نقرةً عابرة: سيُحذف قيدُ التوريد المرحَّل وتُعاد
   * الأرصدة بين الصندوقين — فيُعترض المسار بنافذة تحذير تسمّي العواقب، ولا
   * يمضي الرفع إلا بتأكيد صريح. التأكيد (الإيجاب) يمرّ مباشرة كما كان.
   */
  const [revertTarget, setRevertTarget] = useState<SettlementItem | null>(null);
  const [revertBusy, setRevertBusy] = useState(false);

  const handleToggleSettlement = (item: SettlementItem, newStatus: boolean) => {
    if (!newStatus) {
      setRevertTarget(item);
      return;
    }
    void performToggleSettlement(item, true);
  };

  const performToggleSettlement = async (item: SettlementItem, newStatus: boolean) => {
    setAllItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, isSettled: newStatus } : it))
    );

    setCashboxCards((prev) =>
      prev.map((c) => {
        if (c.id === item.cashboxAccountId) {
          const diff = newStatus ? -1 : 1;
          const diffAmt = newStatus ? -item.amount : item.amount;
          return {
            ...c,
            pendingCount: Math.max(0, c.pendingCount + diff),
            pendingAmountIQD: item.currency === 'IQD' ? Math.max(0, c.pendingAmountIQD + diffAmt) : c.pendingAmountIQD,
            pendingAmountUSD: item.currency === 'USD' ? Math.max(0, c.pendingAmountUSD + diffAmt) : c.pendingAmountUSD,
            clearedCount: newStatus ? c.clearedCount + 1 : Math.max(0, c.clearedCount - 1),
            balanceIQD: item.currency === 'IQD' ? Math.max(0, c.balanceIQD - (newStatus ? item.amount : -item.amount)) : c.balanceIQD,
            balanceUSD: item.currency === 'USD' ? Math.max(0, c.balanceUSD - (newStatus ? item.amount : -item.amount)) : c.balanceUSD,
          };
        }
        if (mainCashboxAccount && c.id === mainCashboxAccount.id) {
          return {
            ...c,
            balanceIQD: item.currency === 'IQD' ? c.balanceIQD + (newStatus ? item.amount : -item.amount) : c.balanceIQD,
            balanceUSD: item.currency === 'USD' ? c.balanceUSD + (newStatus ? item.amount : -item.amount) : c.balanceUSD,
          };
        }
        return c;
      })
    );

    if (newStatus) {
      showSuccessNotification(
        'تم تأكيد التحصيل بنجاح',
        `تم تحصيل وتوريد السند [${item.voucherNumber}] بمبلغ ${item.amount.toLocaleString()} ${item.currency} من [${item.cashboxName}] إلى صندوق الشركة الرئيسي.`
      );
    } else {
      showSuccessNotification(
        'تم إلغاء التحصيل',
        `تمت إعادة السند [${item.voucherNumber}] إلى حالة قيد التحصيل من الصندوق الفرعي.`
      );
    }

    /*
     * قيد التوريد يُكتب في القاعدة، والجدول لا يُعاد تحميله.
     *
     * كان كل تبديل يستدعي fetchSettlementData فتُجلب خمس قوائم كاملة من جديد
     * ويرتجّ الجدول كله لأجل صفٍّ واحد سبق تحديثه تفاؤلياً أعلاه. التحديث
     * التفاؤلي هو الحقيقة الجديدة نفسها، فلا شيء يُستجلب عند النجاح — وعند
     * الفشل وحده تُستعاد الحقيقة من القاعدة كي لا تكذب الشاشة.
     */
    setProcessingId(item.id);
    try {
      await apiRequest('/api/cashboxes-banks/settle-voucher', {
        method: 'POST',
        body: JSON.stringify({
          voucherId: item.id,
          voucherNumber: item.voucherNumber,
          isSettled: newStatus,
        }),
      });
    } catch (err: any) {
      showErrorNotification(
        'تعذر حفظ حالة التحصيل',
        err?.message || 'لم يصل التغيير إلى قاعدة البيانات — أُعيدت الشاشة إلى الحالة الفعلية.'
      );
      fetchSettlementData(true);
    } finally {
      setProcessingId(null);
    }
  };

  // Open Batch Clearance Modal showing all unconfirmed vouchers
  const handleOpenBatchClearanceModal = (sourceBoxId: string = 'ALL') => {
    setBatchModalSelectedBoxId(sourceBoxId);
    const unconfirmed = allItems.filter((i) => {
      if (i.isSettled) return false;
      if (sourceBoxId !== 'ALL' && i.cashboxAccountId !== sourceBoxId) return false;
      return true;
    });

    setBatchSelectedVoucherIds(new Set(unconfirmed.map((u) => u.id)));
    setBatchModalOpen(true);
  };

  // Filter unconfirmed vouchers for the modal
  const modalUnconfirmedVouchers = useMemo(() => {
    return allItems.filter((i) => {
      if (i.isSettled) return false;
      if (batchModalSelectedBoxId !== 'ALL' && i.cashboxAccountId !== batchModalSelectedBoxId) return false;
      if (batchModalTypeFilter !== 'ALL' && i.type !== batchModalTypeFilter) return false;
      return true;
    });
  }, [allItems, batchModalSelectedBoxId, batchModalTypeFilter]);

  // Selected vouchers inside modal calculations
  const modalSelectedStats = useMemo(() => {
    let totalIQD = 0;
    let totalUSD = 0;
    let count = 0;

    modalUnconfirmedVouchers.forEach((v) => {
      if (batchSelectedVoucherIds.has(v.id)) {
        count++;
        if (v.currency === 'USD') totalUSD += v.amount;
        else totalIQD += v.amount;
      }
    });

    return { totalIQD, totalUSD, count };
  }, [modalUnconfirmedVouchers, batchSelectedVoucherIds]);

  // Execute Batch Settlement of Selected Vouchers
  const handleExecuteBatchSettlement = async () => {
    if (batchSelectedVoucherIds.size === 0) {
      showErrorNotification('تنبيه', 'يرجى تحديد وصولات واحدة على الأقل للتحصيل.');
      return;
    }

    setBatchSubmitting(true);
    try {
      await apiRequest('/api/cashboxes-banks/settle-batch', {
        method: 'POST',
        body: JSON.stringify({
          voucherIds: Array.from(batchSelectedVoucherIds),
          sourceBoxId: batchModalSelectedBoxId,
        }),
      });

      setAllItems((prev) =>
        prev.map((it) => (batchSelectedVoucherIds.has(it.id) ? { ...it, isSettled: true } : it))
      );

      showSuccessNotification(
        'تم التحصيل والتوريد بنجاح',
        `تم تأكيد تحصيل (${modalSelectedStats.count}) وصل وسند مالي بقيمة ${modalSelectedStats.totalIQD.toLocaleString()} د.ع وتوريدها إلى قاصة صندوق الشركة الرئيسي بنجاح تام.`
      );

      setBatchModalOpen(false);
      // صامتة: تجدّد بطاقات الصناديق بعد الدفعة دون دوّامة تحميل تمسح الشاشة.
      fetchSettlementData(true);
    } catch (err: any) {
      showErrorNotification('خطأ في التحصيل', err.message || 'حدث خطأ أثناء تأكيد التحصيل.');
    } finally {
      setBatchSubmitting(false);
    }
  };

  // Filtered List
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (!showMainCashbox && item.isMainCashbox && activeCardFilter !== item.cashboxAccountId) {
        return false;
      }
      if (activeCardFilter !== 'ALL' && item.cashboxAccountId !== activeCardFilter) {
        return false;
      }
      if (typeFilter && typeFilter !== 'ALL' && item.type !== typeFilter) {
        return false;
      }
      if (statusFilter === 'SETTLED' && !item.isSettled) return false;
      if (statusFilter === 'PENDING' && item.isSettled) return false;
      if (startDate && item.dateFormatted < startDate) return false;
      if (endDate && item.dateFormatted > endDate) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.voucherNumber.toLowerCase().includes(q) ||
          item.accountName.toLowerCase().includes(q) ||
          item.cashboxName.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.userName.toLowerCase().includes(q) ||
          String(item.amount).includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [allItems, showMainCashbox, activeCardFilter, typeFilter, statusFilter, startDate, endDate, searchQuery]);

  /** عدد سندات القبض والدفع ضمن الفلاتر القائمة — يُظهرها التبويب دون النوع نفسه. */
  const typeCounts = useMemo(() => {
    let receipt = 0;
    let payment = 0;
    allItems.forEach((item) => {
      if (!showMainCashbox && item.isMainCashbox && activeCardFilter !== item.cashboxAccountId) return;
      if (activeCardFilter !== 'ALL' && item.cashboxAccountId !== activeCardFilter) return;
      if (statusFilter === 'SETTLED' && !item.isSettled) return;
      if (statusFilter === 'PENDING' && item.isSettled) return;
      if (startDate && item.dateFormatted < startDate) return;
      if (endDate && item.dateFormatted > endDate) return;
      if (item.type === 'RECEIPT') receipt++;
      else payment++;
    });
    return { receipt, payment, all: receipt + payment };
  }, [allItems, showMainCashbox, activeCardFilter, statusFilter, startDate, endDate]);

  // Overall KPI Calculations across all items
  const stats = useMemo(() => {
    let pendingIQD = 0;
    let pendingUSD = 0;
    let settledIQD = 0;
    let settledUSD = 0;
    let pendingCount = 0;
    let settledCount = 0;

    allItems.forEach((item) => {
      if (!item.isMainCashbox) {
        if (item.isSettled) {
          settledCount++;
          if (item.currency === 'USD') settledUSD += item.amount;
          else settledIQD += item.amount;
        } else {
          pendingCount++;
          if (item.currency === 'USD') pendingUSD += item.amount;
          else pendingIQD += item.amount;
        }
      }
    });

    return {
      pendingIQD,
      pendingUSD,
      settledIQD,
      settledUSD,
      pendingCount,
      settledCount,
      totalCount: allItems.length,
    };
  }, [allItems]);

  return (
    <div
      className="p-4 md:p-6 max-w-[1680px] mx-auto space-y-4 select-none"
      dir={direction}
      style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* ── 1. ENTERPRISE HEADER BANNER ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 p-4 md:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs no-print">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#FFF3E8] text-[#F45A0A] border border-orange-200/80 flex items-center justify-center shadow-2xs shrink-0">
            <IconArrowsTransferDown size={24} stroke={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg md:text-xl font-black text-slate-950 tracking-tight leading-tight">
                {isAr ? 'تحصيل وتسوية الصناديق الفرعية' : 'Sub-Cashboxes Settlement & Clearance'}
              </h1>
              {stats.pendingCount > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-50 text-[#F45A0A] border border-orange-200 font-mono">
                  {stats.pendingCount} {isAr ? 'وصولات معلقة' : 'Pending'}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {isAr ? 'جميع الصناديق مسوّاة بالكامل ✓' : 'Fully Settled'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              {isAr ? 'تأكيد واستلام وصولات وسندات الصناديق الفرعية وتوريدها للقاصة الرئيسية.' : 'Confirm and settle sub-cashbox vouchers to the headquarters cashbox.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Main Action Button */}
          <button
            type="button"
            onClick={() => handleOpenBatchClearanceModal('ALL')}
            className="h-10 px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-black text-xs md:text-sm flex items-center gap-2 shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-98"
          >
            <IconChecklist size={18} stroke={2.5} />
            <span>
              {isAr ? `تحصيل وتوريد الوصولات المعلقة (${stats.pendingCount})` : `Batch Clear Vouchers (${stats.pendingCount})`}
            </span>
          </button>

          {/* Toggle Option: Show Main Cashbox */}
          <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/80 px-3 py-2 rounded-xl border border-slate-200 transition-colors">
            <Switch
              size="xs"
              color="orange"
              checked={showMainCashbox}
              onChange={(e) => setShowMainCashbox(e.currentTarget.checked)}
              label={
                <span className="text-xs font-bold text-slate-800 cursor-pointer">
                  {isAr ? 'إظهار سندات الصندوق الرئيسي' : 'Show HQ Vouchers'}
                </span>
              }
            />
          </div>

          <button
            type="button"
            onClick={() => fetchSettlementData()}
            className="h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title={isAr ? 'تحديث البيانات' : 'Refresh'}
          >
            <IconRefresh size={16} />
            <span>{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title={isAr ? 'طباعة الكشف' : 'Print'}
          >
            <IconPrinter size={16} />
            <span>{isAr ? 'طباعة' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. ALL CASHBOX CARDS WRAPPER CONTAINER ── */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5 no-print">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2 text-xs md:text-sm font-black text-slate-900">
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#F45A0A] border border-orange-200 flex items-center justify-center shrink-0">
              <IconWallet size={16} />
            </div>
            <span>{isAr ? 'بطاقات الصناديق النقدية والقاصات الفرعية:' : 'Cashbox Wallets & Sub-Cashboxes:'}</span>
          </div>

          {activeCardFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setActiveCardFilter('ALL')}
              className="text-xs font-black text-[#F45A0A] hover:underline cursor-pointer flex items-center gap-1.5"
            >
              <span>{isAr ? 'عرض كل الصناديق' : 'Show All'}</span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-orange-50 border border-orange-200">
                ✕ {isAr ? 'إلغاء التحديد' : 'Clear'}
              </span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {cashboxCards
            .filter((box) => showMainCashbox || !box.isMain)
            .map((box) => {
              const isSelected = activeCardFilter === box.id;
              const isMain = box.isMain;
              const isMaster = box.type === 'MASTER';

              return (
                <div
                  key={box.id}
                  onClick={() => setActiveCardFilter(isSelected ? 'ALL' : box.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? 'ring-2 ring-[#F45A0A] border-orange-400 bg-orange-50/20 shadow-xs'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-white hover:border-orange-300 hover:shadow-xs'
                  }`}
                >
                  <div>
                    {/* Top Row: Icon, Name & Code */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 truncate">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                            isMain
                              ? 'bg-amber-500 text-white'
                              : isMaster
                              ? 'bg-blue-600 text-white'
                              : 'bg-[#F45A0A] text-white'
                          }`}
                        >
                          {isMain ? <IconCrown size={18} /> : isMaster ? <IconCreditCard size={18} /> : <IconCash size={18} />}
                        </div>
                        <div className="truncate">
                          <div className="font-black text-xs md:text-sm text-slate-950 truncate flex items-center gap-1.5">
                            <span>{box.nameAr}</span>
                            {isMain && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300">
                                {isAr ? 'رئيسي ★' : 'HQ'}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 font-mono font-bold block mt-0.5">
                            كود: {box.code}
                          </span>
                        </div>
                      </div>

                      {/* Pending Badge */}
                      {box.pendingCount > 0 && !isMain && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-100 text-[#F45A0A] border border-orange-200 shrink-0 font-mono">
                          {box.pendingCount} {isAr ? 'معلق' : 'pending'}
                        </span>
                      )}
                    </div>

                    {/* Financial Breakdown: Receipts & Payments */}
                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-slate-500 font-bold text-[11px] block">{isAr ? 'القبض' : 'Receipts'}</span>
                          <span className="font-black font-mono text-emerald-800 tabular-nums text-xs block">
                            {box.totalReceiptsIQD.toLocaleString()} د.ع
                          </span>
                          {box.totalReceiptsUSD > 0 && (
                            <span className="font-bold font-mono text-slate-600 tabular-nums text-[11px] block">
                              ${box.totalReceiptsUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-slate-500 font-bold text-[11px] block">{isAr ? 'الدفع' : 'Payments'}</span>
                          <span className="font-black font-mono text-rose-800 tabular-nums text-xs block">
                            {box.totalPaymentsIQD.toLocaleString()} د.ع
                          </span>
                          {box.totalPaymentsUSD > 0 && (
                            <span className="font-bold font-mono text-slate-600 tabular-nums text-[11px] block">
                              ${box.totalPaymentsUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Net Live Balance */}
                      <div className="pt-2 border-t border-dashed border-slate-300">
                        <span className="text-xs text-slate-500 font-black">{isAr ? 'صافي الرصيد الحالي' : 'Net Balance'}</span>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="font-black font-mono tabular-nums text-sm md:text-base text-[#F45A0A]">
                            {box.balanceIQD.toLocaleString()} <span className="text-[10.5px] font-bold text-slate-500">د.ع</span>
                          </span>
                          <span className="font-black font-mono tabular-nums text-xs text-slate-700">
                            ${box.balanceUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Batch Clear CTA */}
                  <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-1">
                    <span className="text-xs font-black">
                      {box.pendingCount > 0 ? (
                        <span className="text-[#F45A0A]">{isAr ? 'بانتظار التحصيل' : 'Pending'}</span>
                      ) : (
                        <span className="text-emerald-700">{isAr ? 'تمت التسوية بالكامل ✓' : 'Settled'}</span>
                      )}
                    </span>

                    {box.pendingCount > 0 && !isMain && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenBatchClearanceModal(box.id);
                        }}
                        className="h-7 px-3 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-black text-xs shadow-2xs transition-colors cursor-pointer"
                      >
                        {isAr ? `تحصيل (${box.pendingCount})` : `Clear (${box.pendingCount})`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* ── تبويبات فصل القبض عن الدفع ── */}
      <div className="flex items-center gap-2 no-print">
        {([
          { key: 'ALL', label: isAr ? 'الكل' : 'All', count: typeCounts.all, active: 'bg-slate-800 text-white', dot: 'bg-white' },
          { key: 'RECEIPT', label: isAr ? 'سندات القبض' : 'Receipts', count: typeCounts.receipt, active: 'bg-emerald-600 text-white', dot: 'bg-white' },
          { key: 'PAYMENT', label: isAr ? 'سندات الدفع' : 'Payments', count: typeCounts.payment, active: 'bg-rose-600 text-white', dot: 'bg-white' },
        ] as const).map((t) => {
          const on = (typeFilter || 'ALL') === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTypeFilter(t.key)}
              className={`flex items-center gap-2 px-4 h-10 rounded-xl font-extrabold text-xs transition-all cursor-pointer border ${
                on ? `${t.active} border-transparent shadow-sm` : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {t.key === 'RECEIPT' && <IconArrowDownLeft size={15} className={on ? 'text-white' : 'text-emerald-600'} />}
              {t.key === 'PAYMENT' && <IconArrowUpRight size={15} className={on ? 'text-white' : 'text-rose-600'} />}
              <span>{t.label}</span>
              <span className={`min-w-[20px] px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                on ? 'bg-white/25' : 'bg-slate-100 text-slate-600'
              }`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 4. TOOLBAR & FILTERS ── */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Box */}
          <div className="relative w-72 min-w-[220px]">
            <IconSearch size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث برقم السند، الحساب، الصندوق...' : 'Search vouchers...'}
              className="w-full h-[36px] ps-9 pe-8 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white text-xs md:text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#F45A0A] focus:ring-2 focus:ring-[#F45A0A]/10 transition-all font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute top-1/2 -translate-y-1/2 end-2.5 text-slate-400 hover:text-slate-700 cursor-pointer font-black"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="w-52">
            <Select
              size="xs"
              radius="md"
              data={[
                { value: 'ALL', label: isAr ? 'جميع حالات التحصيل' : 'All Statuses' },
                { value: 'PENDING', label: isAr ? '⏳ معلقة قيد التحصيل' : 'Pending' },
                { value: 'SETTLED', label: isAr ? '✅ مؤكدة ومستلمة' : 'Settled' },
              ]}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val || 'ALL')}
            />
          </div>

          {/* Clear Filters */}
          {(searchQuery || activeCardFilter !== 'ALL' || typeFilter !== 'ALL' || statusFilter !== 'ALL' || showMainCashbox) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveCardFilter('ALL');
                setTypeFilter('ALL');
                setStatusFilter('ALL');
                setStartDate('');
                setEndDate('');
              }}
              className="h-[36px] px-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <IconFilterOff size={14} />
              <span>{isAr ? 'إلغاء التصفية' : 'Clear Filters'}</span>
            </button>
          )}
        </div>

        <div className="text-xs md:text-sm font-mono font-black text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
          {isAr ? `عرض ${filteredItems.length} من أصل ${allItems.length}` : `${filteredItems.length} of ${allItems.length}`}
        </div>
      </div>

      {/* ── 5. MAIN SETTLEMENT DATA TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-start border-collapse text-xs select-text whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-800 font-black text-xs md:text-sm h-[44px]">
                <th className="py-2.5 px-3.5 text-center w-40">{isAr ? 'تأكيد التحصيل' : 'Clearance Status'}</th>
                <th className="py-2.5 px-3.5 text-start w-32 font-mono">{isAr ? 'رقم السند' : 'Voucher No.'}</th>
                <th className="py-2.5 px-3.5 text-start min-w-[180px]">{isAr ? 'الصندوق الفرعي' : 'Source Cashbox'}</th>
                <th className="py-2.5 px-3.5 text-start min-w-[180px]">{isAr ? 'الحساب المقابل' : 'Account'}</th>
                <th className="py-2.5 px-3.5 text-end min-w-[150px] font-mono">{isAr ? 'المبلغ والعملة' : 'Amount'}</th>
                <th className="py-2.5 px-3.5 text-start min-w-[240px]">{isAr ? 'البيان والشرح' : 'Description'}</th>
                <th className="py-2.5 px-3.5 text-center w-24">{isAr ? 'الوصولات' : 'Slips'}</th>
                <th className="py-2.5 px-3.5 text-center w-28 font-mono">{isAr ? 'التاريخ' : 'Date'}</th>
                <th className="py-2.5 px-3.5 text-start min-w-[150px]">{isAr ? 'الموظف' : 'User'}</th>
                <th className="py-2.5 px-3.5 text-center w-20">{isAr ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-8 h-8 border-3 border-[#F45A0A] border-t-transparent rounded-full animate-spin" />
                      <span className="font-bold text-xs">{isAr ? 'جاري تحميل بيانات السندات والصناديق...' : 'Loading settlement data...'}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-500 font-bold text-xs">
                    {isAr ? 'لا توجد وصولات أو سندات مطابقة لشروط البحث والتصفية.' : 'No vouchers match the filters.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isConfirmed = item.isSettled;
                  const isBusy = processingId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors h-[48px] ${
                        isConfirmed
                          ? 'bg-emerald-50/40 hover:bg-emerald-50/70 text-slate-900'
                          : 'bg-white hover:bg-orange-50/30 text-slate-900'
                      }`}
                    >
                      {/* 1. Confirmation Toggle Switch */}
                      <td className="py-2.5 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* سند على القاصة الرئيسية أصلاً لا يُحصَّل — لا قيد توريد له،
                              فيُعطَّل تبديله ويوسَم «على الرئيسي» بدل تبديلٍ يكذب. */}
                          {item.isMainCashbox ? (
                            <span className="px-2 py-0.5 rounded-md text-[10.5px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                              {isAr ? 'على الصندوق الرئيسي' : 'On main cashbox'}
                            </span>
                          ) : (
                            <>
                              <Switch
                                size="sm"
                                color="emerald"
                                disabled={isBusy}
                                checked={isConfirmed}
                                onChange={(e) => handleToggleSettlement(item, e.currentTarget.checked)}
                                className="cursor-pointer"
                              />
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10.5px] font-black ${
                                  isConfirmed
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {isConfirmed ? (isAr ? 'مؤكد ومستلم' : 'Settled') : (isAr ? 'قيد التحصيل' : 'Pending')}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* 2. Voucher Number */}
                      <td className="py-2.5 px-3.5 font-mono">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            size="xs"
                            color={item.type === 'RECEIPT' ? 'emerald' : 'red'}
                            variant="light"
                            className="shrink-0 font-bold"
                          >
                            {item.type === 'RECEIPT' ? (isAr ? 'قبض' : 'RV') : (isAr ? 'دفع' : 'PV')}
                          </Badge>
                          <span className="font-black text-slate-950">{item.voucherNumber}</span>
                        </div>
                      </td>

                      {/* 3. Sub-Cashbox */}
                      <td className="py-2.5 px-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                              item.isMainCashbox ? 'bg-amber-500' : 'bg-[#F45A0A]'
                            }`}
                          />
                          <span className="truncate">{item.cashboxName}</span>
                        </div>
                      </td>

                      {/* 4. Opposing Account */}
                      <td className="py-2.5 px-3.5 font-bold text-slate-800 truncate">
                        {item.accountName}
                      </td>

                      {/* 5. Amount & Currency */}
                      <td className="py-2.5 px-3.5 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={`tabular-nums font-mono font-black text-xs md:text-sm ${
                              item.type === 'RECEIPT' ? 'text-emerald-800' : 'text-rose-800'
                            }`}
                          >
                            {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] font-bold font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-600">
                            {item.currency === 'USD' ? '$' : 'د.ع'}
                          </span>
                        </div>
                      </td>

                      {/* 6. Description */}
                      <td className="py-2.5 px-3.5 text-slate-600 truncate max-w-xs text-xs">
                        {item.description}
                      </td>

                      {/* 7. Slips Attachment Button */}
                      <td className="py-2.5 px-3.5 text-center">
                        {item.slipsCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSlipItem(item);
                              setSlipModalOpen(true);
                            }}
                            className="h-7 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-black text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <IconPaperclip size={12} />
                            <span>وصل ({item.slipsCount})</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* 8. English Date */}
                      <td className="py-2.5 px-3.5 text-center font-mono font-bold text-slate-700 text-xs">
                        {item.dateFormatted}
                      </td>

                      {/* 9. Responsible User */}
                      <td className="py-2.5 px-3.5 text-slate-700 truncate">
                        <div className="flex items-center gap-1.5 truncate font-medium">
                          <IconUser size={14} className="text-slate-400 shrink-0" />
                          <span className="truncate">{item.userName}</span>
                        </div>
                      </td>

                      {/* 10. Actions */}
                      <td className="py-2.5 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDetailItem(item);
                              setDrawerOpen(true);
                            }}
                            className="h-7 w-7 rounded-lg border border-slate-200 bg-white hover:bg-orange-50 hover:text-[#F45A0A] flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
                            title={isAr ? 'معاينة التفاصيل' : 'View Details'}
                          >
                            <IconEye size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDetailItem(item);
                              setTimeout(() => window.print(), 200);
                            }}
                            className="h-7 w-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                            title={isAr ? 'طباعة الإيصال' : 'Print Voucher'}
                          >
                            <IconPrinter size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 6. BATCH SETTLEMENT MODAL ── */}
      <Modal
        opened={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        title={
          <div className="flex items-center gap-2.5 font-black text-sm text-slate-900">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F45A0A] border border-orange-200 flex items-center justify-center shrink-0">
              <IconBuildingBank size={18} />
            </div>
            <span>
              {isAr ? 'تحصيل وتوريد الوصولات غير المؤكدة إلى قاصة الشركة الرئيسية' : 'Batch Settlement to Main HQ Cashbox'}
            </span>
          </div>
        }
        size="xl"
        centered
        radius="lg"
        dir={direction}
      >
        <div className="space-y-4 text-xs pt-1" dir={direction}>
          {/* Header Controls & Filter */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="font-bold text-slate-700">{isAr ? 'الصندوق:' : 'Cashbox:'}</label>
                <Select
                  size="xs"
                  radius="md"
                  data={[
                    { value: 'ALL', label: isAr ? 'جميع الصناديق الفرعية' : 'All Sub-Cashboxes' },
                    ...cashboxCards.filter((c) => !c.isMain).map((c) => ({
                      value: c.id,
                      label: `${c.nameAr} (${c.pendingCount} معلق)`,
                    })),
                  ]}
                  value={batchModalSelectedBoxId}
                  onChange={(val) => {
                    const nVal = val || 'ALL';
                    setBatchModalSelectedBoxId(nVal);
                    const unconf = allItems.filter((i) => {
                      if (i.isSettled) return false;
                      if (nVal !== 'ALL' && i.cashboxAccountId !== nVal) return false;
                      if (batchModalTypeFilter !== 'ALL' && i.type !== batchModalTypeFilter) return false;
                      return true;
                    });
                    setBatchSelectedVoucherIds(new Set(unconf.map((u) => u.id)));
                  }}
                  className="w-56"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="font-bold text-slate-700">{isAr ? 'النوع:' : 'Type:'}</label>
                <Select
                  size="xs"
                  radius="md"
                  data={[
                    { value: 'ALL', label: isAr ? 'الكل (قبض + دفع)' : 'All (Receipts + Payments)' },
                    { value: 'RECEIPT', label: isAr ? 'سندات القبض فقط' : 'Receipts' },
                    { value: 'PAYMENT', label: isAr ? 'سندات الدفع فقط' : 'Payments' },
                  ]}
                  value={batchModalTypeFilter}
                  onChange={(val) => {
                    const nVal = val || 'ALL';
                    setBatchModalTypeFilter(nVal);
                    const unconf = allItems.filter((i) => {
                      if (i.isSettled) return false;
                      if (batchModalSelectedBoxId !== 'ALL' && i.cashboxAccountId !== batchModalSelectedBoxId) return false;
                      if (nVal !== 'ALL' && i.type !== nVal) return false;
                      return true;
                    });
                    setBatchSelectedVoucherIds(new Set(unconf.map((u) => u.id)));
                  }}
                  className="w-48"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (batchSelectedVoucherIds.size === modalUnconfirmedVouchers.length) {
                  setBatchSelectedVoucherIds(new Set());
                } else {
                  setBatchSelectedVoucherIds(new Set(modalUnconfirmedVouchers.map((v) => v.id)));
                }
              }}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
            >
              {batchSelectedVoucherIds.size === modalUnconfirmedVouchers.length
                ? (isAr ? 'إلغاء تحديد الكل' : 'Deselect All')
                : (isAr ? 'تحديد كل الوصولات' : 'Select All')}
            </button>
          </div>

          {/* Table of Unconfirmed Vouchers */}
          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[360px] overflow-y-auto">
            <table className="w-full text-start border-collapse text-xs whitespace-nowrap">
              <thead className="sticky top-0 bg-slate-100/95 border-b border-slate-200 z-10 font-bold text-slate-800 text-[11.5px]">
                <tr>
                  <th className="p-2.5 w-10 text-center">#</th>
                  <th className="p-2.5 w-28 font-mono">{isAr ? 'رقم السند' : 'Voucher No.'}</th>
                  <th className="p-2.5 w-36">{isAr ? 'الصندوق الفرعي' : 'Source Cashbox'}</th>
                  <th className="p-2.5 w-36">{isAr ? 'الحساب المقابل' : 'Account'}</th>
                  <th className="p-2.5 w-32 text-end font-mono">{isAr ? 'المبلغ والعملة' : 'Amount'}</th>
                  <th className="p-2.5">{isAr ? 'البيان والشرح' : 'Description'}</th>
                  <th className="p-2.5 w-24 text-center font-mono">{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className="p-2.5 w-28">{isAr ? 'الموظف' : 'User'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {modalUnconfirmedVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-500 font-bold">
                      {isAr ? '🎉 لا توجد وصولات معلقة لهذا الصندوق. كل الوصولات محصلة بالكامل.' : 'No pending vouchers found.'}
                    </td>
                  </tr>
                ) : (
                  modalUnconfirmedVouchers.map((v) => {
                    const isChecked = batchSelectedVoucherIds.has(v.id);

                    return (
                      <tr
                        key={v.id}
                        onClick={() => {
                          setBatchSelectedVoucherIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(v.id)) next.delete(v.id);
                            else next.add(v.id);
                            return next;
                          });
                        }}
                        className={`cursor-pointer transition-colors ${
                          isChecked ? 'bg-orange-50/50 hover:bg-orange-50' : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            size="xs"
                            color="orange"
                            checked={isChecked}
                            onChange={(e) => {
                              const checked = e.currentTarget.checked;
                              setBatchSelectedVoucherIds((prev) => {
                                const next = new Set(prev);
                                if (checked) next.add(v.id);
                                else next.delete(v.id);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td className="p-2.5 font-mono font-black text-slate-900">{v.voucherNumber}</td>
                        <td className="p-2.5 font-bold text-slate-900">{v.cashboxName}</td>
                        <td className="p-2.5 text-slate-700 truncate">{v.accountName}</td>
                        <td className="p-2.5 text-end font-mono font-black text-slate-900">
                          {Number(v.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {v.currency}
                        </td>
                        <td className="p-2.5 text-slate-600 truncate max-w-xs">{v.description}</td>
                        <td className="p-2.5 text-center font-mono text-slate-700">{v.dateFormatted}</td>
                        <td className="p-2.5 text-slate-700 truncate">{v.userName}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Modal Footer Summary and Submit */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-700">
                {isAr ? 'الإجمالي المحدد للتحصيل:' : 'Selected Total:'}
              </span>
              <span className="font-mono font-black text-sm text-[#F45A0A]">
                {modalSelectedStats.totalIQD.toLocaleString()} د.ع
              </span>
              {modalSelectedStats.totalUSD > 0 && (
                <span className="font-mono font-black text-xs text-slate-700">
                  (${modalSelectedStats.totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={batchSubmitting || modalSelectedStats.count === 0}
                onClick={handleExecuteBatchSettlement}
                className="h-9 px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-black text-xs shadow-xs cursor-pointer disabled:opacity-50"
              >
                {batchSubmitting
                  ? (isAr ? 'جاري التحصيل...' : 'Clearing...')
                  : (isAr ? `تأكيد التحصيل والتوريد (${modalSelectedStats.count})` : `Confirm Clearance (${modalSelectedStats.count})`)}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── 7. SLIPS & ATTACHMENT MODAL ── */}
      <Modal
        opened={slipModalOpen}
        onClose={() => setSlipModalOpen(false)}
        title={<span className="font-black text-sm text-slate-900">{isAr ? 'مستندات وإيصالات الوصل المرفقة' : 'Attached Receipts & Slips'}</span>}
        size="md"
        centered
        radius="lg"
        dir={direction}
      >
        <div className="space-y-3.5 text-xs">
          {selectedSlipItem && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">{isAr ? 'رقم السند:' : 'Voucher No:'}</span>
                <span className="font-mono font-black text-slate-900">{selectedSlipItem.voucherNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">{isAr ? 'المبلغ:' : 'Amount:'}</span>
                <span className="font-mono font-black text-[#F45A0A]">
                  {Number(selectedSlipItem.amount).toLocaleString()} {selectedSlipItem.currency}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">{isAr ? 'الصندوق المصدر:' : 'Cashbox:'}</span>
                <span className="font-bold text-slate-900">{selectedSlipItem.cashboxName}</span>
              </div>
            </div>
          )}

          <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center space-y-2">
            <IconPaperclip size={32} className="mx-auto text-slate-400" />
            <p className="font-bold text-slate-700 text-xs">
              {isAr ? 'تم إرفاق وصل إلكتروني معتمد مع هذا السند المالي.' : 'Certified electronic receipt attached.'}
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setSlipModalOpen(false)}
              className="h-8 px-4 rounded-lg bg-[#F45A0A] text-white font-bold text-xs cursor-pointer"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── 8. DETAILS DRAWER ── */}
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={<span className="font-black text-base text-slate-900">{isAr ? 'تفاصيل السند المالي' : 'Voucher Details'}</span>}
        position="left"
        size="md"
        padding="lg"
      >
        {selectedDetailItem && (
          <div className="space-y-4 text-xs" dir={direction}>
            <div className="p-4 bg-orange-50/60 border border-orange-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-600">{isAr ? 'رقم السند' : 'Voucher Number'}</span>
                <span className="font-mono font-black text-sm text-[#F45A0A]">{selectedDetailItem.voucherNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-600">{isAr ? 'نوع السند' : 'Type'}</span>
                <Badge size="xs" color={selectedDetailItem.type === 'RECEIPT' ? 'emerald' : 'red'}>
                  {selectedDetailItem.typeLabel}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-600">{isAr ? 'المبلغ' : 'Amount'}</span>
                <span className="font-mono font-black text-sm text-slate-950">
                  {Number(selectedDetailItem.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {selectedDetailItem.currency}
                </span>
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">{isAr ? 'الصندوق المصدر' : 'Source Cashbox'}</span>
                <span className="font-bold text-slate-900">{selectedDetailItem.cashboxName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">{isAr ? 'الحساب المقابل' : 'Opposing Account'}</span>
                <span className="font-bold text-slate-900">{selectedDetailItem.accountName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">{isAr ? 'التاريخ' : 'Date'}</span>
                <span className="font-mono font-bold text-slate-800">{selectedDetailItem.dateFormatted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">{isAr ? 'الموظف المسؤول' : 'Responsible User'}</span>
                <span className="font-bold text-slate-800">{selectedDetailItem.userName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">{isAr ? 'حالة التحصيل' : 'Status'}</span>
                <Badge size="xs" color={selectedDetailItem.isSettled ? 'emerald' : 'orange'}>
                  {selectedDetailItem.isSettled ? (isAr ? 'مؤكد ومستلم' : 'Settled') : (isAr ? 'قيد التحصيل' : 'Pending')}
                </Badge>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="text-slate-500 font-bold block">{isAr ? 'البيان والشرح المحاسبي:' : 'Description:'}</span>
              <p className="text-slate-800 font-medium text-xs leading-relaxed">{selectedDetailItem.description}</p>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── تحذير رفع تأكيد التحصيل ── */}
      <Modal
        opened={revertTarget !== null}
        onClose={() => !revertBusy && setRevertTarget(null)}
        centered
        radius="lg"
        withCloseButton={false}
        size="md"
      >
        {revertTarget && (
          <div className="space-y-4 text-slate-900" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <IconAlertTriangle size={22} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm">
                  {isAr ? 'رفع تأكيد التحصيل؟' : 'Revert this settlement?'}
                </h3>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  {revertTarget.voucherNumber} — {Number(revertTarget.amount).toLocaleString('en-US')}{' '}
                  {revertTarget.currency}
                </p>
              </div>
            </div>

            <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3 text-[11.5px] font-medium leading-relaxed text-rose-900">
              {isAr ? (
                <>
                  سيؤدي هذا إلى <b>حذف قيد التوريد المحاسبي</b> الخاص بهذا السند من القيود
                  اليومية، و<b>إعادة المبلغ</b> من صندوق الشركة الرئيسي إلى الصندوق الفرعي [
                  {revertTarget.cashboxName}]، ويعود السند إلى حالة «قيد التحصيل».
                </>
              ) : (
                <>
                  This deletes the posted clearance journal entry and moves the amount back from
                  the main cashbox to [{revertTarget.cashboxName}]; the voucher returns to
                  pending collection.
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={revertBusy}
                onClick={() => setRevertTarget(null)}
                className="h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-extrabold text-xs cursor-pointer disabled:opacity-50"
              >
                {isAr ? 'إبقاء التحصيل' : 'Keep settled'}
              </button>
              <button
                type="button"
                disabled={revertBusy}
                onClick={async () => {
                  const target = revertTarget;
                  setRevertBusy(true);
                  try {
                    await performToggleSettlement(target, false);
                  } finally {
                    setRevertBusy(false);
                    setRevertTarget(null);
                  }
                }}
                className="h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {revertBusy && <Loader size={14} color="white" />}
                {isAr ? 'نعم، ارفع التأكيد' : 'Yes, revert'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
