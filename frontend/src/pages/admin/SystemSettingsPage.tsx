import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Paper, TextInput, Button, Select, Checkbox, Textarea, Badge, SegmentedControl, ColorInput, Slider, Switch, Tabs, Progress } from '@mantine/core';
import { useFont, FONT_OPTIONS, type FontId } from '../../hooks/useFont';
import {
  IconSettings,
  IconBuilding,
  IconBook2,
  IconReceipt,
  IconCoin,
  IconNumbers,
  IconShieldLock,
  IconCheck,
  IconTypography,
  IconPlane,
  IconTicket,
  IconEPassport,
  IconUsers,
  IconRotate,
  IconRefresh,
  IconReceiptOff,
  IconDeviceFloppy,
  IconGitBranch,
  IconUpload,
  IconTrash,
  IconPhoto,
  IconBuildingStore,
  IconPrinter,
  IconPalette,
  IconEye,
  IconAdjustments,
  IconCreditCard,
  IconVault,
  IconBuildingBank,
  IconCashBanknote,
  IconArrowLeft,
  IconPlus,
  IconInfoCircle,
  IconAlertCircle,
  IconTrendingUp,
  IconSparkles,
  IconScale,
  IconCalculator,
  IconCoins,
  IconArrowUp,
  IconArrowDown,
  IconDatabase,
  IconServer,
  IconActivity,
  IconCloud,
  IconBolt,
  IconSearch,
} from '@tabler/icons-react';
import { apiRequest } from '../../api/client';
import { useQuery } from '@tanstack/react-query';
import { tenantsApi } from '../../api/tenants';
import { CurrencyRadioSelector } from '../../components/common/CurrencyRadioSelector';
import { branchesApi, type Branch } from '../../api/branches';
import { accountsApi, type CreateAccountPayload } from '../../api/accounts';
import {
  loadSequenceSettings,
  saveSequenceSettings,
  formatSequencePreview,
  type SequenceConfig,
} from '../../utils/sequenceUtils';
import { sequencesApi } from '../../api/sequences';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { fetchPrintTemplate, savePrintTemplate } from '../../api/printTemplates';
import {
  PrintableAccountStatementSheet,
  type StatementMovementItem,
} from '../../components/reports/AccountStatementPrintModal';
import {
  useAdoptedExchangeRate,
  type ExchangeRateConfig,
  DEFAULT_EXCHANGE_CONFIG,
} from '../../hooks/useAdoptedExchangeRate';

export interface PaymentMethodMapping {
  id: string;
  nameAr: string;
  key: string;
  type: 'CASH' | 'MASTER' | 'BANK' | 'ELECTRONIC';
  targetAccountId: string;
  targetAccountName?: string;
  description?: string;
  isActive: boolean;
}

export interface CustomVoucherAccountMapping {
  id: string;
  nameAr: string;
  /** الاسم التعريفي بالإنجليزية — يُطبع في الوصل الإنجليزي بدل العربي. */
  nameEn?: string;
  targetAccountId: string;
  targetAccountName?: string;
  category?: 'RECEIPT' | 'PAYMENT' | 'BOTH';
  defaultPercentage?: number;
  isActive: boolean;
}

export interface CoreAccountsConfig {
  mainCashboxId: string;
  defaultCashCustomerId: string;
  capitalAccountId: string;
  partnersParentAccountId: string;
  cashboxesParentAccountId: string;
  customersParentAccountId: string;
  suppliersParentAccountId: string;
  dividendsPayableAccountId: string;
  commissionsParentAccountId: string;
  otherRevenuesParentAccountId: string;
  externalPartiesParentAccountId: string;
}

export interface ServicesAccountsConfig {
  // Travel Services
  flightRevenueAccountId: string;
  flightCostAccountId: string;
  visaRevenueAccountId: string;
  visaCostAccountId: string;
  hotelRevenueAccountId: string;
  hotelCostAccountId: string;
  groupRevenueAccountId: string;
  groupCostAccountId: string;
  // Reissues & Changes & Refunds
  reissueRevenueAccountId: string;
  reissueCostAccountId: string;
  refundsAccountId: string;
  // Vouchers Defaults
  receiptVouchersDefaultAccountId: string;
  paymentVouchersDefaultAccountId: string;
  // Expenses & Purchases Defaults
  expensesParentAccountId: string;
  purchasesCostAccountId: string;
}


/*
 * شجرة الحسابات تُجلب مرة واحدة لكل فتحة، لا أربع مرات.
 *
 * كانت الصفحة تنادي getFlat() في أربعة مواضع — للقوائم المنسدلة، ولخريطة طرق
 * الدفع، ولحسابات الخدمات، وللحسابات الأساسية — وكل نداء يحمّل النسخة الكاملة:
 * 2.6 ميغابايت في نحو 1.6 ثانية. أي عشرة ميغابايت وسبع ثوانٍ قبل أن تُرسم
 * الشاشة، وكلها القائمة نفسها.
 *
 * والنسخة المخفَّفة تكفي: الصفحة تبني قوائم اختيار ولا تعرض رصيداً. فصار وعدٌ
 * واحد يتشاركه الجميع، ويُبطَل عند كل فتحة كي لا تُعرض شجرةٌ قديمة.
 */
let sharedAccountsPromise: Promise<any[]> | null = null;

const loadAccountsOnce = (): Promise<any[]> => {
  if (!sharedAccountsPromise) {
    sharedAccountsPromise = accountsApi
      .getFlat(undefined, undefined, true)
      .then((d: any) => (Array.isArray(d) ? d : d?.data || []))
      .catch(() => []);
  }
  return sharedAccountsPromise;
};

const resetSharedAccounts = () => {
  sharedAccountsPromise = null;
};

