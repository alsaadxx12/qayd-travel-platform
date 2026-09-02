import React, { useEffect, useState, useMemo, useRef } from 'react';
import { apiRequest } from '../api/client';
import { fetchPrintTemplate } from '../api/printTemplates';
import { AccountingGrid, AccountingColumnDef } from '../components/common/AccountingGrid';
import { Button, Badge, SegmentedControl, Tooltip } from '@mantine/core';
import {
  IconPlus,
  IconBuildingBank,
  IconWallet,
  IconArrowUpRight,
  IconFileText,
  IconLayoutGrid,
  IconTable,
  IconCreditCard,
  IconCoins,
  IconSettings,
  IconLock,
  IconCrown,
  IconRefresh,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { SmartAccountWizardModal } from '../components/accounts/SmartAccountWizardModal';
import {
  CardVisualSettingsModal,
  VisualSetting,
  CARD_PRESETS,
  SAFE_PRESETS,
  formatCardNumber,
} from '../components/cashboxes/CardVisualSettingsModal';

export const CashboxesBanksPage: React.FC = () => {
  const [cashboxes, setCashboxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [visualModalOpen, setVisualModalOpen] = useState(false);
  const [selectedAccountForVisual, setSelectedAccountForVisual] = useState<any>(null);
  const [visualSettings, setVisualSettings] = useState<Record<string, VisualSetting>>(() => {
    try {
      const stored = localStorage.getItem('cached_card_visuals_map');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });

  const handleSaveVisualSetting = (accountCode: string, setting: VisualSetting | null) => {
    setVisualSettings((prev) => {
      const updated = { ...prev };
      if (!setting) {
        delete updated[accountCode];
      } else {
        updated[accountCode] = setting;
      }
      try {
        localStorage.setItem('cached_card_visuals_map', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const [viewMode, setViewMode] = useState<'CARDS' | 'GRID' | 'BOTH'>('BOTH');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'CASHBOX' | 'MASTER' | 'BANK'>('ALL');

  const navigate = useNavigate();
  const { openTab } = useWorkspaceStore();

  const fetchCashAndBanks = async (forceRefresh = true) => {
    const initialLoad = !hasLoadedOnceRef.current;
    if (initialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const noCacheOpt = forceRefresh ? { noCache: true } : { ttl: 5000 };
      const [coreRes, summaryRes] = await Promise.allSettled([
        fetchPrintTemplate('core_accounts_mapping'),
        apiRequest('/api/cashboxes-banks/summary', noCacheOpt),
      ]);

      const coreConfig = coreRes.status === 'fulfilled' && coreRes.value ? coreRes.value.config : null;
      const configuredMainCashboxId = coreConfig?.mainCashboxId || null;

      let summaryData: any = summaryRes.status === 'fulfilled' ? summaryRes.value : null;

      /*
       * حين لا يُرجع الملخّص شيئاً فالمعنى أن لا صندوق مسجَّلاً — لا أن نبحث عنه
       * بالتخمين. المسار الاحتياطي القديم كان يجلب كل حساب يشبه اسمه صندوقاً،
       * فيعود العطل نفسه من بابٍ آخر. فلم يبقَ إلا الحسابات المصنَّفة نقديةً.
       */
      if (!summaryData || !Array.isArray(summaryData) || summaryData.length === 0) {
        const cashAccounts = await apiRequest('/api/accounts?category=CASH', noCacheOpt).catch(() => []);
        if (Array.isArray(cashAccounts)) {
          summaryData = cashAccounts;
        }
      }

      const formatItem = (item: any) => {
        const code = String(item.code || item.account?.code || '');
        const name = item.nameAr || item.account?.nameAr || '';
        const accId = item.id || item.accountId || item.account?.id;
        /*
         * التصنيف يأتي من الخادم، ولا يُعاد تخمينه هنا.
         *
         * كانت الشاشة تعيد تصنيف كل بطاقة ببادئة رقمها أو بكلمةٍ في اسمها، فيصير
         * كل حساب يبدأ بـ2614 «ماستر كارد» — وهي في الحقيقة حسابات المجهِّزين —
         * وكل اسم فيه «مصرف» بنكاً. والخادم يعرف مصدر كل بطاقة: سجلّ الصناديق، أو
         * تصنيف الشجرة، أو طريقة دفع معرَّفة. فيُؤخذ منه.
         *
         * ويبقى التخمين ملاذاً أخيراً لمسارٍ احتياطي لا يرسل itemType أصلاً.
         */
        const serverType = String(item.itemType || '').toUpperCase();
        const isMaster =
          serverType === 'MASTER' ||
          (!serverType &&
            (code.startsWith('1343') ||
              code.startsWith('134213') ||
              name.includes('ماستر') ||
              name.toLowerCase().includes('master')));
        const isBank =
          !isMaster &&
          (serverType === 'BANK' ||
            (!serverType &&
              (code.startsWith('1342') ||
                code.startsWith('182') ||
                code.startsWith('1112') ||
                item.category === 'BANK' ||
                name.includes('مصرف') ||
                name.includes('بنك') ||
                name.toLowerCase().includes('bank'))));
        const itemType = isMaster ? 'MASTER' : isBank ? 'BANK' : 'CASHBOX';

        const isConfiguredMain = Boolean(
          configuredMainCashboxId &&
          (accId === configuredMainCashboxId || item.id === configuredMainCashboxId || item.accountId === configuredMainCashboxId || item.account?.id === configuredMainCashboxId)
        );

        const isMain = isConfiguredMain || (
          !configuredMainCashboxId && (
            item.isMain ||
            code === '13411' ||
            code === '1341101' ||
            code === '11011' ||
            code === '18101' ||
            name.includes('حسابات الشركة') ||
            name.includes('الرئيسي')
          )
        );
        const typeLabel = isMaster
          ? (item.source === 'PAYMENT_METHOD' ? 'طريقة دفع معرَّفة' : 'دفع إلكتروني / ماستر')
          : isBank
          ? 'حساب مصرفي'
          : isMain
          ? 'صندوق رئيسي (معتمد)'
          : 'صندوق فرعي';

        return {
          ...item,
          id: item.id || item.accountId,
          code: item.code || item.account?.code,
          nameAr: item.nameAr || item.account?.nameAr,
          isMain,
          itemType,
          typeLabel,
          currency: item.currency || item.account?.currency || 'MULTI',
          balanceVal: Number(item.balance || 0),
          balanceIQD: Number(item.balanceIQD ?? (item.currency === 'USD' ? 0 : item.balance || 0)),
          balanceUSD: Number(item.balanceUSD ?? (item.currency === 'USD' ? item.balance || 0 : 0)),
          balancesLoaded: true,
        };
      };

      const combined = (Array.isArray(summaryData) ? summaryData : []).map(formatItem);
      setCashboxes(combined);
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
      setLastUpdatedAt(new Date());
    } catch (err) {
      console.error('Error fetching cashboxes and banks:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCashAndBanks(true);

    const intervalId = window.setInterval(() => {
      fetchCashAndBanks(true);
    }, 10000);

    const handleFocusRefresh = () => fetchCashAndBanks(true);
    const handleVisibilityRefresh = () => {
      if (document.visibilityState === 'visible') {
        fetchCashAndBanks(true);
      }
    };

    window.addEventListener('focus', handleFocusRefresh);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocusRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
    };
  }, []);

  // Filtered List based on Category Selection
  const filteredList = useMemo(() => {
    if (categoryFilter === 'ALL') return cashboxes;
    return cashboxes.filter(c => c.itemType === categoryFilter);
  }, [cashboxes, categoryFilter]);

  const counts = useMemo(() => {
    const cashCount = cashboxes.filter(c => c.itemType === 'CASHBOX').length;
    const masterCount = cashboxes.filter(c => c.itemType === 'MASTER').length;
    const bankCount = cashboxes.filter(c => c.itemType === 'BANK').length;
    return { cashCount, masterCount, bankCount, allCount: cashboxes.length };
  }, [cashboxes]);

  const columnDefs: AccountingColumnDef[] = [
    {
      field: 'code',
      headerText: 'كود الحساب',
      width: 'w-28',
      isPinned: true,
      render: (r) => (
        <span className="font-mono font-black text-orange-800 text-xs tracking-wider px-2 py-0.5 bg-orange-50 rounded border border-orange-200/80">
          {r.code}
        </span>
      ),
    },
    {
      field: 'nameAr',
      headerText: 'اسم الحساب المالـي (في الدليل المحاسبي)',
      width: 'w-72',
      isPinned: true,
      render: (r) => (
        <div className="flex items-center gap-2">
          {r.itemType === 'MASTER' ? (
            <div className="w-7 h-7 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200">
              <IconCreditCard size={16} />
            </div>
          ) : r.itemType === 'BANK' ? (
            <div className="w-7 h-7 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200">
              <IconBuildingBank size={16} />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-md bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 border border-orange-200">
              <IconWallet size={16} />
            </div>
          )}
          <div>
            <span className="font-bold text-slate-900 block text-xs">{r.nameAr}</span>
            {r.nameEn && <span className="text-[10px] text-slate-400 font-mono block">{r.nameEn}</span>}
          </div>
        </div>
      ),
    },
    {
      field: 'itemType',
      headerText: 'نوع الحساب',
      width: 'w-36',
      align: 'center',
      render: (r) => (
        <Badge
          size="xs"
          variant="light"
          color={r.itemType === 'MASTER' ? 'blue' : r.itemType === 'BANK' ? 'indigo' : 'orange'}
        >
          {r.typeLabel}
        </Badge>
      ),
    },
    {
      field: 'currency',
      headerText: 'العملة المعينة',
      width: 'w-28',
      align: 'center',
      render: (r) => {
        const curr = r.currency || 'MULTI';
        if (curr === 'MULTI') {
          return <Badge size="xs" variant="gradient" gradient={{ from: 'orange', to: 'amber' }}>كلا العملتين (IQD + USD)</Badge>;
        }
        if (curr === 'USD') {
          return <Badge size="xs" color="blue" variant="filled">USD ($)</Badge>;
        }
        return <Badge size="xs" color="orange" variant="light">IQD (د.ع)</Badge>;
      },
    },
    {
      field: 'balanceUSD',
      headerText: 'الرصيد بالدولار ($)',
      width: 'w-40',
      align: 'left',
      isMonetary: true,
      render: (r) => {
        const val = Number(r.balanceUSD || 0);
        return (
          <div className="text-left font-mono">
            <span className={`font-black text-xs tabular-nums px-2 py-0.5 rounded border block ${
              val !== 0 ? 'text-blue-700 bg-blue-50/80 border-blue-200/60' : 'text-slate-400 bg-slate-50 border-slate-200/50'
            }`}>
              ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        );
      },
    },
    {
      field: 'balanceIQD',
      headerText: 'الرصيد بالدينار (د.ع)',
      width: 'w-44',
      align: 'left',
      isMonetary: true,
      render: (r) => {
        const val = Number(r.balanceIQD || 0);
        return (
          <div className="text-left font-mono">
            <span className={`font-black text-xs tabular-nums px-2 py-0.5 rounded border block ${
              val !== 0 ? 'text-orange-900 bg-orange-50/80 border-orange-200/80' : 'text-slate-400 bg-slate-50 border-slate-200/50'
            }`}>
              {val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-[10px] font-bold text-slate-500">د.ع</span>
            </span>
          </div>
        );
      },
    },
    {
      field: 'isActive',
      headerText: 'حالة الحساب',
      width: 'w-24',
      align: 'center',
      render: () => <Badge size="xs" color="orange" variant="dot">نشـط</Badge>,
    },
  ];

  const totalSummary = useMemo(() => {
    let totalIQD = 0;
    let totalUSD = 0;
    filteredList.forEach((c) => {
      totalIQD += Number(c.balanceIQD || 0);
      totalUSD += Number(c.balanceUSD || 0);
    });
    return { totalIQD, totalUSD };
  }, [filteredList]);

  const renderCardVisual = (item: any) => {
    const code = String(item.code || '');
    const setting = visualSettings[code];
    const isMaster = item.itemType === 'MASTER';
    const isBank = item.itemType === 'BANK';
    const scale = setting?.scale || 100;
    const iqdVal = item.balanceIQD ?? (item.currency === 'USD' ? (item.account?.balanceIQD || 0) : item.balanceVal);
    const usdVal = item.balanceUSD ?? (item.currency === 'USD' ? item.balanceVal : (item.account?.balanceUSD || 0));

    // Master / Electronic Card full realistic visual with live printed balances & card number
    if (isMaster) {
      const isCustom = setting?.type === 'CUSTOM_IMAGE' && setting.imageUrl;
      const presetId = setting?.presetId || 'CARD_ROYAL_BLUE';
      const preset = CARD_PRESETS.find((p) => p.id === presetId) || CARD_PRESETS[0];

      return (
        <div className="w-full py-1 flex items-center justify-center overflow-hidden">
          <div
            className="w-full h-50 rounded-2xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden transition-all duration-200 border border-white/20 select-none"
            dir="ltr"
            style={{
              background: isCustom
                ? `url(${setting.imageUrl}) center/cover no-repeat`
                : preset.bg,
              color: preset.textColor || '#ffffff',
              transform: `scale(${scale / 100})`,
              transformOrigin: 'center center',
            }}
          >
            {/* Glossy reflective angle sheen & radial depth */}
            <div
              className="absolute inset-0 pointer-events-none z-1"
              style={{
                background:
                  'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.05) 45%, transparent 70%), linear-gradient(120deg, rgba(255,255,255,0.15) 0%, transparent 50%)',
              }}
            />

            {/* Subtle dark glass overlay when custom image is used */}
            {isCustom && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/30 z-0" />
            )}

            {/* 1. TOP ROW: Brand Name (Left) & Contactless + Code (Right) */}
            <div className="flex justify-between items-center w-full z-10">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-xs animate-pulse" />
                <span className="text-[11px] font-black tracking-widest text-white drop-shadow-sm uppercase">
                  {preset.logo === 'QI_CARD'
                    ? 'QI CARD'
                    : preset.logo === 'ZAIN_CASH'
                    ? 'ZAIN CASH'
                    : preset.logo === 'FIB'
                    ? 'FIB BANK'
                    : 'MASTERCARD'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Contactless Wave Icon */}
                <svg className="w-4 h-4 text-white/80 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                  <path d="M8.5 15.55a6 6 0 0 1 7 0" />
                  <path d="M12 18.55h.01" />
                </svg>

                <span className="text-[10px] font-mono font-bold text-white/90 bg-white/10 backdrop-blur-xs px-2 py-0.5 rounded-md border border-white/15">
                  #{item.code}
                </span>
              </div>
            </div>

            {/* 2. SECOND ROW: EMV Microchip */}
            <div className="z-10 flex items-center justify-start mt-0.5">
              <div
                className="w-9 h-7 rounded-md shadow-md flex flex-col justify-around p-1 border border-amber-300/60 relative overflow-hidden"
                style={{
                  background:
                    'linear-gradient(135deg, #fef08a 0%, #eab308 40%, #ca8a04 75%, #fef08a 100%)',
                }}
              >
                <div className="w-full h-px bg-amber-950/50" />
                <div className="w-full h-px bg-amber-950/50" />
                <div className="w-full h-px bg-amber-950/50" />
              </div>
            </div>

            {/* 3. MIDDLE: FLOATING BALANCES CAPSULE (الرصيد المالي المباشر) */}
            <div className="z-10 bg-slate-950/55 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/20 my-0.5 grid grid-cols-2 gap-3 text-center shadow-inner" dir="rtl">
              <div className="border-l border-white/15 pl-2">
                <span className="text-[8px] text-amber-200/90 font-bold block leading-none mb-0.5">رصيد الدينار</span>
                <span className="text-[12px] font-black text-amber-300 font-mono block drop-shadow-sm tabular-nums leading-tight">
                  {Number(iqdVal).toLocaleString('en-US')} <span className="text-[8px]">د.ع</span>
                </span>
              </div>
              <div className="pr-2">
                <span className="text-[8px] text-emerald-200/90 font-bold block leading-none mb-0.5">رصيد الدولار</span>
                <span className="text-[12px] font-black text-emerald-300 font-mono block drop-shadow-sm tabular-nums leading-tight">
                  ${Number(usdVal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* 4. CARD NUMBER ROW */}
            <div className="z-10 text-left px-0.5" dir="ltr">
              <span
                className="font-mono font-bold text-[13px] tracking-[0.18em] text-white drop-shadow-md block opacity-95"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.85)' }}
              >
                {formatCardNumber(setting?.cardNumber)}
              </span>
            </div>

            {/* 5. BOTTOM ROW: Cardholder (Left) & Mastercard Logo (Right) */}
            <div className="flex justify-between items-end w-full z-10 pt-0.5" dir="ltr">
              <div className="truncate max-w-[170px] text-left">
                <span className="text-[7.5px] font-mono tracking-wider text-white/70 block uppercase leading-none font-bold">
                  CARDHOLDER
                </span>
                <span className="font-extrabold text-white text-xs drop-shadow-sm block truncate mt-0.5" dir="rtl">
                  {setting?.cardHolder || item.nameAr}
                </span>
              </div>

              {/* Authentic Mastercard Interlocking Symbol */}
              <div className="flex items-center -space-x-2 shrink-0">
                <div className="w-5 h-5 rounded-full bg-[#eb001b] shadow-md" />
                <div className="w-5 h-5 rounded-full bg-[#f79e1b] opacity-90 shadow-md mix-blend-screen" />
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 2. Bank Account Visual
    if (isBank) {
      return (
        <div className="w-full py-1 flex items-center justify-center overflow-hidden">
          <div
            className="w-full h-50 rounded-2xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden transition-all duration-200 border border-white/20 select-none bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white"
            dir="ltr"
            style={{
              transform: `scale(${scale / 100})`,
              transformOrigin: 'center center',
            }}
          >
            {/* Top Bar */}
            <div className="flex justify-between items-center w-full z-10">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-xs animate-pulse" />
                <span className="text-[11px] font-black tracking-widest text-indigo-200 uppercase">BANK ACCOUNT</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-white/90 bg-white/10 px-2 py-0.5 rounded-md border border-white/15">
                #{item.code}
              </span>
            </div>

            {/* Middle: Live Balances */}
            <div className="z-10 bg-slate-950/60 backdrop-blur-md rounded-xl px-3 py-2 border border-white/20 my-0.5 grid grid-cols-2 gap-3 text-center shadow-inner" dir="rtl">
              <div className="border-l border-white/15 pl-2">
                <span className="text-[8px] text-amber-200/90 font-bold block leading-none mb-0.5">رصيد الدينار</span>
                <span className="text-[12px] font-black text-amber-300 font-mono block drop-shadow-sm tabular-nums leading-tight">
                  {Number(iqdVal).toLocaleString('en-US')} <span className="text-[8px]">د.ع</span>
                </span>
              </div>
              <div className="pr-2">
                <span className="text-[8px] text-emerald-200/90 font-bold block leading-none mb-0.5">رصيد الدولار</span>
                <span className="text-[12px] font-black text-emerald-300 font-mono block drop-shadow-sm tabular-nums leading-tight">
                  ${Number(usdVal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="flex justify-between items-end w-full z-10" dir="rtl">
              <span className="font-extrabold text-white text-xs drop-shadow-sm truncate">
                {item.nameAr}
              </span>
              <IconBuildingBank size={24} className="text-indigo-300 opacity-90 shrink-0" />
            </div>
          </div>
        </div>
      );
    }

    // 3. Cashbox / Safe Visual (Luxury Financial Card with Live Printed Balances)
    const isCustomSafe = setting?.type === 'CUSTOM_IMAGE' && setting.imageUrl;
    const safePresetId = setting?.presetId || 'SAFE_TITANIUM_STEEL';
    const safePreset = SAFE_PRESETS.find((p) => p.id === safePresetId) || SAFE_PRESETS[0];

    return (
      <div className="w-full py-1 flex items-center justify-center overflow-hidden">
        <div
          className="w-full h-50 rounded-2xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden transition-all duration-200 border border-white/20 select-none text-white"
          dir="ltr"
          style={{
            background: isCustomSafe
              ? `url(${setting.imageUrl}) center/cover no-repeat`
              : safePreset.bg,
            color: safePreset.textColor || '#ffffff',
            transform: `scale(${scale / 100})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Glossy reflective angle sheen & radial depth */}
          <div
            className="absolute inset-0 pointer-events-none z-1"
            style={{
              background:
                'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.05) 45%, transparent 70%), linear-gradient(120deg, rgba(255,255,255,0.15) 0%, transparent 50%)',
            }}
          />

          {/* Subtle dark glass overlay when custom image is used */}
          {isCustomSafe && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/30 z-0" />
          )}

          {/* 1. TOP ROW: Vault / Cashbox (Left) & Lock + Code (Right) */}
          <div className="flex justify-between items-center w-full z-10">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-xs animate-pulse" />
              <span className="text-[11px] font-black tracking-widest text-white drop-shadow-sm uppercase">
                SECURED VAULT
              </span>
            </div>

            <div className="flex items-center gap-2">
              <IconLock size={13} className="text-amber-400" />
              <span className="text-[10px] font-mono font-bold text-white/90 bg-white/10 backdrop-blur-xs px-2 py-0.5 rounded-md border border-white/15">
                #{item.code}
              </span>
            </div>
          </div>

          {/* 2. SECOND ROW: Vault Security Micro-dial / Chip */}
          <div className="z-10 flex items-center justify-start mt-0.5">
            <div
              className="w-9 h-7 rounded-md shadow-md flex flex-col justify-around p-1 border border-amber-300/60 relative overflow-hidden"
              style={{
                background:
                  'linear-gradient(135deg, #fef08a 0%, #eab308 40%, #ca8a04 75%, #fef08a 100%)',
              }}
            >
              <div className="w-full h-px bg-amber-950/50" />
              <div className="w-full h-px bg-amber-950/50" />
              <div className="w-full h-px bg-amber-950/50" />
            </div>
          </div>

          {/* 3. MIDDLE: FLOATING BALANCES CAPSULE (الرصيد المالي المباشر) */}
          <div className="z-10 bg-slate-950/55 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/20 my-0.5 grid grid-cols-2 gap-3 text-center shadow-inner" dir="rtl">
            <div className="border-l border-white/15 pl-2">
              <span className="text-[8px] text-amber-200/90 font-bold block leading-none mb-0.5">رصيد الدينار</span>
              <span className="text-[12px] font-black text-amber-300 font-mono block drop-shadow-sm tabular-nums leading-tight">
                {Number(iqdVal).toLocaleString('en-US')} <span className="text-[8px]">د.ع</span>
              </span>
            </div>
            <div className="pr-2">
              <span className="text-[8px] text-emerald-200/90 font-bold block leading-none mb-0.5">رصيد الدولار</span>
              <span className="text-[12px] font-black text-emerald-300 font-mono block drop-shadow-sm tabular-nums leading-tight">
                ${Number(usdVal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* 4. SAFE ID ROW */}
          <div className="z-10 text-left px-0.5" dir="ltr">
            <span
              className="font-mono font-bold text-[13px] tracking-[0.18em] text-white drop-shadow-md block opacity-95"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.85)' }}
            >
              {formatCardNumber(setting?.cardNumber || item.code)}
            </span>
          </div>

          {/* 5. BOTTOM ROW: Cashbox Name (Left) & Status Badge (Right) */}
          <div className="flex justify-between items-end w-full z-10 pt-0.5" dir="ltr">
            <div className="truncate max-w-[170px] text-left">
              <span className="text-[7.5px] font-mono tracking-wider text-white/70 block uppercase leading-none font-bold">
                CASHBOX / SAFE
              </span>
              <span className="font-extrabold text-white text-xs drop-shadow-sm block truncate mt-0.5" dir="rtl">
                {setting?.cardHolder || item.nameAr}
              </span>
            </div>

            {/* Cash Badge */}
            <div className="flex items-center gap-1 opacity-80 shrink-0">
              <span className="text-[9px] font-mono font-bold text-slate-200 bg-white/10 px-1.5 py-0.5 rounded border border-white/15">
                CASH
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
            <IconCoins size={22} stroke={2} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-bold text-[20px] text-[#111827] leading-tight">
                الصناديق والبنوك والدفع الإلكتروني
              </h1>
            </div>
            <p className="text-[13px] font-normal text-[#64748B] mt-0.5">
              إدارة النقدية، بطاقات Master والمحافظ الإلكترونية، والحسابات المصرفية (كلا العملتين IQD + USD)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* زر إضافة حساب مالي / صندوق / ماستر */}
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="h-[44px] px-5 rounded-[10px] bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-[13.5px] shadow-xs flex items-center gap-2 transition-all cursor-pointer active:scale-98"
          >
            <IconPlus size={18} strokeWidth={2.4} />
            <span>إضافة حساب مالي / صندوق / ماستر</span>
          </button>

          {/* View Mode Toggle */}
          <SegmentedControl
            size="xs"
            radius="md"
            value={viewMode}
            onChange={(val: any) => setViewMode(val)}
            data={[
              { label: 'بطاقات وجدول', value: 'BOTH' },
              { label: 'البطاقات', value: 'CARDS' },
              { label: 'الجدول', value: 'GRID' },
            ]}
            color="orange"
            className="bg-slate-100 font-bold"
          />

          {/* Settings Icon Button */}
          <Tooltip label="تخصيص وتعيين صور وبطاقات الصناديق والماستر">
            <button
              type="button"
              onClick={() => {
                setSelectedAccountForVisual(null);
                setVisualModalOpen(true);
              }}
              className="h-[44px] w-[44px] rounded-[10px] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#334155] flex items-center justify-center cursor-pointer transition-colors shadow-2xs active:scale-98"
            >
              <IconSettings size={18} />
            </button>
          </Tooltip>

          {/* Refresh Button */}
          <Tooltip label="تحديث الأرصدة الآن من القيود الفعلية">
            <button
              type="button"
              onClick={() => fetchCashAndBanks(true)}
              disabled={refreshing}
              className="h-[44px] w-[44px] rounded-[10px] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#334155] flex items-center justify-center cursor-pointer transition-colors shadow-2xs active:scale-98 disabled:opacity-50"
            >
              <IconRefresh size={18} className={refreshing ? 'animate-spin text-[#F45A0A]' : ''} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          2. CATEGORY FILTER TABS
         ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-2.5 shadow-2xs flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setCategoryFilter('ALL')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-[9px] font-bold text-xs transition-all cursor-pointer ${
              categoryFilter === 'ALL'
                ? 'bg-[#F45A0A] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <IconCoins size={15} />
            <span>الكل ({counts.allCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter('CASHBOX')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-[9px] font-bold text-xs transition-all cursor-pointer ${
              categoryFilter === 'CASHBOX'
                ? 'bg-[#F45A0A] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <IconWallet size={15} />
            <span>الصناديق والقاصات ({counts.cashCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter('MASTER')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-[9px] font-bold text-xs transition-all cursor-pointer ${
              categoryFilter === 'MASTER'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <IconCreditCard size={15} />
            <span>الدفع الإلكتروني والماستر ({counts.masterCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter('BANK')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-[9px] font-bold text-xs transition-all cursor-pointer ${
              categoryFilter === 'BANK'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <IconBuildingBank size={15} />
            <span>الحسابات المصرفية ({counts.bankCount})</span>
          </button>
        </div>

        {hasLoadedOnce && lastUpdatedAt && (
          <span className="text-[11px] font-mono text-slate-500 font-bold px-2 py-1 bg-slate-50 rounded-[6px] border border-slate-200">
            آخر تحديث: {lastUpdatedAt.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          3. FINANCIAL CARDS GRID
         ══════════════════════════════════════════════════════════════ */}
      {(viewMode === 'CARDS' || viewMode === 'BOTH') && (
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-4 shadow-2xs space-y-3.5">
          <div className="flex justify-between items-center px-1">
            <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
              <IconLayoutGrid size={16} className="text-[#F45A0A]" />
              بطاقات الأرصدة المالية
            </span>
            <span className="text-[11px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-[6px] border border-slate-200">
              العدد: ({filteredList.length})
            </span>
          </div>

          {filteredList.length === 0 && loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-slate-50 rounded-[14px] border border-slate-200 p-4 animate-pulse h-48"></div>
              ))}
            </div>
          ) : filteredList.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/50 rounded-[14px] border border-dashed border-slate-200 text-slate-500 font-bold">
              لا توجد حسابات مالية مطابقة للتصنيف المحدد.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {filteredList.map((item) => {
                const isMaster = item.itemType === 'MASTER';
                const isBank = item.itemType === 'BANK';

                return (
                  <div
                    key={item.id || item.code}
                    className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs p-3.5 flex flex-col justify-between relative overflow-hidden transition-all hover:border-[#F45A0A]/60 hover:shadow-md group space-y-3"
                  >
                    <div>
                      {/* Header Badge & Card Visual Edit Button */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-[10.5px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded-[6px] border border-slate-200">
                            {item.code}
                          </span>
                          <Tooltip label="تغيير صورة وتصميم البطاقة / الصندوق">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAccountForVisual(item);
                                setVisualModalOpen(true);
                              }}
                              className="w-6 h-6 rounded-[6px] hover:bg-orange-100 text-slate-400 hover:text-[#F45A0A] flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <IconSettings size={13} />
                            </button>
                          </Tooltip>
                        </div>
                        <div className="flex items-center gap-1">
                          {item.isMain && (
                            <Badge
                              size="xs"
                              variant="filled"
                              color="yellow"
                              radius="sm"
                              leftSection={<IconCrown size={11} />}
                              className="font-bold shadow-2xs"
                            >
                              الرئيسي
                            </Badge>
                          )}
                          <Badge
                            size="xs"
                            variant="light"
                            radius="sm"
                            color={isMaster ? 'blue' : isBank ? 'indigo' : item.isMain ? 'yellow' : 'orange'}
                            className="font-bold"
                          >
                            {item.typeLabel}
                          </Badge>
                        </div>
                      </div>

                      {/* Visual Financial Card (Master, Safe, Bank) with live printed balances */}
                      <div className="flex flex-col items-center justify-center text-center">
                        {renderCardVisual(item)}
                      </div>
                    </div>

                    {/* Card Action Footer */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const targetId = item.accountId || item.id || item.account?.id;
                          openTab({ id: 'reports', title: 'كشف حساب وتقارير', path: `/reports?accountId=${targetId}&currency=ALL`, closable: true });
                          navigate(`/reports?accountId=${targetId}&currency=ALL`, { state: { accountId: targetId, currency: 'ALL' } });
                        }}
                        className="flex-1 h-[34px] rounded-[9px] bg-[#FFF3E8] hover:bg-[#F45A0A] text-[#F45A0A] hover:text-white font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 border border-orange-200/70"
                      >
                        <IconFileText size={14} />
                        <span>كشف الحساب</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const targetId = item.accountId || item.id || item.account?.id;
                          openTab({ id: 'reports', title: 'كشف حساب وتقارير', path: `/reports?accountId=${targetId}&currency=ALL`, closable: true });
                          navigate(`/reports?accountId=${targetId}&currency=ALL`, { state: { accountId: targetId, currency: 'ALL' } });
                        }}
                        className="h-[34px] w-[34px] rounded-[9px] bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center cursor-pointer transition-all active:scale-98 shrink-0"
                        title="تفاصيل الحساب"
                      >
                        <IconArrowUpRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          4. ACCOUNTING GRID VIEW (TABULAR DETAILED VIEW)
         ══════════════════════════════════════════════════════════════ */}
      {(viewMode === 'GRID' || viewMode === 'BOTH') && (
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs overflow-hidden p-4 space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
              <IconTable size={16} className="text-[#F45A0A]" />
              جدول التفاصيل الجردية
            </span>
          </div>

          <AccountingGrid
            gridKey="cashboxes_accounting_grid"
            title="الصناديق والبنوك والدفع الإلكتروني"
            data={filteredList}
            columnDefs={columnDefs}
            loading={loading && !hasLoadedOnce}
            onRefresh={fetchCashAndBanks}
            hideDateFilter={true}
            onRowDoubleClick={(row) => {
              const targetId = row.accountId || row.id || row.account?.id;
              openTab({ id: 'reports', title: 'كشف حساب وتقارير', path: `/reports?accountId=${targetId}&currency=ALL`, closable: true });
              navigate(`/reports?accountId=${targetId}&currency=ALL`, { state: { accountId: targetId, currency: 'ALL' } });
            }}
            typeFilterOptions={[]}
            customFooterSummary={
              <div className="flex items-center gap-6 text-xs font-bold font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-sans text-[11px]">إجمالي الدولار:</span>
                  <span className="text-blue-700 font-black text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    ${totalSummary.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-sans text-[11px]">إجمالي الدينار:</span>
                  <span className="text-orange-950 font-black text-xs bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                    {totalSummary.totalIQD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} د.ع
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-sans text-[11px]">عدد الحسابات:</span>
                  <span className="text-slate-700 font-black text-xs">{filteredList.length}</span>
                </div>
              </div>
            }
            actionMenuItems={[
              {
                label: 'كشف حساب تفصيلي',
                icon: <IconFileText size={14} className="text-orange-600" />,
                onClick: (row) => {
                  const targetId = row.accountId || row.id || row.account?.id;
                  openTab({ id: 'reports', title: 'كشف حساب وتقارير', path: `/reports?accountId=${targetId}&currency=ALL`, closable: true });
                  navigate(`/reports?accountId=${targetId}&currency=ALL`, { state: { accountId: targetId, currency: 'ALL' } });
                },
              },
              {
                label: 'عرض في شجرة الحسابات',
                icon: <IconArrowUpRight size={14} className="text-blue-600" />,
                onClick: () => {
                  navigate(`/accounts`);
                },
              },
            ]}
          />
        </div>
      )}

      {/* Smart Chart of Accounts Wizard Modal */}
      <SmartAccountWizardModal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={fetchCashAndBanks}
        defaultAccountType="CASHBOX"
      />

      {/* Card & Cashbox Visual Customizer Settings Modal */}
      <CardVisualSettingsModal
        opened={visualModalOpen}
        onClose={() => setVisualModalOpen(false)}
        cashboxes={cashboxes}
        initialSelectedAccount={selectedAccountForVisual}
        visualSettingsMap={visualSettings}
        onSaveSetting={handleSaveVisualSetting}
      />
    </div>
  );
};
