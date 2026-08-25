import React, { useEffect, useState, useMemo, useRef } from 'react';
import { apiRequest } from '../api/client';
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
      const summaryData = await apiRequest('/api/cashboxes-banks/summary', noCacheOpt).catch(() => []);

      const formatItem = (item: any) => {
        const code = String(item.code || item.account?.code || '');
        const name = item.nameAr || item.account?.nameAr || '';
        const isMaster =
          code.startsWith('1343') ||
          code.startsWith('134213') ||
          code.startsWith('232146') ||
          code.startsWith('183') ||
          name.includes('ماستر');
        const isBank =
          !isMaster &&
          (code.startsWith('1342') ||
            code.startsWith('182') ||
            item.category === 'BANK' ||
            name.includes('مصرف') ||
            name.includes('بنك'));
        const itemType = isMaster ? 'MASTER' : isBank ? 'BANK' : 'CASHBOX';
        const isMain = Boolean(
          item.isMain ||
          code === '13411' ||
          code === '1341101' ||
          code === '11011' ||
          code === '18101' ||
          name.includes('حسابات الشركة') ||
          name.includes('الرئيسي')
        );
        const typeLabel = isMaster ? 'دفع إلكتروني / ماستر' : isBank ? 'حساب مصرفي' : isMain ? 'صندوق رئيسي' : 'صندوق فرعي';

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
    <div className="space-y-4 w-full text-xs">
      {/* Top Header & Actions */}
      <div className="flex flex-wrap justify-between items-center no-print gap-2 py-1">
        <div>
          <h1 className="font-black text-base text-slate-900 flex items-center gap-2">
            <IconCoins size={22} className="text-orange-600" />
            الصناديق والبنوك والدفع الإلكتروني
          </h1>
          <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
            إدارة النقدية، بطاقات Master والمحافظ الإلكترونية، والحسابات المصرفية (كلا العملتين IQD + USD)
          </span>
          <span className="text-[10px] text-slate-400 font-bold block mt-1">
            {hasLoadedOnce
              ? `آخر تحديث حقيقي: ${lastUpdatedAt?.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) || '-'}`
              : 'جاري جلب الأرصدة الحقيقية من القيود المحاسبية...'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {refreshing && (
            <Badge size="sm" color="blue" variant="light" className="font-extrabold">
              تحديث آني...
            </Badge>
          )}

          <Tooltip label="تحديث الأرصدة الآن من القيود الفعلية">
            <Button
              size="xs"
              variant="default"
              className="w-8 h-8 p-0 rounded-lg border-slate-200 hover:border-orange-300 hover:text-orange-600 cursor-pointer flex items-center justify-center"
              onClick={() => fetchCashAndBanks(true)}
              loading={refreshing}
            >
              <IconRefresh size={16} />
            </Button>
          </Tooltip>

          {/* Settings Icon Button for Customizing Visuals */}
          <Tooltip label="تخصيص وتعيين صور وبطاقات الصناديق والماستر">
            <Button
              size="xs"
              variant="default"
              className="w-8 h-8 p-0 rounded-lg border-slate-200 hover:border-orange-300 hover:text-orange-600 cursor-pointer flex items-center justify-center"
              onClick={() => {
                setSelectedAccountForVisual(null);
                setVisualModalOpen(true);
              }}
            >
              <IconSettings size={16} />
            </Button>
          </Tooltip>

          {/* View Mode Toggle */}
          <SegmentedControl
            size="xs"
            value={viewMode}
            onChange={(val: any) => setViewMode(val)}
            data={[
              { label: 'بطاقات وجدول', value: 'BOTH' },
              { label: 'البطاقات', value: 'CARDS' },
              { label: 'الجدول', value: 'GRID' },
            ]}
          />

          <Button
            size="xs"
            color="orange"
            leftSection={<IconPlus size={14} />}
            onClick={() => setCreateModalOpen(true)}
          >
            إضافة حساب مالي / صندوق / ماستر
          </Button>
        </div>
      </div>

      {/* Category Tabs Switcher */}
      <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200 max-w-2xl">
        <button
          type="button"
          onClick={() => setCategoryFilter('ALL')}
          className={`flex items-center justify-center gap-1.5 flex-1 py-1.5 rounded-lg font-extrabold text-xs transition-all cursor-pointer ${
            categoryFilter === 'ALL'
              ? 'bg-white text-orange-950 shadow-xs border border-orange-300'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <IconCoins size={14} className="text-orange-600" />
          <span>الكل ({counts.allCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter('CASHBOX')}
          className={`flex items-center justify-center gap-1.5 flex-1 py-1.5 rounded-lg font-extrabold text-xs transition-all cursor-pointer ${
            categoryFilter === 'CASHBOX'
              ? 'bg-white text-orange-950 shadow-xs border border-orange-300'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <IconWallet size={14} className="text-orange-600" />
          <span>الصناديق والقاصات ({counts.cashCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter('MASTER')}
          className={`flex items-center justify-center gap-1.5 flex-1 py-1.5 rounded-lg font-extrabold text-xs transition-all cursor-pointer ${
            categoryFilter === 'MASTER'
              ? 'bg-white text-blue-950 shadow-xs border border-blue-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <IconCreditCard size={14} className="text-blue-700" />
          <span>الدفع الإلكتروني والماستر ({counts.masterCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter('BANK')}
          className={`flex items-center justify-center gap-1.5 flex-1 py-1.5 rounded-lg font-extrabold text-xs transition-all cursor-pointer ${
            categoryFilter === 'BANK'
              ? 'bg-white text-indigo-950 shadow-xs border border-indigo-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <IconBuildingBank size={14} className="text-indigo-700" />
          <span>الحسابات المصرفية ({counts.bankCount})</span>
        </button>
      </div>

      {/* ULTRA-MODERN FINANCIAL CARDS GRID */}
      {(viewMode === 'CARDS' || viewMode === 'BOTH') && (
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
              <IconLayoutGrid size={15} className="text-orange-600" />
              بطاقات الأرصدة المالية
            </span>
            <span className="text-[11px] text-slate-500 font-bold">العدد: ({filteredList.length})</span>
          </div>

          {filteredList.length === 0 && loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse h-44"></div>
              ))}
            </div>
          ) : filteredList.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 font-bold">
              لا توجد حسابات مالية مطابقة للتصنيف المحدد.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredList.map((item) => {
                const iqdVal = item.balanceIQD ?? (item.currency === 'USD' ? (item.account?.balanceIQD || 0) : item.balanceVal);
                const usdVal = item.balanceUSD ?? (item.currency === 'USD' ? item.balanceVal : (item.account?.balanceUSD || 0));
                const isMaster = item.itemType === 'MASTER';
                const isBank = item.itemType === 'BANK';

                return (
                  <div
                    key={item.id || item.code}
                    className={`bg-white rounded-xl border shadow-2xs p-3 flex flex-col justify-between relative overflow-hidden transition-all ${
                      isMaster ? 'border-blue-200/90 hover:border-blue-400' : isBank ? 'border-indigo-200/90 hover:border-indigo-400' : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Header Badge & Card Visual Edit Button */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-black text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
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
                              className="w-5 h-5 rounded hover:bg-orange-100 text-slate-400 hover:text-orange-600 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <IconSettings size={12} />
                            </button>
                          </Tooltip>
                        </div>
                        <div className="flex items-center gap-1">
                          {item.isMain && (
                            <Badge
                              size="xs"
                              variant="filled"
                              color="yellow"
                              leftSection={<IconCrown size={11} />}
                              className="font-bold shadow-2xs"
                            >
                              الرئيسي
                            </Badge>
                          )}
                          <Badge
                            size="xs"
                            variant="light"
                            color={isMaster ? 'blue' : isBank ? 'indigo' : item.isMain ? 'yellow' : 'orange'}
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
                    <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                      <Button
                        size="xs"
                        variant="light"
                        color={isMaster ? 'blue' : isBank ? 'indigo' : 'orange'}
                        fullWidth
                        className="h-7 text-[10px] font-bold"
                        leftSection={<IconFileText size={12} />}
                        onClick={() => {
                          const targetId = item.accountId || item.id || item.account?.id;
                          openTab({ id: 'reports', title: 'كشف حساب وتقارير', path: `/reports?accountId=${targetId}&currency=ALL`, closable: true });
                          navigate(`/reports?accountId=${targetId}&currency=ALL`, { state: { accountId: targetId, currency: 'ALL' } });
                        }}
                      >
                        كشف الحساب
                      </Button>

                      <Button
                        size="xs"
                        variant="default"
                        color="gray"
                        className="h-7 w-7 p-0 shrink-0 flex items-center justify-center"
                        title="تفاصيل الحساب"
                        onClick={() => {
                          const targetId = item.accountId || item.id || item.account?.id;
                          openTab({ id: 'reports', title: 'كشف حساب وتقارير', path: `/reports?accountId=${targetId}&currency=ALL`, closable: true });
                          navigate(`/reports?accountId=${targetId}&currency=ALL`, { state: { accountId: targetId, currency: 'ALL' } });
                        }}
                      >
                        <IconArrowUpRight size={13} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ACCOUNTING GRID VIEW (TABULAR DETAILED VIEW) */}
      {(viewMode === 'GRID' || viewMode === 'BOTH') && (
        <div className="pt-2">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
              <IconTable size={15} className="text-orange-600" />
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