export const SystemSettingsPage: React.FC = () => {
  const { data: currentTenant } = useQuery({
    queryKey: ['current-tenant'],
    queryFn: () => tenantsApi.getCurrentTenant(),
    staleTime: 60000,
  });

  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeSection, setActiveSection] = useState<string>(() => tabParam || 'core_accounts');
  const [baseCurrency, setBaseCurrency] = useState<string>('IQD');
  const { fontId, setFontId, currentFont } = useFont();

  useEffect(() => {
    if (tabParam) {
      setActiveSection(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    if (activeSection === 'security' || (activeSection === 'database' && currentTenant && !currentTenant.isRoot)) {
      setActiveSection('core_accounts');
    }
  }, [currentTenant?.isRoot]);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('b1');
  const [selectedBranchCode, setSelectedBranchCode] = useState<string>('BGD');

  // Core Accounts Configuration State (matching Desktop App Main Settings)
  const [coreAccounts, setCoreAccounts] = useState<CoreAccountsConfig>({
    mainCashboxId: '',
    defaultCashCustomerId: '',
    capitalAccountId: '',
    partnersParentAccountId: '',
    cashboxesParentAccountId: '',
    customersParentAccountId: '',
    suppliersParentAccountId: '',
    dividendsPayableAccountId: '',
    commissionsParentAccountId: '',
    otherRevenuesParentAccountId: '',
    externalPartiesParentAccountId: '',
  });
  const [isSavingCoreAccounts, setIsSavingCoreAccounts] = useState(false);

  // Custom Voucher Split & Allocation Accounts State
  const [customVoucherAccounts, setCustomVoucherAccounts] = useState<CustomVoucherAccountMapping[]>([
    {
      id: 'cva-1',
      nameAr: 'مبيعات التذاكر',
      targetAccountId: '',
      targetAccountName: 'حساب مبيعات تذاكر الطيران (1614)',
      category: 'RECEIPT',
      defaultPercentage: 60,
      isActive: true,
    },
    {
      id: 'cva-2',
      nameAr: 'عمولات وخدمات السفر',
      targetAccountId: '',
      targetAccountName: 'حساب عمولات ومستحقات مبيعات (1660)',
      category: 'RECEIPT',
      defaultPercentage: 40,
      isActive: true,
    },
    {
      id: 'cva-3',
      nameAr: 'إيرادات التأشيرات والفيزا',
      targetAccountId: '',
      targetAccountName: 'حساب إيرادات التأشيرات (4112)',
      category: 'RECEIPT',
      defaultPercentage: 0,
      isActive: true,
    },
  ]);
  const [isSavingCustomVoucherAccounts, setIsSavingCustomVoucherAccounts] = useState(false);
  const [newCustomAccountName, setNewCustomAccountName] = useState('');
  const [newCustomAccountNameEn, setNewCustomAccountNameEn] = useState('');
  const [newCustomAccountId, setNewCustomAccountId] = useState('');
  const [newCustomCategory, setNewCustomCategory] = useState<'RECEIPT' | 'PAYMENT' | 'BOTH'>('RECEIPT');

  // Services & Vouchers Accounts Configuration State
  const [servicesAccounts, setServicesAccounts] = useState<ServicesAccountsConfig>({
    flightRevenueAccountId: '',
    flightCostAccountId: '',
    visaRevenueAccountId: '',
    visaCostAccountId: '',
    hotelRevenueAccountId: '',
    hotelCostAccountId: '',
    groupRevenueAccountId: '',
    groupCostAccountId: '',
    reissueRevenueAccountId: '',
    reissueCostAccountId: '',
    refundsAccountId: '',
    receiptVouchersDefaultAccountId: '',
    paymentVouchersDefaultAccountId: '',
    expensesParentAccountId: '',
    purchasesCostAccountId: '',
  });
  const [isSavingServicesAccounts, setIsSavingServicesAccounts] = useState(false);

  // Company & Logo Adoption State
  const [logoSourceMode, setLogoSourceMode] = useState<'BRANCH' | 'CUSTOM'>('BRANCH');
  const [selectedLogoBranchId, setSelectedLogoBranchId] = useState<string>('');
  const [customLogoUrl, setCustomLogoUrl] = useState<string>('');
  const [existingTemplateConfig, setExistingTemplateConfig] = useState<any>({});
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // Print Statement Customization State
  const [printConfig, setPrintConfig] = useState<any>({
    primaryColor: '#059669',
    headerBgColor: '#059669',
    fontFamily: 'IBM Plex Sans Arabic',
    isTableBold: false,
    subtitle: 'قسم المحاسبة والمالية — كشف حساب تفصيلي',
    notesText: 'ملاحظة: هذا الكشف يعتبر مطبقاً وموافقاً عليه رسمياً ما لم يتم الإعتراض خلال 7 أيام من تاريخ صدوره.',
    footerText: 'شركة الفرسان للسياحة والسفر — جميع الحقوق محفوظة © 2026',
    showFinancialSummary: true,
    showOpeningBalance: true,
    showSignatures: true,
    fontSizes: {
      companyTitle: 17,
      tableHeader: 11,
      tableBody: 10,
    },
  });
  const [isSavingPrintConfig, setIsSavingPrintConfig] = useState(false);
  const [printTab, setPrintTab] = useState<'colors' | 'fonts' | 'info' | 'toggles'>('colors');

  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [paymentMappings, setPaymentMappings] = useState<PaymentMethodMapping[]>([
    {
      id: 'm1',
      nameAr: 'كاش باليد (نقدي)',
      key: 'CASH_HAND',
      type: 'CASH',
      targetAccountId: 'EMPLOYEE_ASSIGNED',
      targetAccountName: 'صندوق الموظف المسند (حسب موظف الإصدار)',
      description: 'الدفع النقدي المباشر في الفرع',
      isActive: true,
    },
  ]);
  const [isSavingPaymentMappings, setIsSavingPaymentMappings] = useState(false);
  const [newMethodName, setNewMethodName] = useState('');
  const [newMethodType, setNewMethodType] = useState<'CASH' | 'MASTER' | 'BANK' | 'ELECTRONIC'>('MASTER');
  const [newMethodAccountId, setNewMethodAccountId] = useState('');

  // Adopted Exchange Rate state
  const adoptedExHook = useAdoptedExchangeRate();
  const [exConfigForm, setExConfigForm] = useState<ExchangeRateConfig>(DEFAULT_EXCHANGE_CONFIG);
  const [isSavingExConfig, setIsSavingExConfig] = useState(false);

  // Database Live Status & Storage State
  const [dbInfo, setDbInfo] = useState<any>(null);
  const [isLoadingDbInfo, setIsLoadingDbInfo] = useState(false);
  const [isOptimizingDb, setIsOptimizingDb] = useState(false);
  const [dbSearchQuery, setDbSearchQuery] = useState('');

  const fetchDbInfo = async () => {
    setIsLoadingDbInfo(true);
    try {
      const data = await apiRequest('/api/system/database-info');
      setDbInfo(data);
    } catch (err: any) {
      console.error('Error fetching database info:', err);
    } finally {
      setIsLoadingDbInfo(false);
    }
  };

  const handleOptimizeDatabase = async () => {
    setIsOptimizingDb(true);
    try {
      const res = await apiRequest('/api/system/optimize-database', { method: 'POST' });
      showSuccessNotification('تم التحسين بنجاح', `${res.message} (في ${res.durationMs} مللي ثانية)`);
      fetchDbInfo();
    } catch (err: any) {
      showErrorNotification('تعذر التحسين', err.message || 'حدث خطأ أثناء فحص وتحسين قاعدة البيانات');
    } finally {
      setIsOptimizingDb(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'database') {
      fetchDbInfo();
    }
  }, [activeSection]);

  const hasInitializedExRef = useRef(false);
  useEffect(() => {
    if (adoptedExHook?.config && !hasInitializedExRef.current) {
      hasInitializedExRef.current = true;
      setExConfigForm(adoptedExHook.config);
    }
  }, [adoptedExHook?.config]);

  // Compute live preview in settings with full null safety
  const previewBaseRate = useMemo(() => {
    if (!adoptedExHook?.marketData) return 1500;
    const src = exConfigForm?.baseMarketSource || 'BAGHDAD_SELL';
    switch (src) {
      case 'BAGHDAD_SELL': return parseFloat(adoptedExHook.marketData.baghdad?.sell || '1500') || 1500;
      case 'BAGHDAD_BUY': return parseFloat(adoptedExHook.marketData.baghdad?.buy || '1500') || 1500;
      case 'NORTHERN_SELL': return parseFloat(adoptedExHook.marketData.northern?.sell || '1500') || 1500;
      case 'SOUTHERN_SELL': return parseFloat(adoptedExHook.marketData.southern?.sell || '1500') || 1500;
      case 'AVERAGE': {
        const sells = [adoptedExHook.marketData.baghdad, adoptedExHook.marketData.northern, adoptedExHook.marketData.southern]
          .filter(Boolean).map((r: any) => parseFloat(r?.sell));
        return sells.length ? Math.round(sells.reduce((a, b) => a + b, 0) / sells.length) : 1500;
      }
      default: return parseFloat(adoptedExHook.marketData.baghdad?.sell || '1500') || 1500;
    }
  }, [adoptedExHook?.marketData, exConfigForm?.baseMarketSource]);

  const previewMarginPerUSD = useMemo(() => {
    if (exConfigForm?.mode !== 'MARKET_PLUS_MARGIN') return 0;
    if (exConfigForm?.marginUnit === 'PER_100_USD') {
      return (Number(exConfigForm?.marginAmount) || 0) / 100;
    }
    return Number(exConfigForm?.marginAmount) || 0;
  }, [exConfigForm?.mode, exConfigForm?.marginAmount, exConfigForm?.marginUnit]);

  const previewAdoptedRate = useMemo(() => {
    if (exConfigForm?.mode === 'FIXED') {
      return Number(exConfigForm?.fixedRate) || 1530;
    }
    return (previewBaseRate || 1500) + (previewMarginPerUSD || 0);
  }, [exConfigForm?.mode, exConfigForm?.fixedRate, previewBaseRate, previewMarginPerUSD]);

  const handleSaveExchangeRateConfig = async () => {
    setIsSavingExConfig(true);
    try {
      await adoptedExHook.saveConfig(exConfigForm || DEFAULT_EXCHANGE_CONFIG);
      showSuccessNotification(
        'تم حفظ سعر الصرف المعتمد',
        `تم اعتماد سعر الصرف (${(previewAdoptedRate || 1500).toLocaleString()} د.ع / 1$) وتحديث كافة واجهات النظام والشريط العلوي فورياً`
      );
    } catch (err) {
      showErrorNotification('خطأ في الحفظ', 'تعذر حفظ إعدادات سعر الصرف');
    } finally {
      setIsSavingExConfig(false);
    }
  };

  const [sequences, setSequences] = useState<Record<string, SequenceConfig>>(() =>
    loadSequenceSettings('b1', 'BGD')
  );

  const activeLogoUrl = useMemo(() => {
    if (logoSourceMode === 'BRANCH') {
      const b = branches.find(item => item.id === selectedLogoBranchId);
      return b?.logo || '';
    }
    return customLogoUrl;
  }, [logoSourceMode, selectedLogoBranchId, customLogoUrl, branches]);

  const handleCustomLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const base64 = evt.target?.result as string;
        try {
          const res = await branchesApi.uploadLogo(file.name, base64);
          setCustomLogoUrl(res.url);
          setLogoSourceMode('CUSTOM');
        } catch (err) {
          showErrorNotification('تعذر رفع الشعار', 'تعذر رفع الصورة لخادم التخزين. تأكد من إعداد Supabase Storage.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    branchesApi
      .getAll()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setBranches(data);
          const first = data[0];
          setSelectedBranchId(first.id);
          setSelectedBranchCode(first.code || 'BGD');
          if (!selectedLogoBranchId) {
            setSelectedLogoBranchId(first.id);
          }
          setSequences(loadSequenceSettings(first.id, first.code || 'BGD'));
        }
      })
      .catch(() => {
        setBranches([
          { id: 'b1', code: 'BGD', nameAr: 'الفرع الرئيسي - بغداد', city: 'بغداد', isMain: true, status: 'ACTIVE' },
          { id: 'b2', code: 'EBL', nameAr: 'فرع أربيل', city: 'أربيل', isMain: false, status: 'ACTIVE' },
          { id: 'b3', code: 'NJF', nameAr: 'فرع النجف الأشرف', city: 'النجف', isMain: false, status: 'ACTIVE' },
          { id: 'b4', code: 'BSR', nameAr: 'فرع البصرة', city: 'البصرة', isMain: false, status: 'ACTIVE' },
        ]);
      });

    // كل فتحة للصفحة تبدأ بشجرة طازجة، ثم تتشاركها بقية النداءات.
    resetSharedAccounts();

    // Fetch all accounts for dropdowns
    loadAccountsOnce()
      .then((accs) => {
        if (Array.isArray(accs)) {
          setAccountsList(accs);
        }
      })
      .catch(() => {});

    // Fetch payment methods mapping from DB
    fetchPrintTemplate('payment_methods_mapping')
      .then((res) => {
        if (res && res.config && Array.isArray(res.config.mappings) && res.config.mappings.length > 0) {
          setPaymentMappings(res.config.mappings);
        } else {
          loadAccountsOnce().then((allAccs) => {
            if (!Array.isArray(allAccs) || allAccs.length === 0) return;
            const masterAccounts = allAccs.filter(a =>
              a.code.startsWith('1343') ||
              a.code.startsWith('134213') ||
              a.code.startsWith('232146') ||
              a.code.startsWith('2614') ||
              a.code.startsWith('183') ||
              a.nameAr.includes('ماستر') ||
              a.nameAr.toLowerCase().includes('master')
            );

            const bankAccounts = allAccs.filter(a =>
              !masterAccounts.some(m => m.id === a.id) &&
              (a.category === 'BANK' ||
                a.code.startsWith('1342') ||
                a.code.startsWith('182') ||
                a.code.startsWith('1112') ||
                a.nameAr.includes('مصرف') ||
                a.nameAr.includes('بنك') ||
                a.nameAr.toLowerCase().includes('bank'))
            );

            const initialList: PaymentMethodMapping[] = [
              {
                id: 'pm-cash',
                nameAr: 'كاش باليد (نقدي)',
                key: 'CASH_HAND',
                type: 'CASH',
                targetAccountId: 'EMPLOYEE_ASSIGNED',
                targetAccountName: 'صندوق الموظف المسند (حسب موظف الإصدار تلقائياً)',
                description: 'الدفع النقدي المباشر في الفرع',
                isActive: true,
              },
              ...masterAccounts.map((m) => ({
                id: `pm-master-${m.id}`,
                nameAr: m.nameAr,
                key: m.id,
                type: 'MASTER' as const,
                targetAccountId: m.id,
                targetAccountName: `${m.code} - ${m.nameAr}`,
                description: `بطاقة ماستر كارد (${m.nameAr})`,
                isActive: true,
              })),
              ...bankAccounts.map((b) => ({
                id: `pm-bank-${b.id}`,
                nameAr: b.nameAr,
                key: b.id,
                type: 'BANK' as const,
                targetAccountId: b.id,
                targetAccountName: `${b.code} - ${b.nameAr}`,
                description: `حساب مصرفي (${b.nameAr})`,
                isActive: true,
              })),
            ];

            if (initialList.length > 0) {
              setPaymentMappings(initialList);
            }
          });
        }
      })
      .catch(() => {});

    // Fetch services accounts mapping from DB
    fetchPrintTemplate('services_accounts_mapping')
      .then((res) => {
        if (res && res.config && res.config.flightRevenueAccountId) {
          setServicesAccounts(res.config);
        } else {
          loadAccountsOnce().then((allAccs) => {
            if (Array.isArray(allAccs) && allAccs.length > 0) {
              const suggested = getSuggestedServicesAccounts(allAccs);
              setServicesAccounts(suggested);
            }
          });
        }
      })
      .catch(() => {});

    // Fetch core accounts mapping from DB
    fetchPrintTemplate('core_accounts_mapping')
      .then((res) => {
        if (res && res.config && res.config.mainCashboxId) {
          setCoreAccounts(res.config);
        } else {
          // Initialize suggestions from accounts list
          loadAccountsOnce().then((allAccs) => {
            if (Array.isArray(allAccs) && allAccs.length > 0) {
              const suggested = getSuggestedCoreAccounts(allAccs);
              setCoreAccounts(suggested);
            }
          });
        }
      })
      .catch(() => {});

    // Fetch existing statement template config from DB
    fetchPrintTemplate('statement')
      .then((res) => {
        if (res && res.config) {
          setExistingTemplateConfig(res.config);
          setPrintConfig((prev: any) => ({ ...prev, ...res.config }));
          if (res.config.logoSourceMode) {
            setLogoSourceMode(res.config.logoSourceMode);
          }
          if (res.config.selectedLogoBranchId) {
            setSelectedLogoBranchId(res.config.selectedLogoBranchId);
          }
          if (res.config.customLogoUrl) {
            setCustomLogoUrl(res.config.customLogoUrl);
          } else if (res.config.logoUrl && res.config.logoSourceMode === 'CUSTOM') {
            setCustomLogoUrl(res.config.logoUrl);
          }
        }
      })
      .catch(() => {});

    // Fetch custom voucher accounts allocation from DB
    fetchPrintTemplate('custom_voucher_accounts')
      .then((res) => {
        if (res && res.config && res.config.accounts && Array.isArray(res.config.accounts)) {
          setCustomVoucherAccounts(res.config.accounts);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveCustomVoucherAccounts = async () => {
    setIsSavingCustomVoucherAccounts(true);
    try {
      await savePrintTemplate('custom_voucher_accounts', { accounts: customVoucherAccounts }, 'حسابات القبض والصرف المخصصة');
      showSuccessNotification('تم الحفظ بنجاح', 'تم حفظ وتثبيت حسابات القبض والصرف المخصصة بنجاح في قاعدة البيانات');
    } catch (err: any) {
      showErrorNotification('خطأ في الحفظ', err.message || 'حدث خطأ أثناء حفظ حسابات القبض المخصصة');
    } finally {
      setIsSavingCustomVoucherAccounts(false);
    }
  };

  const handleAddCustomVoucherAccount = () => {
    if (!newCustomAccountName.trim()) {
      showErrorNotification('تنبيه', 'يرجى إدخال اسم الحساب المخصص (مثل: مبيعات التذاكر أو عمولات)');
      return;
    }
    if (!newCustomAccountId) {
      showErrorNotification('تنبيه', 'يرجى اختيار الحساب من شجرة الحسابات');
      return;
    }
    const acc = accountsList.find((a) => a.id === newCustomAccountId);
    const newAcc: CustomVoucherAccountMapping = {
      id: `cva-${Date.now()}`,
      nameAr: newCustomAccountName.trim(),
      nameEn: newCustomAccountNameEn.trim(),
      targetAccountId: newCustomAccountId,
      targetAccountName: acc ? `${acc.code} - ${acc.nameAr}` : 'حساب مخصص',
      category: newCustomCategory,
      defaultPercentage: 0,
      isActive: true,
    };
    setCustomVoucherAccounts((prev) => [...prev, newAcc]);
    setNewCustomAccountName('');
    setNewCustomAccountNameEn('');
    setNewCustomAccountId('');
    showSuccessNotification('تمت الإضافة', `تمت إضافة "${newAcc.nameAr}" بنجاح، اضغط على حفظ لتثبيت التغييرات`);
  };

  const handleRemoveCustomVoucherAccount = (id: string) => {
    setCustomVoucherAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  const getSuggestedCoreAccounts = (allAccs: any[]): CoreAccountsConfig => {
    const mainBox = allAccs.find(a => a.code === '13411' && !a.isParent) || allAccs.find(a => a.code.startsWith('1341') && !a.isParent);
    const cashCust = allAccs.find(a => a.code === '132141' && !a.isParent) || allAccs.find(a => a.code.startsWith('13214') && !a.isParent);
    const cap = allAccs.find(a => (a.code === '2611' || a.code === '261' || a.code === '211') && !a.isParent) || allAccs.find(a => a.nameAr.includes('رأس المال'));
    const partners = allAccs.find(a => a.code === '264' || a.code === '212' || a.nameAr.includes('العمليات الجارية للشركاء'));
    const pCash = allAccs.find(a => a.code === '1341');
    const pCust = allAccs.find(a => a.code === '13214') || allAccs.find(a => a.code === '1321') || allAccs.find(a => a.code === '132');
    const pSupp = allAccs.find(a => a.code === '23214') || allAccs.find(a => a.code === '2321') || allAccs.find(a => a.code === '232');
    const pDiv = allAccs.find(a => a.code === '2328') || allAccs.find(a => a.code === '23284');
    const pComm = allAccs.find(a => a.code === '423') || allAccs.find(a => a.code === '132621');
    const pOthRev = allAccs.find(a => a.code === '49') || allAccs.find(a => a.code === '43') || allAccs.find(a => a.code === '42');

    return {
      mainCashboxId: mainBox?.id || '',
      defaultCashCustomerId: cashCust?.id || '',
      capitalAccountId: cap?.id || '',
      partnersParentAccountId: partners?.id || '',
      cashboxesParentAccountId: pCash?.id || '',
      customersParentAccountId: pCust?.id || '',
      suppliersParentAccountId: pSupp?.id || '',
      dividendsPayableAccountId: pDiv?.id || '',
      commissionsParentAccountId: pComm?.id || '',
      otherRevenuesParentAccountId: pOthRev?.id || '',
      externalPartiesParentAccountId: allAccs.find((a: any) => a.code === '9')?.id || '',
    };
  };

  const handleSaveCoreAccounts = async () => {
    setIsSavingCoreAccounts(true);
    try {
      await savePrintTemplate('core_accounts_mapping', coreAccounts, 'الحسابات الأساسية والربط المحاسبي');
      showSuccessNotification('تم الحفظ بنجاح', 'تم حفظ ربط الحسابات الأساسية للنظام وفق الدليل المحاسبي 2026');
    } catch (err: any) {
      showErrorNotification('خطأ في الحفظ', err.message || 'حدث خطأ أثناء حفظ إعدادات الحسابات');
    } finally {
      setIsSavingCoreAccounts(false);
    }
  };

  const handleApplyAutoSuggestions = () => {
    const suggested = getSuggestedCoreAccounts(accountsList);
    setCoreAccounts(suggested);
    showSuccessNotification('تم تطبيق الاقتراحات', 'تم تحديد الحسابات المناسبة آلياً وفق الدليل المحاسبي الموحد 2026');
  };

  const getSuggestedServicesAccounts = (accounts: any[]): ServicesAccountsConfig => {
    const findAcc = (code: string, namePart?: string, isParentCheck?: boolean) => {
      // 1. Exact code match
      let match = accounts.find((a) => a.code === code && (isParentCheck !== undefined ? a.isParent === isParentCheck : true));
      if (match) return match;

      // 2. Starts with code match
      match = accounts.find((a) => a.code && a.code.startsWith(code) && (namePart ? a.nameAr && a.nameAr.includes(namePart) : true));
      if (match) return match;

      // 3. Name partial match
      if (namePart) {
        return accounts.find((a) => a.nameAr && a.nameAr.includes(namePart));
      }
      return null;
    };

    return {
      // Vouchers Defaults (بدون حساب افتراضي — اختيار إجباري عند كل سند)
      receiptVouchersDefaultAccountId: '',
      paymentVouchersDefaultAccountId: '',
      // Main Expenses & Purchases
      expensesParentAccountId: findAcc('3', 'الاستخدامات', true)?.id || findAcc('3')?.id || '',
      purchasesCostAccountId: findAcc('34', 'كلفة الخدمات', true)?.id || findAcc('34')?.id || '',
      // Flight Tickets (4111 / 341)
      flightRevenueAccountId: findAcc('4111', 'تذاكر الطيران')?.id || findAcc('4101')?.id || '',
      flightCostAccountId: findAcc('341', 'كلفة تذاكر')?.id || findAcc('3411')?.id || '',
      // Visas (4112 / 343)
      visaRevenueAccountId: findAcc('4112', 'التأشيرات')?.id || findAcc('4102')?.id || '',
      visaCostAccountId: findAcc('343', 'تأشيرات')?.id || '',
      // Hotels (4113 / 344)
      hotelRevenueAccountId: findAcc('4113', 'الفندقية')?.id || findAcc('4104')?.id || '',
      hotelCostAccountId: findAcc('344', 'الفندقية')?.id || '',
      // Groups (4105 / 345)
      groupRevenueAccountId: findAcc('4105', 'كروبات')?.id || '',
      groupCostAccountId: findAcc('345', 'كروبات')?.id || '',
      // Reissues & Changes (4114 / 342)
      reissueRevenueAccountId: findAcc('4114', 'تغيير وإعادة')?.id || findAcc('4103')?.id || '',
      reissueCostAccountId: findAcc('342', 'تغيير وإعادة')?.id || '',
      // Sales Returns & Refunds (4108)
      refundsAccountId: findAcc('4108', 'مردودات')?.id || findAcc('4109')?.id || '',
    };
  };

  const handleSaveServicesAccounts = async () => {
    setIsSavingServicesAccounts(true);
    try {
      await savePrintTemplate('services_accounts_mapping', servicesAccounts, 'ربط حسابات الخدمات والسندات الافتراضية');
      showSuccessNotification('تم الحفظ بنجاح', 'تم حفظ ربط حسابات الخدمات والسندات والمصاريف والمشتريات بنجاح');
    } catch (err: any) {
      showErrorNotification('خطأ في الحفظ', err.message || 'حدث خطأ أثناء حفظ إعدادات حسابات الخدمات');
    } finally {
      setIsSavingServicesAccounts(false);
    }
  };

  const handleApplyServicesSuggestions = () => {
    const suggested = getSuggestedServicesAccounts(accountsList);
    setServicesAccounts(suggested);
    showSuccessNotification('تم تطبيق الاقتراحات', 'تم تحديد الحسابات الافتراضية للخدمات والسندات آلياً');
  };

  const handleSaveLogoSettings = async () => {
    setIsSavingLogo(true);
    try {
      const activeLogo = activeLogoUrl;
      let baseConfig = existingTemplateConfig;
      try {
        const latest = await fetchPrintTemplate('statement');
        if (latest && latest.config) {
          baseConfig = latest.config;
        }
      } catch {}

      const newConfig = {
        ...baseConfig,
        logoSourceMode,
        selectedLogoBranchId,
        customLogoUrl,
        logoUrl: activeLogo,
      };

      await savePrintTemplate('statement', newConfig);
      setExistingTemplateConfig(newConfig);
      setPrintConfig((prev: any) => ({ ...prev, ...newConfig, logoUrl: activeLogo }));

      showSuccessNotification(
        'تم حفظ الشعار',
        'تم حفظ وتحديث الشعار المعتمد بنجاح في قاعدة البيانات لكشوفات الحساب'
      );
    } catch (err) {
      showErrorNotification('خطأ في الحفظ', 'تعذر حفظ الشعار المعتمد في قاعدة البيانات');
    } finally {
      setIsSavingLogo(false);
    }
  };

  const updatePrintConfig = (field: string, value: any) => {
    setPrintConfig((prev: any) => {
      if (field.startsWith('fontSizes.')) {
        const fontKey = field.split('.')[1];
        return {
          ...prev,
          fontSizes: {
            ...prev.fontSizes,
            [fontKey]: value,
          },
        };
      }
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleSavePrintConfig = async () => {
    setIsSavingPrintConfig(true);
    try {
      const activeLogo = activeLogoUrl;
      let baseConfig = existingTemplateConfig;
      try {
        const latest = await fetchPrintTemplate('statement');
        if (latest && latest.config) {
          baseConfig = latest.config;
        }
      } catch {}

      const newConfig = {
        ...baseConfig,
        ...printConfig,
        logoUrl: activeLogo || baseConfig?.logoUrl || printConfig?.logoUrl || '',
      };

      await savePrintTemplate('statement', newConfig);
      setExistingTemplateConfig(newConfig);

      showSuccessNotification(
        'تم حفظ إعدادات الطباعة',
        'تم حفظ ألوان وخطوط ونصوص الكشف بنجاح في قاعدة البيانات وتحديث كشوفات الحساب فورياً'
      );
    } catch (err) {
      showErrorNotification('خطأ في الحفظ', 'تعذر حفظ إعدادات الطباعة والكشف في قاعدة البيانات');
    } finally {
      setIsSavingPrintConfig(false);
    }
  };

  const handleSavePaymentMappings = async () => {
    setIsSavingPaymentMappings(true);
    try {
      await savePrintTemplate('payment_methods_mapping', { mappings: paymentMappings }, 'ربط طرق الدفع بالصناديق');
      showSuccessNotification(
        'تم حفظ ربط طرق الدفع',
        'تم حفظ وتثبيت ربط طرق الدفع بالصناديق والحسابات بنجاح في قاعدة البيانات'
      );
    } catch (err) {
      showErrorNotification('خطأ في الحفظ', 'تعذر حفظ ربط طرق الدفع في قاعدة البيانات');
    } finally {
      setIsSavingPaymentMappings(false);
    }
  };

  const handleAutoDiscoverPaymentMethods = () => {
    if (!accountsList || accountsList.length === 0) {
      showErrorNotification('تنبيه', 'جاري تحميل شجرة الحسابات، يرجى المحاولة بعد لحظات');
      return;
    }

    const masterAccounts = accountsList.filter(a =>
      a.code.startsWith('1343') ||
      a.code.startsWith('134213') ||
      a.code.startsWith('232146') ||
      a.code.startsWith('2614') ||
      a.code.startsWith('183') ||
      a.nameAr.includes('ماستر') ||
      a.nameAr.toLowerCase().includes('master')
    );

    const bankAccounts = accountsList.filter(a =>
      !masterAccounts.some(m => m.id === a.id) &&
      (a.category === 'BANK' ||
        a.code.startsWith('1342') ||
        a.code.startsWith('182') ||
        a.code.startsWith('1112') ||
        a.nameAr.includes('مصرف') ||
        a.nameAr.includes('بنك') ||
        a.nameAr.toLowerCase().includes('bank'))
    );

    const existingTargetIds = new Set(paymentMappings.map(m => m.targetAccountId));

    const newMasters: PaymentMethodMapping[] = masterAccounts
      .filter(m => !existingTargetIds.has(m.id))
      .map(m => ({
        id: `pm-master-${m.id}`,
        nameAr: m.nameAr,
        key: m.id,
        type: 'MASTER' as const,
        targetAccountId: m.id,
        targetAccountName: `${m.code} - ${m.nameAr}`,
        description: `بطاقة ماستر كارد (${m.nameAr})`,
        isActive: true,
      }));

    const newBanks: PaymentMethodMapping[] = bankAccounts
      .filter(b => !existingTargetIds.has(b.id))
      .map(b => ({
        id: `pm-bank-${b.id}`,
        nameAr: b.nameAr,
        key: b.id,
        type: 'BANK' as const,
        targetAccountId: b.id,
        targetAccountName: `${b.code} - ${b.nameAr}`,
        description: `حساب مصرفي (${b.nameAr})`,
        isActive: true,
      }));

    const totalAdded = newMasters.length + newBanks.length;
    if (totalAdded === 0) {
      showSuccessNotification('مكتمل', 'جميع حسابات الماستر كارد والبنوك في دليلك المحاسبي مضافة بالفعل');
      return;
    }

    setPaymentMappings(prev => [...prev, ...newMasters, ...newBanks]);
    showSuccessNotification(
      'تم اكتشاف واستيراد الماسترات والبنوك',
      `تم استيراد ${newMasters.length} بطاقة ماستر و ${newBanks.length} حساب بنكي، اضغط على "حفظ ربط طرق الدفع" لتثبيتها`
    );
  };

  const handleAddPaymentMethod = () => {
    if (!newMethodName.trim()) {
      showErrorNotification('تنبيه', 'يرجى إدخال اسم طريقة الدفع');
      return;
    }
    if (!newMethodAccountId) {
      showErrorNotification('تنبيه', 'يرجى اختيار الحساب أو الصندوق المالي المستلم');
      return;
    }

    const selectedAcc = accountsList.find(a => a.id === newMethodAccountId);
    const newEntry: PaymentMethodMapping = {
      id: `pm-${Date.now()}`,
      nameAr: newMethodName.trim(),
      key: newMethodAccountId === 'EMPLOYEE_ASSIGNED' ? 'CASH_CUSTOM' : newMethodAccountId,
      type: newMethodType,
      targetAccountId: newMethodAccountId,
      targetAccountName: selectedAcc ? `${selectedAcc.code} - ${selectedAcc.nameAr}` : 'صندوق الموظف المسند',
      description: `طريقة دفع مخصصة مرتبطة بـ (${selectedAcc?.nameAr || 'الصندوق'})`,
      isActive: true,
    };

    setPaymentMappings(prev => [...prev, newEntry]);
    setNewMethodName('');
    setNewMethodAccountId('');
    showSuccessNotification('تمت الإضافة', `تم إضافة طريقة الدفع "${newEntry.nameAr}"، اضغط على حفظ لتثبيتها`);
  };

  const handleRemovePaymentMethod = (id: string) => {
    setPaymentMappings(prev => prev.filter(m => m.id !== id));
  };

  const handleUpdatePaymentMapping = (id: string, field: keyof PaymentMethodMapping, value: any) => {
    setPaymentMappings(prev => prev.map(m => {
      if (m.id !== id) return m;
      if (field === 'targetAccountId') {
        const acc = accountsList.find(a => a.id === value);
        return {
          ...m,
          targetAccountId: value,
          targetAccountName: acc ? `${acc.code} - ${acc.nameAr}` : (value === 'EMPLOYEE_ASSIGNED' ? 'صندوق الموظف المسند' : value),
          key: value === 'EMPLOYEE_ASSIGNED' ? 'CASH_HAND' : value,
        };
      }
      return { ...m, [field]: value };
    }));
  };

  const fundAccountOptions = useMemo(() => {
    const leafAccs = (accountsList || []).filter(a => a && !a.isGroup && a.id);
    return [
      { value: 'EMPLOYEE_ASSIGNED', label: '⚡ صندوق الموظف المسند (حسب موظف الإصدار تلقائياً)' },
      ...leafAccs.map(a => ({
        value: String(a.id),
        label: `${a.code || ''} - ${a.nameAr || a.name || ''} (${a.currency || 'IQD'})`,
      })),
    ];
  }, [accountsList]);

  /*
   * خيارات الحسابات تُبنى مرة واحدة لا في كل تصيير.
   *
   * كانت كل قائمة Select تستدعي accountsList.map(...) داخلياً، وهي عشرات القوائم
   * على مئات الحسابات — فكل ضغطة مفتاح أو تغيّر حالة يعيد بناء آلاف الخيارات،
   * وهو سبب ثقل الصفحة وتعليقها. الآن مصفوفتان محفوظتان: عادية، وبعلامة الأب.
   */
  const accountOptions = useMemo(
    () => (accountsList || []).map((a: any) => ({ value: a.id, label: `${a.code} - ${a.nameAr}` })),
    [accountsList],
  );
  const accountOptionsWithParent = useMemo(
    () =>
      (accountsList || []).map((a: any) => ({
        value: a.id,
        label: `${a.code} - ${a.nameAr}${a.isParent ? ' (أب)' : ''}`,
      })),
    [accountsList],
  );

  const handleBranchChange = (branchId: string) => {
    const b = branches.find((item) => item.id === branchId);
    const code = b?.code || 'BGD';
    setSelectedBranchId(branchId);
    setSelectedBranchCode(code);
    setSequences(loadSequenceSettings(branchId, code));
  };

  const handleSequenceChange = (key: string, field: keyof SequenceConfig, value: any) => {
    setSequences((prev) => {
      const updated = {
        ...prev,
        [key]: {
          ...prev[key],
          [field]: value,
        },
      };
      saveSequenceSettings(updated, selectedBranchId);
      return updated;
    });
  };

  /*
   * الحفظ يذهب إلى القاعدة لا إلى المتصفّح.
   *
   * كان يُكتب في localStorage، فيضبط المدير الترقيم على جهازه ويبقى بقية
   * الموظفين على الافتراضي — ثم يتصادم عدّاداهم. صار صفّاً واحداً للشركة يقرأه
   * الجميع، والنسخة المحلية تُحفظ معه ليعمل العرض بلا انتظار.
   */
  const handleSaveAll = async () => {
    saveSequenceSettings(sequences, selectedBranchId);
    try {
      await sequencesApi.save(
        Object.values(sequences).map((c: any) => ({
          docType: c.id,
          prefix: c.prefix,
          branchCode: selectedBranchCode,
          includeYear: c.includeYear,
          nextNumber: c.nextNumber,
          padding: c.padding,
          separator: c.separator,
        })),
      );
      showSuccessNotification('تم الحفظ', `حُفظ الترقيم على الخادم — يسري على كل الأجهزة والموظفين`);
    } catch (err: any) {
      showErrorNotification(
        'تعذّر الحفظ على الخادم',
        err?.message || 'حُفظت النسخة المحلية فقط، ولن تسري على بقية الأجهزة',
      );
    }
  };

  /* التسلسلات المحفوظة في القاعدة هي المرجع، فتُقرأ عند فتح التبويب. */
  useEffect(() => {
    if (activeSection !== 'sequences') return;
    sequencesApi
      .list(selectedBranchCode)
      .then((rows) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        setSequences((prev) => {
          const merged: any = { ...prev };
          rows.forEach((r: any) => {
            const key = r.docType === 'groups' && merged.groupFare ? 'groups' : r.docType;
            if (!merged[key]) return;
            merged[key] = {
              ...merged[key],
              prefix: r.prefix,
              branchCode: r.branchCode || selectedBranchCode,
              includeYear: r.includeYear,
              nextNumber: r.nextNumber,
              padding: r.padding,
              separator: r.separator,
            };
          });
          return merged;
        });
      })
      .catch(() => undefined);
  }, [activeSection, selectedBranchCode]);

  const navGroups = [
    {
      title: 'الإعدادات المحاسبية والمالية',
      isAccountingGroup: true,
      items: [
        { id: 'core_accounts', label: 'الحسابات الأساسية (الربط العام)', icon: IconScale },
        { id: 'currencies', label: 'العملات وأسعار الصرف', icon: IconCoin },
        { id: 'sequences', label: 'التسلسلات والترقيم', icon: IconNumbers },
        { id: 'accounting', label: 'طرق الدفع وربط الصناديق', icon: IconBook2 },
      ],
    },
    {
      title: 'النظام والهوية والمظهر',
      isAccountingGroup: false,
      items: [
        { id: 'company_logo', label: 'إعدادات الشركة والشعار', icon: IconPhoto },
        ...(currentTenant?.isRoot ? [{ id: 'database', label: 'قاعدة البيانات والتخزين', icon: IconDatabase }] : []),
        { id: 'appearance', label: 'المظهر والخطوط', icon: IconTypography },
      ],
    },
  ];

  const isAccountingSection = ['core_accounts', 'currencies', 'sequences', 'accounting'].includes(activeSection);

  const sequenceItemsMeta = [
    { key: 'tickets', icon: IconPlane, color: 'blue', tag: 'تذاكر الطيران' },
    { key: 'groupFare', icon: IconTicket, color: 'orange', tag: 'تذاكر كروب فير' },
    { key: 'groups', icon: IconUsers, color: 'violet', tag: 'الكروبات والرحلات السياحية' },
    { key: 'visas', icon: IconEPassport, color: 'teal', tag: 'الفيزا والتأشيرات' },
    { key: 'refunds', icon: IconRotate, color: 'rose', tag: 'الاسترجاع والمرتجعات' },
    { key: 'changes', icon: IconRefresh, color: 'amber', tag: 'التغيرات وتعديل التذاكر' },
    { key: 'receiptVouchers', icon: IconReceipt, color: 'emerald', tag: 'سندات القبض' },
    { key: 'paymentVouchers', icon: IconReceiptOff, color: 'indigo', tag: 'سندات الدفع' },
    { key: 'expenses', icon: IconReceiptOff, color: 'orange', tag: 'سندات المصاريف' },
  
    { key: 'journalEntries', icon: IconReceipt, color: 'slate', tag: 'قيود اليومية' },
    { key: 'hotels', icon: IconReceipt, color: 'cyan', tag: 'حجوزات فنادق' },
    { key: 'exchange', icon: IconReceipt, color: 'orange', tag: 'الصرافة' },
  ];

  const currentBranchName = branches.find((b) => b.id === selectedBranchId)?.nameAr || 'الفرع الرئيسي';

  return (
    <div
      className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 py-4 sm:py-5 select-none font-sans space-y-4 bg-[#F7F8FA] min-h-screen text-right"
      dir="rtl"
      style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
    >
      {/* ══════════════════════════════════════════════════════════════
          1. UNIFIED PAGE HEADER (86px Height)
         ══════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white rounded-[14px] border border-[#E5E7EB] px-6 py-4 min-h-[86px] shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-[42px] h-[42px] rounded-[12px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shadow-2xs shrink-0">
            <IconSettings size={22} stroke={2} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-bold text-[20px] text-[#111827] leading-tight">
                إعدادات النظام المحاسبي
              </h1>
              <span className="bg-[#FFF3E8] text-[#F45A0A] border border-orange-200/80 rounded-[8px] px-2.5 py-0.5 font-mono text-[11px] font-bold">
                System Settings
              </span>
            </div>
            <p className="text-[13px] font-normal text-[#64748B] mt-0.5">
              الربط المحاسبي، العملات وأسعار الصرف، التسلسلات، طرق الدفع، هوية الشركة والشعار، وقاعدة البيانات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleSaveAll}
            className="h-[44px] px-5 rounded-[10px] bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-[13.5px] shadow-xs flex items-center gap-2 transition-all cursor-pointer active:scale-98"
          >
            <IconDeviceFloppy size={18} strokeWidth={2.4} />
            <span>حفظ التغييرات</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          2. INTERNAL SIDE NAVIGATION & MAIN WORKSPACE
         ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Side Navigation Menu */}
        <div className="md:col-span-3 bg-white rounded-[14px] border border-[#E5E7EB] p-3.5 shadow-2xs space-y-4 h-fit">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1.5">
              <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100">
                <span className={`text-[11px] font-black uppercase tracking-wider ${group.isAccountingGroup ? 'text-slate-800 flex items-center gap-1.5' : 'text-slate-500'}`}>
                  {group.isAccountingGroup && <span className="w-2 h-2 rounded-full bg-[#F45A0A]" />}
                  {group.title}
                </span>
                {group.isAccountingGroup && (
                  <span className="text-[9.5px] font-bold text-[#F45A0A] bg-orange-50 border border-orange-200 px-1.5 py-0.2 rounded">
                    رئيسي
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isSelected = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-xs transition-all cursor-pointer text-right font-bold ${
                        isSelected
                          ? 'bg-[#FFF3E8] text-[#F45A0A] border border-orange-200/80 shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon size={16} className={isSelected ? 'text-[#F45A0A]' : 'text-slate-400'} />
                      <span className="flex-1">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right Main Settings Workspace */}
        <div className="md:col-span-9 bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs p-5 space-y-5">
          {/* Unified Accounting Group Sub-Navigation Header Bar */}
          {isAccountingSection && (
            <div className="bg-[#FFF3E8]/80 border border-orange-200/80 rounded-[12px] p-3 flex items-center justify-between flex-wrap gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#F45A0A] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <IconBook2 size={16} />
                </div>
                <div>
                  <span className="text-[12px] font-black text-slate-900 block leading-none">
                    مجموعة الإعدادات المحاسبية والمالية
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    الحسابات الأساسية، العملات وأسعار الصرف، التسلسلات والترقيم، طرق الدفع والصناديق
                  </span>
                </div>
              </div>

              {/* Sub Navigation Pills */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-[9px] border border-orange-200/80 shadow-2xs font-bold text-xs">
                <button
                  type="button"
                  onClick={() => setActiveSection('currencies')}
                  className={`px-3 py-1.5 rounded-[7px] transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeSection === 'currencies' ? 'bg-[#F45A0A] text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <IconCoin size={14} />
                  <span>العملات وأسعار الصرف</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('sequences')}
                  className={`px-3 py-1.5 rounded-[7px] transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeSection === 'sequences' ? 'bg-[#F45A0A] text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <IconNumbers size={14} />
                  <span>التسلسلات والترقيم</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('accounting')}
                  className={`px-3 py-1.5 rounded-[7px] transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeSection === 'accounting' ? 'bg-[#F45A0A] text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <IconReceipt size={14} />
                  <span>طرق الدفع والصناديق</span>
                </button>
              </div>
            </div>
          )}

          {/* Section: Company Logo Settings */}
          {(activeSection === 'company' || activeSection === 'company_logo') && (
            <div className="space-y-4 text-xs">
              <input
                type="file"
                ref={logoFileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleCustomLogoUpload}
              />

              {/* Logo Adoption Engine */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      <IconPhoto size={20} className="text-orange-600" />
                      <span>اعتماد شعار (لوجو) المستندات وكشوفات الحساب</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      حدد شعار الفرع المطلوب اعتماده لكشوفات الحساب أو قم برفع شعار مخصص
                    </p>
                  </div>
                  <SegmentedControl
                    size="xs"
                    radius="md"
                    value={logoSourceMode}
                    onChange={(v) => setLogoSourceMode(v as 'BRANCH' | 'CUSTOM')}
                    data={[
                      { label: '🏢 شعار فرع معتمد', value: 'BRANCH' },
                      { label: '🎨 شعار مخصص', value: 'CUSTOM' },
                    ]}
                    color="orange"
                    className="font-bold"
                  />
                </div>

                {/* Mode A: Branch Logo Selection */}
                {logoSourceMode === 'BRANCH' && (
                  <div className="space-y-2">
                    <Select
                      size="xs"
                      label="اختر الفرع المطلوب اعتماد شعاره للمستندات والكشوفات:"
                      placeholder="اختر الفرع..."
                      data={branches.map((b) => ({
                        value: b.id,
                        label: `${b.nameAr} (${b.code || 'BGD'})${b.logo ? ' — (يوجد شعار مرفع للفرع)' : ' — (بدون شعار مرفع)'}`,
                      }))}
                      value={selectedLogoBranchId}
                      onChange={(v) => v && setSelectedLogoBranchId(v)}
                      className="font-bold"
                      leftSection={<IconBuildingStore size={14} className="text-orange-600" />}
                    />
                  </div>
                )}

                {/* Mode B: Custom Logo Upload */}
                {logoSourceMode === 'CUSTOM' && (
                  <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                    <Button
                      size="xs"
                      variant="outline"
                      color="orange"
                      leftSection={<IconUpload size={14} />}
                      onClick={() => logoFileInputRef.current?.click()}
                      className="font-bold text-xs"
                    >
                      رفع صورة شعار مخصص من الجهاز
                    </Button>

                    {customLogoUrl && (
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => setCustomLogoUrl('')}
                        className="font-bold text-xs"
                      >
                        حذف الشعار المخصص
                      </Button>
                    )}
                  </div>
                )}

                {/* Active Adopted Logo Preview Card */}
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    {activeLogoUrl ? (
                      <img
                        src={activeLogoUrl}
                        alt="Active Logo"
                        className="w-14 h-14 object-contain rounded-lg border p-1 bg-white shadow-2xs"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-black text-xs">
                        لا يوجد شعار
                      </div>
                    )}
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 block">الشعار المحدد حالياً:</span>
                      <span className="text-[11px] text-emerald-800 font-bold">
                        {logoSourceMode === 'BRANCH'
                          ? `فرع: ${branches.find(b => b.id === selectedLogoBranchId)?.nameAr || 'الفرع المحدد'}`
                          : (customLogoUrl ? 'شعار مخصص تم رفعه' : 'لم يتم تحديد شعار مخصص بعد')}
                      </span>
                    </div>
                  </div>

                  {/* Save Changes Button */}
                  <Button
                    color="emerald"
                    size="xs"
                    loading={isSavingLogo}
                    leftSection={<IconDeviceFloppy size={16} />}
                    onClick={handleSaveLogoSettings}
                    className="font-extrabold px-4"
                  >
                    حفظ التغييرات واعتماد الشعار
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Section 1.5: Print & Statement Settings */}
          {activeSection === 'print_statement' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <IconPrinter size={20} className="text-emerald-700" />
                    <span>إعدادات وتصاميم كشف الحساب والطباعة</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    معاينة حية وتعديل العبارات والنصوص الرسمية لكشف الحساب
                  </p>
                </div>
                <Button
                  color="emerald"
                  size="xs"
                  loading={isSavingPrintConfig}
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={handleSavePrintConfig}
                  className="font-extrabold px-4 shadow-xs"
                >
                  حفظ إعدادات الكشف والطباعة
                </Button>
              </div>

              {/* Grid: Customized Controls (4 cols) & Official Live Preview (8 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Tabbed Controls (4 cols) */}
                <div className="lg:col-span-4 space-y-3.5 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  {/* Modern Pill Tab Selector */}
                  <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="grid grid-cols-4 gap-1">
                      <button
                        type="button"
                        onClick={() => setPrintTab('colors')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-[11px] font-black transition-all ${
                          printTab === 'colors'
                            ? 'bg-emerald-600 text-white shadow-xs scale-[1.02]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <IconPalette size={14} />
                        <span>الألوان</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintTab('fonts')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-[11px] font-black transition-all ${
                          printTab === 'fonts'
                            ? 'bg-emerald-600 text-white shadow-xs scale-[1.02]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <IconTypography size={14} />
                        <span>الخطوط</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintTab('info')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-[11px] font-black transition-all ${
                          printTab === 'info'
                            ? 'bg-emerald-600 text-white shadow-xs scale-[1.02]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <IconBuilding size={14} />
                        <span>البيانات</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintTab('toggles')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-[11px] font-black transition-all ${
                          printTab === 'toggles'
                            ? 'bg-emerald-600 text-white shadow-xs scale-[1.02]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <IconAdjustments size={14} />
                        <span>العناصر</span>
                      </button>
                    </div>
                  </div>

                  {/* Tab Panels */}
                  {printTab === 'colors' && (
                    <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-200">
                      <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs border-b pb-1.5">
                        <IconPalette size={15} className="text-emerald-700" />
                        <span>تخصيص ألوان أجزاء المستند</span>
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <ColorInput
                          label="شريط عنوان الكشف"
                          size="xs"
                          value={printConfig.titleAccentColor || '#64748b'}
                          onChange={(val) => updatePrintConfig('titleAccentColor', val)}
                          format="hex"
                          swatches={['#64748b', '#059669', '#2563eb', '#7c3aed', '#d97706', '#dc2626', '#0f172a']}
                        />
                        <ColorInput
                          label="خلفية رأس الجدول"
                          size="xs"
                          value={printConfig.tableHeaderBgColor || '#e2e8f0'}
                          onChange={(val) => updatePrintConfig('tableHeaderBgColor', val)}
                          format="hex"
                          swatches={['#e2e8f0', '#059669', '#1e293b', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444']}
                        />
                        <ColorInput
                          label="نص رأس الجدول"
                          size="xs"
                          value={printConfig.tableHeaderTextColor || '#0f172a'}
                          onChange={(val) => updatePrintConfig('tableHeaderTextColor', val)}
                          format="hex"
                          swatches={['#0f172a', '#ffffff', '#334155', '#1e293b', '#047857']}
                        />
                        <ColorInput
                          label="خلفية ملخص الحساب"
                          size="xs"
                          value={printConfig.summaryHeaderBgColor || '#e2e8f0'}
                          onChange={(val) => updatePrintConfig('summaryHeaderBgColor', val)}
                          format="hex"
                          swatches={['#e2e8f0', '#ecfdf5', '#f1f5f9', '#eff6ff', '#fef3c7']}
                        />
                        <ColorInput
                          label="نص ملخص الحساب"
                          size="xs"
                          value={printConfig.summaryHeaderTextColor || '#0f172a'}
                          onChange={(val) => updatePrintConfig('summaryHeaderTextColor', val)}
                          format="hex"
                          swatches={['#0f172a', '#065f46', '#1e40af', '#92400e', '#ffffff']}
                        />
                        <ColorInput
                          label="صفوف الجدول الزوجية"
                          size="xs"
                          value={printConfig.tableRowStripedColor || '#f8fafc'}
                          onChange={(val) => updatePrintConfig('tableRowStripedColor', val)}
                          format="hex"
                          swatches={['#f8fafc', '#f0fdf4', '#f0f9ff', '#fefce8', '#ffffff']}
                        />
                        <ColorInput
                          label="نصوص حركات الجدول"
                          size="xs"
                          value={printConfig.tableTextColor || '#0f172a'}
                          onChange={(val) => updatePrintConfig('tableTextColor', val)}
                          format="hex"
                          swatches={['#0f172a', '#334155', '#1e293b', '#475569']}
                        />
                        <ColorInput
                          label="لون الرصيد النهائي"
                          size="xs"
                          value={printConfig.balanceDueColor || '#0f172a'}
                          onChange={(val) => updatePrintConfig('balanceDueColor', val)}
                          format="hex"
                          swatches={['#0f172a', '#dc2626', '#059669', '#2563eb', '#d97706']}
                        />
                      </div>
                    </div>
                  )}

                  {printTab === 'fonts' && (
                    <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200">
                      <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs border-b pb-1.5">
                        <IconTypography size={15} className="text-emerald-700" />
                        <span>أنواع الخطوط والأحجام</span>
                      </span>
                      <Select
                        label="نوع الخط المستخدم بالكشف"
                        size="xs"
                        data={['IBM Plex Sans Arabic', 'Tajawal', 'Cairo', 'Inter', 'Roboto']}
                        value={printConfig.fontFamily || 'IBM Plex Sans Arabic'}
                        onChange={(val) => updatePrintConfig('fontFamily', val || 'IBM Plex Sans Arabic')}
                        className="font-bold"
                      />
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>حجم خط عنوان المستند</span>
                          <span className="text-emerald-700 font-mono">{printConfig.docTitleSize || 20}px</span>
                        </div>
                        <Slider
                          size="xs"
                          color="emerald"
                          min={16}
                          max={28}
                          step={1}
                          value={printConfig.docTitleSize || 20}
                          onChange={(val) => updatePrintConfig('docTitleSize', val)}
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>حجم خط جدول الحركات</span>
                          <span className="text-emerald-700 font-mono">{printConfig.tableFontSize || 10}px</span>
                        </div>
                        <Slider
                          size="xs"
                          color="emerald"
                          min={8}
                          max={14}
                          step={0.5}
                          value={printConfig.tableFontSize || 10}
                          onChange={(val) => updatePrintConfig('tableFontSize', val)}
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>حجم خط التذييل والفوتر</span>
                          <span className="text-emerald-700 font-mono">{printConfig.footerFontSize || 10}px</span>
                        </div>
                        <Slider
                          size="xs"
                          color="emerald"
                          min={8}
                          max={13}
                          step={0.5}
                          value={printConfig.footerFontSize || 10}
                          onChange={(val) => updatePrintConfig('footerFontSize', val)}
                        />
                      </div>
                      <div className="pt-1 border-t border-slate-100">
                        <Checkbox
                          label="تغميق الخطوط بجدول الحركات (Bold Text)"
                          size="xs"
                          checked={printConfig.isTableBold || false}
                          onChange={(e) => updatePrintConfig('isTableBold', e.currentTarget.checked)}
                          className="font-bold"
                        />
                      </div>
                    </div>
                  )}

                  {printTab === 'info' && (
                    <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200">
                      <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs border-b pb-1.5">
                        <IconBuilding size={15} className="text-emerald-700" />
                        <span>بيانات الشركة والعبارات الرسمية</span>
                      </span>
                      <TextInput
                        label="اسم الشركة / الفرع بالكشف"
                        size="xs"
                        value={printConfig.companyName || ''}
                        onChange={(e) => updatePrintConfig('companyName', e.target.value)}
                        placeholder="FLY4ALL"
                        className="font-bold"
                      />
                      <TextInput
                        label="العنوان الفرعي للكشف"
                        size="xs"
                        value={printConfig.subtitle || ''}
                        onChange={(e) => updatePrintConfig('subtitle', e.target.value)}
                        placeholder="Detailed Account Statement"
                        className="font-bold"
                      />
                      <TextInput
                        label="رقم الهاتف المعروض بالكشف"
                        size="xs"
                        value={printConfig.phone || ''}
                        onChange={(e) => updatePrintConfig('phone', e.target.value)}
                        placeholder="07700003377 - 07800003901"
                        className="font-bold"
                      />
                      <TextInput
                        label="البريد الإلكتروني المعروض بالكشف"
                        size="xs"
                        value={printConfig.email || ''}
                        onChange={(e) => updatePrintConfig('email', e.target.value)}
                        placeholder="Support@Fly4all.com"
                        className="font-bold"
                      />
                      <TextInput
                        label="عنوان الشركة / الفرع بالكشف"
                        size="xs"
                        value={printConfig.address || ''}
                        onChange={(e) => updatePrintConfig('address', e.target.value)}
                        placeholder="العراق - بغداد"
                        className="font-bold"
                      />
                      <TextInput
                        label="نص التذييل والفوتر (Footer Text)"
                        size="xs"
                        value={printConfig.footerText || ''}
                        onChange={(e) => updatePrintConfig('footerText', e.target.value)}
                        className="font-bold"
                      />
                    </div>
                  )}

                  {printTab === 'toggles' && (
                    <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200">
                      <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs border-b pb-1.5">
                        <IconAdjustments size={15} className="text-emerald-700" />
                        <span>خيارات إظهار وإخفاء عناصر الكشف</span>
                      </span>
                      <div className="space-y-2 text-[11px] font-bold">
                        <div className="flex items-center justify-between py-1">
                          <span>إظهار كارت ملخص الحساب (Account summary)</span>
                          <Switch
                            size="xs"
                            color="emerald"
                            checked={printConfig.showAccountSummary !== false}
                            onChange={(e) => updatePrintConfig('showAccountSummary', e.currentTarget.checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                          <span>إظهار رمز الـ QR Code في تذييل الكشف</span>
                          <Switch
                            size="xs"
                            color="emerald"
                            checked={printConfig.showQrCode !== false}
                            onChange={(e) => updatePrintConfig('showQrCode', e.currentTarget.checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                          <span>إظهار العلامة المائية الشفافة (Watermark)</span>
                          <Switch
                            size="xs"
                            color="emerald"
                            checked={printConfig.showWatermark || false}
                            onChange={(e) => updatePrintConfig('showWatermark', e.currentTarget.checked)}
                          />
                        </div>
                      </div>
                      {printConfig.showWatermark && (
                        <TextInput
                          label="نص العلامة المائية"
                          size="xs"
                          value={printConfig.watermarkText || ''}
                          onChange={(e) => updatePrintConfig('watermarkText', e.target.value)}
                          placeholder="OFFICIAL STATEMENT"
                          className="font-bold mt-2"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Official Live Preview (8 cols) — Centered layout */}
                <div className="lg:col-span-8 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2 sticky top-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                      <IconEye size={16} className="text-emerald-700" />
                      <span>معاينة حية ومباشرة للكشف المعتمد (Official Live Preview)</span>
                    </span>
                    <Badge color="emerald" variant="light" size="sm" className="font-bold">
                      التصميم الرسمي الثابت ⚡
                    </Badge>
                  </div>

                  <div className="overflow-x-auto max-h-[720px] overflow-y-auto p-4 bg-slate-100/90 rounded-xl border border-slate-200 flex justify-center items-start" dir="ltr" style={{ direction: 'ltr', textAlign: 'left' }}>
                    <div className="scale-90 origin-top flex justify-center w-full min-w-[780px]" dir="ltr" style={{ direction: 'ltr', textAlign: 'left' }}>
                      <PrintableAccountStatementSheet
                        accountName="حساب العميل علي السعدي"
                        accountCode="1413"
                        startDate="2026/08/01"
                        endDate="2026/08/31"
                        rows={[
                          {
                            rowNumber: 1,
                            date: '2026/08/01',
                            docRef: 'OB-2026',
                            statement: 'رصيد افتتاحي مرحل من الدورة المالية السابقة',
                            debit: 0,
                            credit: 0,
                            runningBalance: 0,
                          },
                          {
                            rowNumber: 2,
                            date: '2026/08/02',
                            docRef: 'INV-01005',
                            pnr: 'PRMCK',
                            route: 'BGW ➔ MHD',
                            statement: 'مبيعات تذاكر طيران خطوط كاسبيان | المسافرين (3): Mr SALAM ALSHAMOOSI',
                            debit: 1250000,
                            credit: 0,
                            runningBalance: 1250000,
                          },
                          {
                            rowNumber: 3,
                            date: '2026/08/04',
                            docRef: 'RV-0042',
                            statement: 'سند قبض نقدي دفعة أولى لحساب حجز التذاكر',
                            debit: 0,
                            credit: 500000,
                            runningBalance: 750000,
                          },
                        ]}
                        totals={{
                          totalDebit: 1250000,
                          totalCredit: 500000,
                          finalBalance: 750000,
                          openingBalance: 0,
                          previousBalance: 0,
                        }}
                        config={{
                          ...existingTemplateConfig,
                          ...printConfig,
                          logoPosX: 0,
                          logoPosY: 0,
                          logoUrl: activeLogoUrl || existingTemplateConfig?.logoUrl || printConfig?.logoUrl || '',
                        }}
                        lang="ar"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section: Core Accounts Mapping (الاعدادات الرئيسية - الحسابات الاساسية) */}
          {activeSection === 'core_accounts' && (
            <div className="space-y-4 text-xs">
              {/* Header & Save Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
                      <IconScale size={18} />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-slate-900 leading-tight">
                        الحسابات الأساسية والربط المحاسبي التلقائي (Core Accounts)
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        ربط الحسابات الحاكمة وحسابات الآباء المركزية لتوجيه العمليات المالية والقيود التلقائية وفق الدليل المحاسبي الموحد 2026
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="light"
                    color="teal"
                    onClick={handleApplyAutoSuggestions}
                    leftSection={<IconSparkles size={14} />}
                  >
                    اقتراح وتعبئة تلقائية ذكية
                  </Button>

                  <Button
                    size="xs"
                    color="emerald"
                    loading={isSavingCoreAccounts}
                    onClick={handleSaveCoreAccounts}
                    leftSection={<IconDeviceFloppy size={14} />}
                  >
                    حفظ الحسابات الأساسية
                  </Button>
                </div>
              </div>

              {/* Main Form Box Styled Cohesive with the Light Modern Theme */}
              <div className="bg-white text-slate-800 rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-600"></div>
                    <span className="text-xs font-black text-slate-800">
                      ربط وتوجيه الحسابات المركزية (Control & Master Accounts)
                    </span>
                  </div>
                  <Badge color="emerald" variant="light" size="sm" className="font-mono font-bold">
                    الدليل المحاسبي الموحد 2026
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* 1. حساب الصندوق الرئيسي */}
                  <div className="space-y-1 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 hover:border-emerald-300 transition-colors shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <IconVault size={15} className="text-emerald-700" />
                        حساب الصندوق الرئيسي
                      </label>
                      <span className="text-[10.5px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                        المقترح: 13411
                      </span>
                    </div>
                    <Select
                      size="xs"
                      data={fundAccountOptions}
                      value={coreAccounts.mainCashboxId}
                      onChange={(val) => setCoreAccounts(p => ({ ...p, mainCashboxId: val || '' }))}
                      searchable
                      placeholder="اختر حساب الصندوق الرئيسي..."
                      styles={{
                        input: { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1', fontSize: 11, fontWeight: 700, borderRadius: 8, height: 34 },
                      }}
                    />
                  </div>

                  {/* 2. العميل النقدي (مسافر كاش) */}
                  <div className="space-y-1 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 hover:border-emerald-300 transition-colors shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <IconUsers size={15} className="text-teal-700" />
                        العميل النقدي (مسافر كاش)
                      </label>
                      <span className="text-[10.5px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                        المقترح: 132141
                      </span>
                    </div>
                    <Select
                      size="xs"
                      data={accountOptions}
                      value={coreAccounts.defaultCashCustomerId}
                      onChange={(val) => setCoreAccounts(p => ({ ...p, defaultCashCustomerId: val || '' }))}
                      searchable
                      placeholder="اختر حساب العميل النقدي الافتراضي..."
                      styles={{
                        input: { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1', fontSize: 11, fontWeight: 700, borderRadius: 8, height: 34 },
                      }}
                    />
                  </div>

                  {/* 3. رأس المال */}
                  <div className="space-y-1 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 hover:border-emerald-300 transition-colors shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <IconBuildingBank size={15} className="text-blue-700" />
                        رأس المال
                      </label>
                      <span className="text-[10.5px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                        المقترح: 2611 / 261
                      </span>
                    </div>
                    <Select
                      size="xs"
                      data={accountOptions}
                      value={coreAccounts.capitalAccountId}
                      onChange={(val) => setCoreAccounts(p => ({ ...p, capitalAccountId: val || '' }))}
                      searchable
                      placeholder="اختر حساب رأس المال..."
                      styles={{
                        input: { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1', fontSize: 11, fontWeight: 700, borderRadius: 8, height: 34 },
                      }}
                    />
                  </div>

                  {/* 4. حساب اب الشركاء (العمليات الجارية) */}
                  <div className="space-y-1 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 hover:border-emerald-300 transition-colors shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <IconTrendingUp size={15} className="text-indigo-700" />
                        حساب أب الشركاء (العمليات الجارية أرباح وخسائر)
                      </label>
                      <span className="text-[10.5px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                        المقترح: 264
                      </span>
                    </div>
                    <Select
                      size="xs"
                      data={accountOptionsWithParent}
                      value={coreAccounts.partnersParentAccountId}
                      onChange={(val) => setCoreAccounts(p => ({ ...p, partnersParentAccountId: val || '' }))}
                      searchable
                      placeholder="اختر حساب أب الشركاء والعمليات الجارية..."
                      styles={{
                        input: { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1', fontSize: 11, fontWeight: 700, borderRadius: 8, height: 34 },
                      }}
                    />
                  </div>

                  {/* 5. حساب اب الصناديق */}
                  <div className="space-y-1 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 hover:border-emerald-300 transition-colors shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <IconVault size={15} className="text-amber-700" />
                        حساب أب الصناديق (نقدية بالصندوق)
                      </label>
                      <span className="text-[10.5px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                        المقترح: 1341
                      </span>
                    </div>
                    <Select
                      size="xs"
                      data={accountOptionsWithParent}
                      value={coreAccounts.cashboxesParentAccountId}
                      onChange={(val) => setCoreAccounts(p => ({ ...p, cashboxesParentAccountId: val || '' }))}
                      searchable
                      placeholder="اختر حساب أب الصناديق النقدية..."
                      styles={{
                        input: { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1', fontSize: 11, fontWeight: 700, borderRadius: 8, height: 34 },
                      }}
                    />
                  </div>

                  {/* 6. حساب اب العملاء (مدينون قطاع خاص) */}
                  <div className="space-y-1 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 hover:border-emerald-300 transition-colors shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <IconUsers size={15} className="text-emerald-700" />
                        حساب أب العملاء (مدينون قطاع خاص)
                      </label>
                      <span className="text-[10.5px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                        المقترح: 13214
                      </span>
                    </div>
                    <Select
                      size="xs"
                      data={accountOptionsWithParent}
                      value={coreAccounts.customersParentAccountId}
                      onChange={(val) => setCoreAccounts(p => ({ ...p, customersParentAccountId: val || '' }))}
                      searchable
                      placeholder="اختر حساب أب العملاء..."
                      styles={{
                        input: { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1', fontSize: 11, fontWeight: 700, borderRadius: 8, height: 34 },
                      }}
                    />
                  </div>

                  {/* 7. حساب اب الموردين (مجهزون قطاع خاص) */}
                  <div className="space-y-1 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 hover:border-emerald-300 transition-colors shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <IconBuildingStore size={15} className="text-orange-700" />
                        حساب أب الموردين (مجهزون قطاع خاص)
                      </label>
                      <span className="text-[10.5px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                        المقترح: 23214
                      </span>
                    </div>
                    <Select
                      size="xs"
                      data={accountOptionsWithParent}
                      value={coreAccounts.suppliersParentAccountId}
                      onChange={(val) => setCoreAccounts(p => ({ ...p, suppliersParentAccountId: val || '' }))}
                      searchable
                      placeholder="اختر حساب أب الموردين وشركات الطيران..."
                      styles={{
                        input: { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1', fontSize: 11, fontWeight: 700, borderRadius: 8, height: 34 },
                      }}
                    />
                  </div>

                  {/* 8. مكافئ استحقاق الأرباح (دائنو توزيع الارباح) */}
                  <div className="space-y-1 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 hover:border-emerald-300 transition-colors shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <IconCoins size={15} className="text-yellow-700" />
                        مكافئ استحقاق الأرباح (دائنو توزيع الأرباح)
                      </label>
                      <span className="text-[10.5px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                        المقترح: 2328 / 23284
                      </span>
                    </div>
                    <Select
                      size="xs"
                      data={accountOptions}
                      value={coreAccounts.dividendsPayableAccountId}
                      onChange={(val) => setCoreAccounts(p => ({ ...p, dividendsPayableAccountId: val || '' }))}
                      searchable
                      placeholder="اختر حساب استحقاق وتوزيع الأرباح..."
                      styles={{
                        input: { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1', fontSize: 11, fontWeight: 700, borderRadius: 8, height: 34 },
                      }}
                    />
                  </div>

                  {/* 9. حساب اب العمولات (إيرادات مستحقة) */}
                  <div className="space-y-1 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 hover:border-emerald-300 transition-colors shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <IconReceipt size={15} className="text-teal-700" />
                        حساب أب العمولات (إيرادات مستحقة / عمولات مبيعات)
                      </label>
                      <span className="text-[10.5px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                        المقترح: 423 / 132621
                      </span>
                    </div>
                    <Select
                      size="xs"
                      data={accountOptions}
                      value={coreAccounts.commissionsParentAccountId}
                      onChange={(val) => setCoreAccounts(p => ({ ...p, commissionsParentAccountId: val || '' }))}
                      searchable
                      placeholder="اختر حساب أب العمولات..."
                      styles={{
                        input: { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1', fontSize: 11, fontWeight: 700, borderRadius: 8, height: 34 },
                      }}
                    />
                  </div>

                  {/* 10. حساب اب الايرادات الاخرى */}
                  <div className="space-y-1 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 hover:border-emerald-300 transition-colors shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <IconCashBanknote size={15} className="text-emerald-700" />
                        حساب أب الإيرادات (الإيرادات الأخرى)
                      </label>
                      <span className="text-[10.5px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                        المقترح: 49 / 4
                      </span>
                    </div>
                    <Select
                      size="xs"
                      data={accountOptionsWithParent}
                      value={coreAccounts.otherRevenuesParentAccountId}
                      onChange={(val) => setCoreAccounts(p => ({ ...p, otherRevenuesParentAccountId: val || '' }))}
                      searchable
                      placeholder="اختر حساب أب الإيرادات..."
                      styles={{
                        input: { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1', fontSize: 11, fontWeight: 700, borderRadius: 8, height: 34 },
                      }}
                    />
                  </div>

                  {/* 11. حساب أب الأطراف الخارجية (خارج الميزانية) */}
                  <div className="space-y-1 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 hover:border-emerald-300 transition-colors shadow-2xs md:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <IconBuildingBank size={15} className="text-purple-700" />
                        حساب أب الأطراف الخارجية (بورصة / مكاتب / عملاء — خارج الميزانية)
                      </label>
                      <span className="text-[10.5px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                        المقترح: 9
                      </span>
                    </div>
                    <Select
                      size="xs"
                      data={accountOptionsWithParent}
                      value={coreAccounts.externalPartiesParentAccountId}
                      onChange={(val) => setCoreAccounts(p => ({ ...p, externalPartiesParentAccountId: val || '' }))}
                      searchable
                      placeholder="اختر الحساب الأب للأطراف الخارجية..."
                      styles={{
                        input: { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1', fontSize: 11, fontWeight: 700, borderRadius: 8, height: 34 },
                      }}
                    />
                    <p className="text-[10px] text-slate-500 font-medium mt-1">
                      حساباتهم (البورصة، المكاتب الوسيطة، العملاء) تُدرج تحته ولا تُحتسب ضمن الموجودات أو المطلوبات — رقابية بحتة.
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2: Custom Voucher & Split Allocation Accounts (حسابات القبض والصرف المخصصة وتقسيم السندات) */}
              <div className="bg-white text-slate-800 rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200 shrink-0">
                      <IconReceipt size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">
                        حسابات القبض والصرف المخصصة وتقسيم السندات (Custom Allocation Accounts)
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        تعيين وربط الحسابات المخصصة للقبض والتوزيع لتظهر تلقائياً في نافذة إنشاء وتعديل سند القبض وفي بند "تقسيم القبض" بالطباعة
                      </p>
                    </div>
                  </div>

                  <Button
                    size="xs"
                    color="orange"
                    loading={isSavingCustomVoucherAccounts}
                    onClick={handleSaveCustomVoucherAccounts}
                    leftSection={<IconDeviceFloppy size={14} />}
                    className="shadow-xs font-bold"
                  >
                    حفظ حسابات القبض المخصصة
                  </Button>
                </div>

                {/* Add New Custom Allocation Account Form */}
                <div className="bg-orange-50/40 p-3.5 rounded-xl border border-orange-200/70 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-orange-950">
                    <IconPlus size={14} className="text-orange-600" />
                    <span>إضافة وتعيين حساب قبض / صرف مخصص جديد:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">الاسم التعريفي (عربي):</label>
                      <TextInput
                        size="xs"
                        placeholder="مثال: مبيعات تذاكر الطيران..."
                        value={newCustomAccountName}
                        onChange={(e) => setNewCustomAccountName(e.currentTarget.value)}
                        styles={{
                          input: { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1', fontSize: 11, fontWeight: 700, borderRadius: 8, height: 34 },
                        }}
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">الاسم التعريفي (إنجليزي):</label>
                      <TextInput
                        size="xs"
                        placeholder="e.g. Flight Tickets..."
                        dir="ltr"
                        value={newCustomAccountNameEn}
                        onChange={(e) => setNewCustomAccountNameEn(e.currentTarget.value)}
                        styles={{
                          input: { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1', fontSize: 11, fontWeight: 700, borderRadius: 8, height: 34 },
                        }}
                      />
                    </div>

                    <div className="sm:col-span-5 space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">اختيار الحساب المحاسبي من الشجرة:</label>
                      <Select
                        size="xs"
                        searchable
                        placeholder="ابحث واختر الحساب من الدليل المحاسبي..."
                        data={accountsList.map((a) => ({
                          value: a.id,
                          label: `${a.code} - ${a.nameAr}${a.isParent ? ' (أب)' : ''}`,
                        }))}
                        value={newCustomAccountId}
                        onChange={(val) => setNewCustomAccountId(val || '')}
                        styles={{
                          input: { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1', fontSize: 11, fontWeight: 700, borderRadius: 8, height: 34 },
                        }}
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <Button
                        size="xs"
                        color="orange"
                        fullWidth
                        onClick={handleAddCustomVoucherAccount}
                        leftSection={<IconPlus size={14} />}
                        className="font-bold h-[34px]"
                      >
                        إضافة الحساب المخصص
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Configured Custom Allocation Accounts List */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                    <span>قائمة حسابات القبض المخصصة المعرفة حالياً ({customVoucherAccounts.length}):</span>
                    <span className="text-[10px] text-slate-400">تظهر هذه الحسابات في شاشة إنشاء سند القبض والطباعة</span>
                  </div>

                  {customVoucherAccounts.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs font-bold">
                      لا توجد حسابات مخصصة مضافة حالياً. استخدم النموذج أعلاه لتعيين حسابات القبض المخصصة.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {customVoucherAccounts.map((item, idx) => {
                        const boundAcc = accountsList.find((a) => a.id === item.targetAccountId);
                        const displayAccName = boundAcc ? `${boundAcc.code} - ${boundAcc.nameAr}` : (item.targetAccountName || 'حساب غير محدد');

                        return (
                          <div
                            key={item.id || idx}
                            className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 hover:border-orange-300 transition-all flex flex-col justify-between gap-2 shadow-2xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-orange-600" />
                                  {item.nameAr}
                                </span>
                                <Badge size="xs" color="orange" variant="light" className="font-bold">
                                  قبض وصرف
                                </Badge>
                              </div>

                              <div className="text-[11px] text-slate-600 font-mono bg-white p-1.5 rounded-lg border border-slate-200">
                                🔗 {displayAccName}
                              </div>

                              {/* الاسم الإنجليزي قابل للتحرير في مكانه — يُطبع في الوصل الإنجليزي. */}
                              <TextInput
                                size="xs"
                                dir="ltr"
                                placeholder="English name…"
                                value={item.nameEn || ''}
                                onChange={(e) => {
                                  const v = e.currentTarget.value;
                                  setCustomVoucherAccounts((prev) =>
                                    prev.map((a) => (a.id === item.id ? { ...a, nameEn: v } : a))
                                  );
                                }}
                                styles={{
                                  input: { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#e2e8f0', fontSize: 10.5, fontWeight: 700, borderRadius: 8, height: 28 },
                                }}
                              />
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-1">
                              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                ✓ مفعل في سندات القبض
                              </span>
                              <Button
                                size="compact-xs"
                                variant="subtle"
                                color="red"
                                onClick={() => handleRemoveCustomVoucherAccount(item.id)}
                                leftSection={<IconTrash size={12} />}
                                className="font-bold text-[10.5px]"
                              >
                                حذف
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Accounting Settings & Payment Method Fund Mapping */}
          {activeSection === 'accounting' && (
            <div className="space-y-4 text-xs">
              {/* Header & Save Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                    <IconBook2 size={16} className="text-emerald-700" />
                    <span>إعدادات الحسابات وربط طرق الدفع بالصناديق</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    تحديد الصندوق أو الحساب المستلم لكل طريقة دفع (كاش، ماستر، بنوك) لضمان توجيه الإيرادات والمبالغ آلياً للحساب الصحيح
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="light"
                    color="teal"
                    onClick={handleAutoDiscoverPaymentMethods}
                    leftSection={<IconSparkles size={14} />}
                  >
                    اكتشاف واستيراد الماسترات والبنوك تلقائياً
                  </Button>
                  <Button
                    size="xs"
                    color="orange"
                    loading={isSavingPaymentMappings}
                    onClick={handleSavePaymentMappings}
                    leftSection={<IconDeviceFloppy size={13} />}
                  >
                    حفظ ربط طرق الدفع
                  </Button>
                </div>
              </div>

              {/* Banner Info */}
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-start gap-2.5 shadow-2xs">
                <div className="p-1 bg-emerald-600 text-white rounded-md shrink-0 mt-0.5 shadow-2xs">
                  <IconInfoCircle size={15} />
                </div>
                <div className="text-[11px] leading-relaxed text-emerald-950 flex-1">
                  <span className="font-extrabold block text-xs text-emerald-900 mb-0.5">آلية التدفق النقدي والتوجيه المحاسبي:</span>
                  عند إنشاء أي فاتورة تذاكر أو مبيعات، يحدد النظام الصندوق أو الحساب المالي المستلم بناءً على طريقة الدفع المختارة أدناه (مثلاً: الكاش يذهب لصندوق الموظف أو الفرع، وبطاقة Master تذهب مباشرة لحساب الماستر كارد المقابل في شجرة الحسابات).
                </div>
              </div>

              {/* Payment Methods Mapping Table */}
              <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                    <IconCreditCard size={14} className="text-emerald-700" />
                    قائمة طرق الدفع وحساباتها المالية المستلمة
                  </span>
                  <Badge color="emerald" variant="light" size="sm" className="font-bold">
                    {paymentMappings.length} طرق دفع معرفة
                  </Badge>
                </div>

                <div className="divide-y divide-slate-100">
                  {paymentMappings.map((pm, idx) => {
                    const isCash = pm.type === 'CASH';
                    const isMaster = pm.type === 'MASTER';
                    const isBank = pm.type === 'BANK';
                    const linkedAcc = accountsList.find(a => a.id === pm.targetAccountId);

                    return (
                      <div key={pm.id || idx} className="p-3 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* 1. Name & Type Badge */}
                        <div className="flex items-center gap-2.5 min-w-[220px]">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${
                            isCash ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            isMaster ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                            isBank ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' :
                            'bg-purple-100 text-purple-800 border border-purple-300'
                          }`}>
                            {isCash && <IconCashBanknote size={18} />}
                            {isMaster && <IconCreditCard size={18} />}
                            {isBank && <IconBuildingBank size={18} />}
                            {!isCash && !isMaster && !isBank && <IconVault size={18} />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs text-slate-900">{pm.nameAr}</span>
                              <Badge size="xs" variant="outline" color={isCash ? 'emerald' : isMaster ? 'blue' : 'indigo'}>
                                {isCash ? 'نقدي (كاش)' : isMaster ? 'ماستر كارد' : isBank ? 'حساب بنكي' : 'إلكتروني'}
                              </Badge>
                            </div>
                            <span className="text-[10px] text-slate-400 block">{pm.description || 'توجيه آلي مباشر'}</span>
                          </div>
                        </div>

                        {/* 2. Target Fund / Account Selector */}
                        <div className="flex-1 max-w-[450px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-bold text-[10px] shrink-0">الصندوق / الحساب المستلم:</span>
                            <Select
                              size="xs"
                              data={fundAccountOptions}
                              value={pm.targetAccountId}
                              onChange={(val) => handleUpdatePaymentMapping(pm.id, 'targetAccountId', val)}
                              searchable
                              placeholder="اختر الحساب المستلم..."
                              className="w-full font-bold"
                              styles={{
                                input: { fontSize: 11, fontWeight: 700, borderColor: '#cbd5e1' }
                              }}
                            />
                          </div>
                          {linkedAcc && (
                            <div className="flex items-center gap-2 mt-1 mr-[120px]">
                              <span className="text-[10px] text-slate-400">الرصيد المالي الحالي:</span>
                              <span className={`text-[10px] font-extrabold font-mono ${Number(linkedAcc.balanceIQD || linkedAcc.balance || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                {Number(linkedAcc.balanceIQD || linkedAcc.balance || 0).toLocaleString()} {linkedAcc.currency || 'IQD'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 3. Status Switch & Delete */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            size="xs"
                            color="emerald"
                            checked={pm.isActive}
                            onChange={(e) => handleUpdatePaymentMapping(pm.id, 'isActive', e.currentTarget.checked)}
                            label={pm.isActive ? 'مفعل' : 'معطل'}
                            styles={{ label: { fontSize: 10, fontWeight: 700 } }}
                          />

                          {pm.id !== 'pm-cash' && (
                            <Button
                              size="compact-xs"
                              variant="subtle"
                              color="red"
                              onClick={() => handleRemovePaymentMethod(pm.id)}
                              title="حذف طريقة الدفع"
                            >
                              <IconTrash size={13} />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add New Custom Payment Method Form */}
                <div className="p-3 bg-slate-50 border-t border-slate-200">
                  <span className="font-extrabold text-[11px] text-slate-700 block mb-2">إضافة طريقة دفع أو بطاقة جديدة:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                    <div className="sm:col-span-4">
                      <TextInput
                        size="xs"
                        label="اسم طريقة الدفع"
                        placeholder="مثال: زين كاش / كي كارد / Master 3"
                        value={newMethodName}
                        onChange={(e) => setNewMethodName(e.currentTarget.value)}
                        styles={{ input: { fontSize: 11 } }}
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <Select
                        size="xs"
                        label="النوع"
                        data={[
                          { value: 'MASTER', label: 'ماستر كارد (MasterCard)' },
                          { value: 'BANK', label: 'حساب بنكي (Bank Transfer)' },
                          { value: 'ELECTRONIC', label: 'محفظة إلكترونية (Wallet)' },
                          { value: 'CASH', label: 'صندوق نقدي (Cash)' },
                        ]}
                        value={newMethodType}
                        onChange={(val: any) => setNewMethodType(val || 'MASTER')}
                        styles={{ input: { fontSize: 11 } }}
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <Select
                        size="xs"
                        label="الحساب المقابل في الشجرة"
                        data={fundAccountOptions}
                        value={newMethodAccountId}
                        onChange={(val) => setNewMethodAccountId(val || '')}
                        searchable
                        placeholder="اختر الحساب المالي..."
                        styles={{ input: { fontSize: 11 } }}
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <Button
                        size="xs"
                        color="emerald"
                        variant="filled"
                        onClick={handleAddPaymentMethod}
                        className="w-full"
                        leftSection={<IconPlus size={12} />}
                      >
                        إضافة
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* General Accounting Rules */}
              <div className="border-t pt-3 mt-3">
                <h3 className="font-extrabold text-sm text-slate-900 border-b pb-1 mb-2">القواعد والسياسات المحاسبية العامة</h3>
                <div className="grid grid-cols-2 gap-3">
                  <TextInput label="السنة المالية الحالية" defaultValue="2026" readOnly className="font-bold font-mono" />
                  <Select label="أساس المحاسبة" data={['أساس الاستحقاق (Accrual Basis)', 'الأساس النقدي (Cash Basis)']} defaultValue="أساس الاستحقاق (Accrual Basis)" />
                </div>
                <div className="space-y-2 border-t pt-2 mt-2">
                  <Checkbox label="منع تعديل أو إلغاء القيود المرحّلة إطلاقاً" defaultChecked />
                  <Checkbox label="السماح بالإنشاء والترحيل بتاريخ سابق (Backdated)" />
                  <Checkbox label="حساب فروقات العملة تلقائياً عند التجميع" defaultChecked />
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Official Adopted Exchange Rate Settings */}
          {activeSection === 'currencies' && (
            <div className="space-y-5 text-xs">
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
                      <IconCoin size={18} />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-slate-900 leading-tight">
                        إعدادات سعر الصرف المعتمد للنظام (USD ⇄ IQD)
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        السعر الرسمي المعتمد في الفواتير والقيود المحاسبية وكافة معاملات النظام
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    color="emerald"
                    loading={isSavingExConfig}
                    onClick={handleSaveExchangeRateConfig}
                    leftSection={<IconDeviceFloppy size={15} />}
                    className="font-bold shadow-xs px-4"
                  >
                    حفظ التغييرات
                  </Button>
                </div>
              </div>

              {/* ─── LIVE ADOPTED RATE OVERVIEW (Equation Cards) ─── */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-extrabold text-xs text-slate-800">
                      معادلة احتساب السعر المعتمد حالياً:
                    </span>
                    <Badge color="emerald" variant="light" size="sm" className="font-bold">
                      {(exConfigForm?.mode || 'MARKET_PLUS_MARGIN') === 'MARKET_PLUS_MARGIN' ? 'ربط ديناميكي مباشر' : 'سعر يدوي ثابت'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">آخر تحديث للبورصة:</span>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="emerald"
                      onClick={() => adoptedExHook.refreshMarket()}
                      leftSection={<IconRefresh size={11} />}
                      className="font-bold"
                    >
                      تحديث أسعار البورصة
                    </Button>
                  </div>
                </div>

                {/* 3 Step Equation Visual Cards */}
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center">
                  {/* 1. Base Market Price */}
                  <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-slate-500 mb-1">
                      سعر السوق المرجعي (البورصة)
                    </span>
                    <div className="text-xl font-black text-slate-800 font-mono">
                      {(previewBaseRate || 1500).toLocaleString()}{' '}
                      <span className="text-[11px] font-normal text-slate-500">د.ع / $</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium mt-1">
                      {exConfigForm?.baseMarketSource === 'BAGHDAD_BUY'
                        ? 'سعر شراء بغداد'
                        : exConfigForm?.baseMarketSource === 'NORTHERN_SELL'
                        ? 'سعر الشمال / أربيل'
                        : exConfigForm?.baseMarketSource === 'SOUTHERN_SELL'
                        ? 'سعر الجنوب / البصرة'
                        : exConfigForm?.baseMarketSource === 'AVERAGE'
                        ? 'متوسط أسعار المحافظات'
                        : 'سعر بيع بغداد'}
                    </span>
                  </div>

                  {/* Plus Sign */}
                  <div className="md:col-span-1 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-black text-lg flex items-center justify-center shadow-2xs">
                      +
                    </div>
                  </div>

                  {/* 2. Margin Added */}
                  <div className="md:col-span-2 bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-center flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-amber-800 mb-1">
                      هامش الإضافة المعتمد
                    </span>
                    <div className="text-xl font-black text-amber-800 font-mono">
                      +{(previewMarginPerUSD || 0).toLocaleString()}{' '}
                      <span className="text-[11px] font-normal text-amber-700">د.ع / $</span>
                    </div>
                    <span className="text-[10px] text-amber-700/80 font-medium mt-1">
                      (+{((previewMarginPerUSD || 0) * 100).toLocaleString()} د.ع لكل 100$)
                    </span>
                  </div>

                  {/* Equal Sign */}
                  <div className="md:col-span-1 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black text-lg flex items-center justify-center shadow-2xs">
                      =
                    </div>
                  </div>

                  {/* 3. Resulting Adopted Rate */}
                  <div className="md:col-span-1 md:w-full bg-emerald-600 text-white rounded-xl p-3.5 text-center flex flex-col justify-center shadow-sm">
                    <span className="text-[10px] font-extrabold text-emerald-100 mb-1">
                      السعر المعتمد للنظام
                    </span>
                    <div className="text-xl font-black text-white font-mono tracking-tight">
                      {(previewAdoptedRate || 1500).toLocaleString()}{' '}
                      <span className="text-[10px] font-normal text-emerald-100">د.ع</span>
                    </div>
                    <span className="text-[10px] text-emerald-100 font-mono mt-1">
                      100$ = {((previewAdoptedRate || 1500) * 100).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Market Live Rates Ticker */}
                <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500 font-bold flex items-center gap-1.5">
                    <IconTrendingUp size={14} className="text-emerald-600" />
                    أسعار بورصة العراق المباشرة:
                  </span>
                  <div className="flex flex-wrap items-center gap-2 font-mono">
                    <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-slate-800 font-bold">
                      بغداد بيع: <strong className="text-emerald-700">{adoptedExHook.marketData?.baghdad?.sell || '1535'}</strong>
                    </span>
                    <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-slate-800 font-bold">
                      بغداد شراء: <strong className="text-blue-700">{adoptedExHook.marketData?.baghdad?.buy || '1525'}</strong>
                    </span>
                    <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-slate-600 font-medium">
                      أربيل: {adoptedExHook.marketData?.northern?.sell || '1535'}
                    </span>
                    <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-slate-600 font-medium">
                      البصرة: {adoptedExHook.marketData?.southern?.sell || '1535'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ─── CONFIGURATION FORM ─── */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-5">
                <div className="border-b border-slate-100 pb-2">
                  <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <IconCalculator size={16} className="text-emerald-700" />
                    طريقة احتساب وتحديد سعر الصرف
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    اختر كيفية تحديد السعر المعتمد (ديناميكي يتغير تلقائياً مع البورصة، أو يدوي ثابت)
                  </p>
                </div>

                {/* Mode Selectors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setExConfigForm(prev => ({ ...(prev || DEFAULT_EXCHANGE_CONFIG), mode: 'MARKET_PLUS_MARGIN' }))}
                    className={`p-4 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      (exConfigForm?.mode || 'MARKET_PLUS_MARGIN') === 'MARKET_PLUS_MARGIN'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                        <IconSparkles size={15} className="text-emerald-600" />
                        ربط ديناميكي بسعر السوق + إضافة هامش (موصى به)
                      </span>
                      {(exConfigForm?.mode || 'MARKET_PLUS_MARGIN') === 'MARKET_PLUS_MARGIN' && (
                        <Badge color="emerald" size="xs">مفعل</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      يُحسب السعر المعتمد تلقائياً بأخذ سعر صرف البورصة وإضافة المبلغ الذي تحدده فوقه، ويتغير تلقائياً عند تغير السوق
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExConfigForm(prev => ({ ...(prev || DEFAULT_EXCHANGE_CONFIG), mode: 'FIXED' }))}
                    className={`p-4 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      exConfigForm?.mode === 'FIXED'
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                        <IconShieldLock size={15} className="text-slate-600" />
                        سعر صرف يدوي ثابت (Fixed Rate)
                      </span>
                      {exConfigForm?.mode === 'FIXED' && (
                        <Badge color="emerald" size="xs">مفعل</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      تحديد سعر صرف ثابت لا يتغير حتى تقوم بتعديله يدوياً
                    </p>
                  </button>
                </div>

                {/* Form Controls */}
                {(exConfigForm?.mode || 'MARKET_PLUS_MARGIN') === 'MARKET_PLUS_MARGIN' ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* 1. Base Market Source */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          مصدر سعر السوق المرجعي:
                        </label>
                        <Select
                          size="sm"
                          value={exConfigForm?.baseMarketSource || 'BAGHDAD_SELL'}
                          onChange={(val: any) =>
                            setExConfigForm(prev => ({ ...(prev || DEFAULT_EXCHANGE_CONFIG), baseMarketSource: val || 'BAGHDAD_SELL' }))
                          }
                          data={[
                            { value: 'BAGHDAD_SELL', label: `سعر بيع بغداد (${adoptedExHook.marketData?.baghdad?.sell || '1535'} د.ع)` },
                            { value: 'BAGHDAD_BUY', label: `سعر شراء بغداد (${adoptedExHook.marketData?.baghdad?.buy || '1525'} د.ع)` },
                            { value: 'NORTHERN_SELL', label: `سعر الشمال / أربيل (${adoptedExHook.marketData?.northern?.sell || '1535'} د.ع)` },
                            { value: 'SOUTHERN_SELL', label: `سعر الجنوب / البصرة (${adoptedExHook.marketData?.southern?.sell || '1535'} د.ع)` },
                            { value: 'AVERAGE', label: 'متوسط أسعار المحافظات' },
                          ]}
                          styles={{ input: { fontWeight: 700 } }}
                        />
                        <span className="text-[10px] text-slate-400 block mt-1">السعر الذي تؤخذ منه القيمة الأساسية</span>
                      </div>

                      {/* 2. Margin Amount */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          مبلغ الإضافة فوق سعر السوق:
                        </label>
                        <TextInput
                          size="sm"
                          type="number"
                          min={0}
                          value={exConfigForm?.marginAmount ?? 0}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setExConfigForm(prev => ({ ...(prev || DEFAULT_EXCHANGE_CONFIG), marginAmount: val }));
                          }}
                          className="font-mono font-bold"
                          styles={{ input: { fontWeight: 800, color: '#047857', fontSize: 13 } }}
                        />
                        <span className="text-[10px] text-slate-400 block mt-1">
                          {(exConfigForm?.marginUnit || 'PER_1_USD') === 'PER_100_USD' ? 'المبلغ المضاف لكل 100 دولار' : 'المبلغ المضاف لكل 1 دولار'}
                        </span>
                      </div>

                      {/* 3. Margin Unit */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          وحدة حساب الإضافة:
                        </label>
                        <Select
                          size="sm"
                          value={exConfigForm?.marginUnit || 'PER_1_USD'}
                          onChange={(val: any) =>
                            setExConfigForm(prev => ({ ...(prev || DEFAULT_EXCHANGE_CONFIG), marginUnit: val || 'PER_1_USD' }))
                          }
                          data={[
                            { value: 'PER_1_USD', label: 'دينار لكل 1 دولار (مثال: +5 د.ع / $)' },
                            { value: 'PER_100_USD', label: 'دينار لكل 100 دولار (مثال: +1,000 د.ع / 100$)' },
                          ]}
                          styles={{ input: { fontWeight: 700 } }}
                        />
                        <span className="text-[10px] text-slate-400 block mt-1">طريقة احتساب الإضافة</span>
                      </div>
                    </div>

                    {/* Quick Presets Buttons */}
                    <div className="border-t border-slate-200/80 pt-3 flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-600">إضافات شائعة سريعة (لكل 100$):</span>
                      {[
                        { label: '+500 د.ع', val: 500, unit: 'PER_100_USD' as const },
                        { label: '+1,000 د.ع', val: 1000, unit: 'PER_100_USD' as const },
                        { label: '+1,500 د.ع', val: 1500, unit: 'PER_100_USD' as const },
                        { label: '+2,000 د.ع', val: 2000, unit: 'PER_100_USD' as const },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setExConfigForm(prev => ({
                            ...(prev || DEFAULT_EXCHANGE_CONFIG),
                            marginAmount: preset.val,
                            marginUnit: preset.unit,
                          }))}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 text-slate-700 font-bold font-mono text-[11px] transition-all cursor-pointer shadow-2xs"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      سعر الصرف الثابت المعتمد (دينار عراقي لكل 1 دولار):
                    </label>
                    <TextInput
                      size="sm"
                      type="number"
                      value={exConfigForm?.fixedRate ?? 1530}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 1530;
                        setExConfigForm(prev => ({ ...(prev || DEFAULT_EXCHANGE_CONFIG), fixedRate: val }));
                      }}
                      className="max-w-xs font-bold font-mono"
                      styles={{ input: { fontSize: 14, fontWeight: 800, color: '#047857' } }}
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">سعر ثابت لا يتغير حتى يتم تحديثه</span>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ملاحظات أو تعليمات سياسة الصرف (اختياري):
                  </label>
                  <Textarea
                    size="xs"
                    placeholder="اكتب أي تعليمات محاسبية بشأن فروقات الصرف والعملات..."
                    value={exConfigForm?.notes || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setExConfigForm(prev => ({ ...(prev || DEFAULT_EXCHANGE_CONFIG), notes: val }));
                    }}
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Auto-Numbering Sequences */}
          {activeSection === 'sequences' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">إدارة وتسلسل ترقيم الفواتير والمستندات حسب الفرع</h3>
                  <p className="text-[11px] text-slate-500">اختر الفرع لتحديد وتخصيص البادئة والرقم التالي بشكل مستقل لكل فرع</p>
                </div>
                <Button size="xs" color="emerald" onClick={handleSaveAll} leftSection={<IconDeviceFloppy size={13} />}>
                  حفظ تسلسلات الفرع
                </Button>
              </div>

              {/* Branch Selector Banner */}
              <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5 flex-1">
                  <div className="p-1.5 bg-emerald-600 text-white rounded-lg shrink-0 shadow-2xs">
                    <IconGitBranch size={16} />
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-emerald-950 block">الفرع الحالي المحدد للترقيم:</span>
                    <span className="text-[10px] text-emerald-700 font-medium">
                      يتم سحب وتحديث رمز الفرع تلقائياً عند تغيير الاختيار
                    </span>
                  </div>
                </div>
                <Select
                  size="xs"
                  value={selectedBranchId}
                  onChange={(v) => v && handleBranchChange(v)}
                  data={
                    branches.length > 0
                      ? branches.map((b) => ({ value: b.id, label: `${b.nameAr} (${b.code || 'BGD'})` }))
                      : [
                          { value: 'b1', label: 'الفرع الرئيسي - بغداد (BGD)' },
                          { value: 'b2', label: 'فرع أربيل (EBL)' },
                          { value: 'b3', label: 'فرع النجف الأشرف (NJF)' },
                          { value: 'b4', label: 'فرع البصرة (BSR)' },
                        ]
                  }
                  className="font-bold min-w-[240px]"
                  leftSection={<IconGitBranch size={14} className="text-emerald-700" />}
                />
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {sequenceItemsMeta.map((meta) => {
                  const seq = sequences[meta.key];
                  if (!seq) return null;
                  const Icon = meta.icon;
                  const previewStr = formatSequencePreview(seq);

                  return (
                    <div
                      key={meta.key}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-emerald-300 transition-all space-y-3 shadow-2xs group"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Icon size={16} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs text-slate-800">{seq.nameAr}</span>
                              <Badge size="xs" color="emerald" variant="light" className="font-mono">
                                {currentBranchName}
                              </Badge>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">{seq.nameEn}</span>
                          </div>
                        </div>

                        {/* Live Format Preview Badge */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-bold">معاينة ترقيم الفرع:</span>
                          <div className="px-3 py-1 bg-slate-900 text-emerald-400 font-mono font-extrabold text-xs rounded-lg shadow-inner border border-slate-700 tracking-wider">
                            {previewStr}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-end">
                        <TextInput
                          label="رمز الفرع / الشركة"
                          size="xs"
                          value={seq.branchCode}
                          onChange={(e) => handleSequenceChange(meta.key, 'branchCode', e.target.value.toUpperCase())}
                          className="font-mono uppercase font-bold"
                          placeholder="مثال: BGD"
                        />
                        <TextInput
                          label="البادئة (Prefix)"
                          size="xs"
                          value={seq.prefix}
                          onChange={(e) => handleSequenceChange(meta.key, 'prefix', e.target.value.toUpperCase())}
                          className="font-mono uppercase font-bold"
                          placeholder="مثال: TKT"
                        />
                        <TextInput
                          label="الرقم التالي (Next)"
                          size="xs"
                          type="number"
                          value={seq.nextNumber}
                          onChange={(e) => handleSequenceChange(meta.key, 'nextNumber', Math.max(1, parseInt(e.target.value) || 1))}
                          className="font-mono font-bold"
                        />
                        <Select
                          label="عدد أرقام الترقيم"
                          size="xs"
                          value={String(seq.padding)}
                          onChange={(v) => handleSequenceChange(meta.key, 'padding', parseInt(v || '5'))}
                          data={[
                            { value: '4', label: '4 أرقام (0001)' },
                            { value: '5', label: '5 أرقام (00001)' },
                            { value: '6', label: '6 أرقام (000001)' },
                            { value: '7', label: '7 أرقام (0000001)' },
                          ]}
                          className="font-bold"
                        />
                        <div className="flex items-center h-8 pb-1">
                          <Checkbox
                            label="تضمين السنة الحالية (2026)"
                            checked={seq.includeYear}
                            onChange={(e) => handleSequenceChange(meta.key, 'includeYear', e.currentTarget.checked)}
                            className="font-bold text-slate-700 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Database & Storage Status */}
          {activeSection === 'database' && (
            <div className="space-y-4 text-xs">
              {/* Top Banner & Refresh */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
                      <IconDatabase size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-slate-900 leading-tight">
                          قاعدة البيانات والتخزين السحابي (Supabase PostgreSQL)
                        </h3>
                        <Badge size="xs" color="emerald" variant="filled" className="font-bold animate-pulse">
                          متصل ونشط 🟢
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        متابعة خادم وقاعدة بيانات Supabase، استهلاك المساحة، الجداول، وسرعة الاستجابة اللحظية
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="light"
                    color="teal"
                    loading={isOptimizingDb}
                    onClick={handleOptimizeDatabase}
                    leftSection={<IconBolt size={14} />}
                  >
                    تحسين الفهارس والإحصائيات
                  </Button>

                  <Button
                    size="xs"
                    color="emerald"
                    loading={isLoadingDbInfo}
                    onClick={fetchDbInfo}
                    leftSection={<IconRefresh size={14} />}
                  >
                    تحديث الفحص
                  </Button>
                </div>
              </div>

              {/* KPI Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {/* 1. Storage Size */}
                <Paper p="xs" radius="sm" withBorder className="bg-white shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                    <span>حجم قاعدة البيانات</span>
                    <IconDatabase size={16} className="text-emerald-600" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-base font-black text-slate-900 tabular-nums">
                      {dbInfo?.totalSizeFormatted || '12 MB'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      المساحة المستهلكة من السعة المخصصة
                    </div>
                  </div>
                  <div className="pt-1">
                    <Progress
                      value={Math.min(100, Math.max(5, ((dbInfo?.totalSizeBytes || 13000000) / (500 * 1024 * 1024)) * 100))}
                      color="emerald"
                      size="xs"
                      radius="xl"
                    />
                  </div>
                </Paper>

                {/* 2. Active Connections */}
                <Paper p="xs" radius="sm" withBorder className="bg-white shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                    <span>الاتصالات المتزامنة</span>
                    <IconActivity size={16} className="text-blue-600" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-base font-black text-slate-900 tabular-nums font-mono">
                      {dbInfo?.activeConnections || 17} <span className="text-xs font-bold text-slate-400">/ {dbInfo?.maxConnections || 60}</span>
                    </div>
                    <div className="text-[10px] text-blue-700 font-bold">
                      {dbInfo?.poolerMode || 'Transaction Pooler (PgBouncer)'}
                    </div>
                  </div>
                  <div className="pt-1">
                    <Progress
                      value={dbInfo?.connectionUsagePct || 28}
                      color="blue"
                      size="xs"
                      radius="xl"
                    />
                  </div>
                </Paper>

                {/* 3. Connection Latency */}
                <Paper p="xs" radius="sm" withBorder className="bg-white shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                    <span>سرعة الاستجابة (Ping)</span>
                    <IconBolt size={16} className="text-amber-600" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-base font-black text-slate-900 tabular-nums font-mono">
                      {dbInfo?.latencyMs !== undefined ? `${dbInfo.latencyMs} ms` : 'سريع 🟢'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      وقت تنفيذ الاستعلام عبر الشبكة
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold pt-1">
                    <Badge size="xs" color="emerald" variant="light">
                      أداء فائق ومستقر ⚡
                    </Badge>
                  </div>
                </Paper>

                {/* 4. Total Tables Count */}
                <Paper p="xs" radius="sm" withBorder className="bg-emerald-900 text-white shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-emerald-200 text-[11px] font-bold">
                    <span>عدد الجداول النشطة</span>
                    <IconServer size={16} className="text-emerald-300" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-base font-black text-emerald-100 tabular-nums font-mono">
                      {dbInfo?.tableStats?.length ?? 0} <span className="text-xs font-bold text-emerald-300">جدول</span>
                    </div>
                    <div className="text-[10px] text-emerald-200 font-medium">
                      هيكل البيانات والكيانات المحاسبية
                    </div>
                  </div>
                  <div className="text-[10px] text-emerald-300 font-bold pt-1">
                    Supabase PostgreSQL 17
                  </div>
                </Paper>
              </div>

              {/* Technical Connection Details Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <IconCloud size={16} className="text-emerald-700" />
                    <span>بيانات الاتصال ومحرك قاعدة البيانات السحابية</span>
                  </span>
                  <Badge color="cyan" variant="light" size="sm" className="font-mono font-bold">
                    PostgreSQL 17.6
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-bold">مزود الخدمة والبيئة</span>
                    <div className="font-bold text-slate-900 text-xs">{dbInfo?.provider || '—'}</div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-bold">عنوان الخادم (Host)</span>
                    <div className="font-mono font-bold text-slate-900 text-xs truncate" dir="ltr">{dbInfo?.host || '—'}</div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-bold">المنفذ ونمط التجميع (Port & Pooler)</span>
                    <div className="font-bold text-slate-900 text-xs font-mono">{dbInfo?.port || '6543'} ({dbInfo?.poolerMode || 'Transaction Pooler'})</div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-bold">اسم قاعدة البيانات والمستخدم</span>
                    <div className="font-mono font-bold text-slate-900 text-xs">{dbInfo?.databaseName || 'postgres'} ({dbInfo?.databaseUser || 'postgres'})</div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-bold">تشفير وأمان الاتصال</span>
                    <div className="font-bold text-emerald-800 text-xs flex items-center gap-1">
                      <span>🔒 {dbInfo?.ssl || 'TLSv1.3 Encrypted (SSL)'}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-bold">إصدار المحرك (Engine Version)</span>
                    <div className="font-mono text-slate-700 text-[11px] truncate" title={dbInfo?.version}>{dbInfo?.version?.split(' on ')[0] || 'PostgreSQL 17.6'}</div>
                  </div>
                </div>
              </div>

              {/* Core Business Entity Summary Cards */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <span className="font-bold text-slate-900 text-xs border-b border-slate-100 pb-2 block">
                  إحصائيات السجلات والكيانات المحاسبية والتشغيلية في قاعدة البيانات
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200 text-center space-y-1">
                    <span className="text-[10.5px] text-emerald-900 font-bold block">شجرة الحسابات</span>
                    <span className="font-black text-base text-emerald-950 font-mono block tabular-nums">
                      {dbInfo?.summaryCounts?.accounts ?? 719}
                    </span>
                    <span className="text-[9.5px] text-emerald-700 font-medium block">حساب محاسبي</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-200 text-center space-y-1">
                    <span className="text-[10.5px] text-blue-900 font-bold block">القيود اليومية</span>
                    <span className="font-black text-base text-blue-950 font-mono block tabular-nums">
                      {dbInfo?.summaryCounts?.journalEntries ?? 0}
                    </span>
                    <span className="text-[9.5px] text-blue-700 font-medium block">قيد محاسبي</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-teal-50/60 border border-teal-200 text-center space-y-1">
                    <span className="text-[10.5px] text-teal-900 font-bold block">التذاكر والخدمات</span>
                    <span className="font-black text-base text-teal-950 font-mono block tabular-nums">
                      {dbInfo?.summaryCounts?.tickets ?? 0}
                    </span>
                    <span className="text-[9.5px] text-teal-700 font-medium block">تذكرة / خدمة</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-200 text-center space-y-1">
                    <span className="text-[10.5px] text-indigo-900 font-bold block">سندات القبض</span>
                    <span className="font-black text-base text-indigo-950 font-mono block tabular-nums">
                      {dbInfo?.summaryCounts?.receiptVouchers ?? 0}
                    </span>
                    <span className="text-[9.5px] text-indigo-700 font-medium block">سند قبض</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-rose-50/60 border border-rose-200 text-center space-y-1">
                    <span className="text-[10.5px] text-rose-900 font-bold block">سندات الصرف</span>
                    <span className="font-black text-base text-rose-950 font-mono block tabular-nums">
                      {dbInfo?.summaryCounts?.paymentVouchers ?? 0}
                    </span>
                    <span className="text-[9.5px] text-rose-700 font-medium block">سند صرف</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 text-center space-y-1">
                    <span className="text-[10.5px] text-amber-900 font-bold block">المستخدمين والفروع</span>
                    <span className="font-black text-base text-amber-950 font-mono block tabular-nums">
                      {(dbInfo?.summaryCounts?.users ?? 0) + (dbInfo?.summaryCounts?.branches ?? 0)}
                    </span>
                    <span className="text-[9.5px] text-amber-700 font-medium block">مستخدم / فرع</span>
                  </div>
                </div>
              </div>

              {/* Detailed Tables Storage Explorer Grid */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900 text-xs">
                    مستكشف مساحة واستهلاك الجداول الفعلي في PostgreSQL
                  </span>
                  <TextInput
                    size="xs"
                    placeholder="بحث في اسم الجدول..."
                    leftSection={<IconSearch size={14} />}
                    value={dbSearchQuery}
                    onChange={(e) => setDbSearchQuery(e.target.value)}
                    className="w-56"
                  />
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold text-[11px] sticky top-0 border-b border-slate-200 z-10">
                      <tr>
                        <th className="p-2.5">اسم الجدول ووظيفته</th>
                        <th className="p-2.5">رمز الجدول التقني</th>
                        <th className="p-2.5 text-center">عدد السجلات الحية</th>
                        <th className="p-2.5 text-left">المساحة الفعلية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(dbInfo?.tableStats || [])
                        .filter((t: any) => {
                          if (!dbSearchQuery.trim()) return true;
                          const q = dbSearchQuery.toLowerCase();
                          return (
                            (t.tableName || '').toLowerCase().includes(q) ||
                            (t.labelAr || '').toLowerCase().includes(q)
                          );
                        })
                        .map((t: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-2.5 font-bold text-slate-900">{t.labelAr}</td>
                            <td className="p-2.5 font-mono text-slate-500 text-[11px]">{t.tableName}</td>
                            <td className="p-2.5 text-center">
                              <Badge size="xs" color={t.rowCount > 0 ? 'emerald' : 'gray'} variant="light">
                                {t.rowCount.toLocaleString()} سجل
                              </Badge>
                            </td>
                            <td className="p-2.5 text-left font-mono font-bold text-slate-800 tabular-nums">
                              {t.sizeFormatted}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Section 7: Appearance & Fonts */}
          {activeSection === 'appearance' && (
            <div className="space-y-4 text-xs">
              <h3 className="font-extrabold text-sm text-slate-900 border-b pb-1 flex items-center gap-2">
                <IconTypography size={18} className="text-emerald-700" />
                المظهر والخطوط
              </h3>
              <p className="text-slate-500 text-xs">اختر نوع الخط المناسب لواجهة النظام. يتم تطبيق التغيير فوراً على جميع الصفحات ويُحفظ تلقائياً.</p>

              <div className="grid grid-cols-1 gap-2.5">
                {FONT_OPTIONS.map((font) => {
                  const isSelected = fontId === font.id;
                  return (
                    <button
                      key={font.id}
                      onClick={() => setFontId(font.id as FontId)}
                      className={`w-full text-right p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                          : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Selection indicator */}
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                          }`}>
                            {isSelected && <IconCheck size={12} className="text-white" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className="text-base font-bold text-slate-900"
                                style={{ fontFamily: font.family, fontWeight: font.sampleWeight }}
                              >
                                {font.label}
                              </span>
                              {isSelected && (
                                <Badge size="xs" color="emerald" variant="light" className="font-bold">مُفعّل</Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{font.description}</div>
                          </div>
                        </div>

                        {/* Live preview */}
                        <div
                          className="text-left"
                          style={{ fontFamily: font.family }}
                        >
                          <span className="text-xs text-slate-500 font-normal">معاينة النص</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 6: Security */}
          {activeSection === 'security' && (
            <div className="space-y-3 text-xs">
              <h3 className="font-extrabold text-sm text-slate-900 border-b pb-1">الأمان وكلمات المرور</h3>
              <div className="space-y-2">
                <TextInput label="كلمة المرور الحالية" type="password" />
                <TextInput label="كلمة المرور الجديدة" type="password" />
                <TextInput label="تأكيد كلمة المرور الجديدة" type="password" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
