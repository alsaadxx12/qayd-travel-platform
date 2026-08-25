import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Tabs,
  Badge,
  FileInput,
  TextInput,
  Slider,
} from '@mantine/core';
import {
  IconSettings,
  IconCreditCard,
  IconWallet,
  IconBuildingBank,
  IconUpload,
  IconPhoto,
  IconCheck,
  IconRefresh,
  IconSparkles,
  IconLock,
  IconZoomIn,
  IconUser,
  IconNumber,
} from '@tabler/icons-react';

export interface VisualSetting {
  type: 'PRESET_CARD' | 'PRESET_SAFE' | 'CUSTOM_IMAGE';
  presetId?: string;
  imageUrl?: string;
  cardName?: string;
  cardNumber?: string;
  cardHolder?: string;
  scale?: number; // 70 to 160
}

export const CARD_PRESETS = [
  {
    id: 'CARD_ROYAL_BLUE',
    name: 'ماستركارد رويال كلاسيك',
    subtitle: 'أزرق ملكي مع شريحة ذهبية',
    type: 'MASTER',
    bg: 'linear-gradient(135deg, #0f172a 0%, #1e40af 45%, #3b82f6 75%, #1e3a8a 100%)',
    chipColor: '#fbbf24',
    logo: 'MASTERCARD',
    textColor: '#ffffff',
    borderColor: '#3b82f6',
  },
  {
    id: 'CARD_GOLD_VIP',
    name: 'ماستركارد ذهبية VIP',
    subtitle: 'ذهبي وبورسلان بريميوم',
    type: 'MASTER',
    bg: 'linear-gradient(135deg, #451a03 0%, #b45309 35%, #d97706 70%, #78350f 100%)',
    chipColor: '#fef08a',
    logo: 'MASTERCARD',
    textColor: '#ffffff',
    borderColor: '#f59e0b',
  },
  {
    id: 'CARD_QI_IRAQ',
    name: 'كي كارد / بطاقة الرافدين',
    subtitle: 'أخضر زمردي مع لمسات ذهبية',
    type: 'MASTER',
    bg: 'linear-gradient(135deg, #022c22 0%, #065f46 45%, #047857 75%, #022c22 100%)',
    chipColor: '#fde047',
    logo: 'QI_CARD',
    textColor: '#ffffff',
    borderColor: '#10b981',
  },
  {
    id: 'CARD_ZAIN_CASH',
    name: 'زين كاش / دفع إلكتروني',
    subtitle: 'بنفسجي وأحمر نيون مميز',
    type: 'MASTER',
    bg: 'linear-gradient(135deg, #4a044e 0%, #831843 45%, #be185d 80%, #701a75 100%)',
    chipColor: '#ffffff',
    logo: 'ZAIN_CASH',
    textColor: '#ffffff',
    borderColor: '#ec4899',
  },
  {
    id: 'CARD_BLACK_OBSIDIAN',
    name: 'فيزا بلاتينيوم بلاك',
    subtitle: 'أسود مطفي وألياف كربونية',
    type: 'MASTER',
    bg: 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #27272a 75%, #09090b 100%)',
    chipColor: '#94a3b8',
    logo: 'VISA_BLACK',
    textColor: '#ffffff',
    borderColor: '#475569',
  },
  {
    id: 'CARD_FIB_BANK',
    name: 'مصرف التنمية / FIB',
    subtitle: 'سماوي ونيلي احترافي',
    type: 'MASTER',
    bg: 'linear-gradient(135deg, #0e7490 0%, #0284c7 50%, #0c4a6e 100%)',
    chipColor: '#38bdf8',
    logo: 'FIB',
    textColor: '#ffffff',
    borderColor: '#06b6d4',
  },
  {
    id: 'CARD_VIOLET_NEO',
    name: 'فيوليت سايبر الرقمية',
    subtitle: 'تدرج بنفسجي متوهج',
    type: 'MASTER',
    bg: 'linear-gradient(135deg, #581c87 0%, #7c3aed 50%, #3b0764 100%)',
    chipColor: '#c084fc',
    logo: 'NEO_VIOLET',
    textColor: '#ffffff',
    borderColor: '#8b5cf6',
  },
  {
    id: 'CARD_ORANGE_CORP',
    name: 'بطاقة الشركة البرتقالية',
    subtitle: 'هوية البرنامج الرسمية',
    type: 'MASTER',
    bg: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 45%, #c2410c 75%, #431407 100%)',
    chipColor: '#fed7aa',
    logo: 'ORANGE_CORP',
    textColor: '#ffffff',
    borderColor: '#f97316',
  },
];

export const SAFE_PRESETS = [
  {
    id: 'SAFE_TITANIUM_STEEL',
    name: 'قاصة رقمية تيتانيوم مصفحة',
    subtitle: 'خزنة فولاذية إلكترونية مؤمّنة بشاشة رقمية',
    type: 'CASHBOX',
    bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #334155 75%, #020617 100%)',
    lockColor: '#38bdf8',
    logo: 'TITANIUM_VAULT',
    textColor: '#ffffff',
  },
  {
    id: 'SAFE_GOLD_BULLION',
    name: 'خزينة مصرفية ذهبية VIP',
    subtitle: 'خزنة سبائك ذهبية ثقيلة عالية الأمان',
    type: 'CASHBOX',
    bg: 'linear-gradient(135deg, #451a03 0%, #b45309 35%, #d97706 70%, #78350f 100%)',
    lockColor: '#fbbf24',
    logo: 'GOLD_VAULT',
    textColor: '#ffffff',
  },
  {
    id: 'SAFE_EMERALD_VAULT',
    name: 'قاصة مصرفية زمردية',
    subtitle: 'خزنة أمانات خضراء مع لمسات ذهبية',
    type: 'CASHBOX',
    bg: 'linear-gradient(135deg, #022c22 0%, #065f46 45%, #047857 75%, #022c22 100%)',
    lockColor: '#34d399',
    logo: 'EMERALD_VAULT',
    textColor: '#ffffff',
  },
  {
    id: 'SAFE_EXECUTIVE_BLACK',
    name: 'خزنة أمنية سوداء مصفحة',
    subtitle: 'تصميم أسود مطفي عالي السرية',
    type: 'CASHBOX',
    bg: 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #27272a 75%, #09090b 100%)',
    lockColor: '#94a3b8',
    logo: 'BLACK_VAULT',
    textColor: '#ffffff',
  },
  {
    id: 'SAFE_AMBER_CORP',
    name: 'صندوق النقدية البرتقالي',
    subtitle: 'صندوق حركة المقبوضات والسيولة اليومية',
    type: 'CASHBOX',
    bg: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 45%, #c2410c 75%, #431407 100%)',
    lockColor: '#fed7aa',
    logo: 'CASH_BOX',
    textColor: '#ffffff',
  },
  {
    id: 'SAFE_ROYAL_NAVY',
    name: 'خزنة مصرفية ملكية نيلية',
    subtitle: 'خزنة حفظ الودائع والسيولة الكبرى',
    type: 'CASHBOX',
    bg: 'linear-gradient(135deg, #0f172a 0%, #1e40af 45%, #3b82f6 75%, #1e3a8a 100%)',
    lockColor: '#60a5fa',
    logo: 'NAVY_VAULT',
    textColor: '#ffffff',
  },
];

// Helper to format card / safe number with spaces (e.g. 5399 1234 5678 9012)
export const formatCardNumber = (raw?: string) => {
  if (!raw) return '•••• •••• •••• 8890';
  const clean = raw.replace(/\D/g, '').slice(0, 16);
  if (clean.length === 0) return '•••• •••• •••• 8890';
  const chunks = clean.match(/.{1,4}/g) || [];
  return chunks.join(' ');
};

interface CardVisualSettingsModalProps {
  opened: boolean;
  onClose: () => void;
  cashboxes: any[];
  initialSelectedAccount?: any;
  visualSettingsMap: Record<string, VisualSetting>;
  onSaveSetting: (accountCode: string, setting: VisualSetting | null) => void;
}

export const CardVisualSettingsModal: React.FC<CardVisualSettingsModalProps> = ({
  opened,
  onClose,
  cashboxes,
  initialSelectedAccount,
  visualSettingsMap,
  onSaveSetting,
}) => {
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('PRESETS');
  const [customImageUrl, setCustomImageUrl] = useState<string>('');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardHolder, setCardHolder] = useState<string>('');
  const [scale, setScale] = useState<number>(100);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Sync selected account when opened
  useEffect(() => {
    if (opened) {
      const code = initialSelectedAccount?.code || cashboxes[0]?.code || '';
      setSelectedCode(code);
    }
  }, [opened, initialSelectedAccount, cashboxes]);

  // Sync current settings when selectedCode changes
  useEffect(() => {
    if (selectedCode) {
      const curSetting = visualSettingsMap[selectedCode];
      const acc = cashboxes.find((c) => c.code === selectedCode);

      if (curSetting) {
        if (curSetting.type === 'CUSTOM_IMAGE') {
          setActiveTab('UPLOAD');
          setCustomImageUrl(curSetting.imageUrl || '');
          setSelectedPresetId('');
        } else {
          setActiveTab('PRESETS');
          setSelectedPresetId(curSetting.presetId || '');
          setCustomImageUrl('');
        }
        setCardNumber(curSetting.cardNumber || '');
        setCardHolder(curSetting.cardHolder || acc?.nameAr || '');
        setScale(curSetting.scale || 100);
      } else {
        // Defaults
        if (acc?.itemType === 'MASTER') {
          setSelectedPresetId('CARD_ROYAL_BLUE');
        } else {
          setSelectedPresetId('SAFE_TITANIUM_STEEL');
        }
        setCustomImageUrl('');
        setCardNumber('');
        setCardHolder(acc?.nameAr || '');
        setScale(100);
        setActiveTab('PRESETS');
      }
    }
  }, [selectedCode, visualSettingsMap, cashboxes]);

  const currentAccount = cashboxes.find((c) => c.code === selectedCode);
  const isMaster = currentAccount?.itemType === 'MASTER';
  const isBank = currentAccount?.itemType === 'BANK';

  // Handle local file upload to Base64
  const handleFileUpload = (file: File | null) => {
    setUploadedFile(file);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setCustomImageUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleApplyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    setCustomImageUrl('');
    const setting: VisualSetting = {
      type: isMaster ? 'PRESET_CARD' : 'PRESET_SAFE',
      presetId,
      cardNumber,
      cardHolder: cardHolder || currentAccount?.nameAr,
      scale,
    };
    onSaveSetting(selectedCode, setting);
  };

  const handleSaveAll = () => {
    const isCustom = activeTab === 'UPLOAD' && customImageUrl;
    const setting: VisualSetting = {
      type: isCustom ? 'CUSTOM_IMAGE' : isMaster ? 'PRESET_CARD' : 'PRESET_SAFE',
      presetId: isCustom ? undefined : selectedPresetId || (isMaster ? 'CARD_ROYAL_BLUE' : 'SAFE_TITANIUM_STEEL'),
      imageUrl: isCustom ? customImageUrl : undefined,
      cardNumber,
      cardHolder: cardHolder || currentAccount?.nameAr,
      scale,
    };
    onSaveSetting(selectedCode, setting);
  };

  const handleResetToDefault = () => {
    onSaveSetting(selectedCode, null);
    setSelectedPresetId(isMaster ? 'CARD_ROYAL_BLUE' : 'SAFE_TITANIUM_STEEL');
    setCustomImageUrl('');
    setCardNumber('');
    setCardHolder(currentAccount?.nameAr || '');
    setScale(100);
    setUploadedFile(null);
  };

  // Active selected preset details
  const activePreset = isMaster
    ? CARD_PRESETS.find((p) => p.id === selectedPresetId) || CARD_PRESETS[0]
    : SAFE_PRESETS.find((p) => p.id === selectedPresetId) || SAFE_PRESETS[0];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      centered
      title={
        <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
          <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
            <IconSettings size={18} />
          </div>
          <div>
            <span>تخصيص وتعيين صور وبطاقات الصناديق والماستر</span>
            <span className="block text-[11px] text-slate-400 font-medium">
              تحديد المظهر، الأرقام المطبوعة، وحجم البطاقة / القاصة
            </span>
          </div>
        </div>
      }
      styles={{ body: { padding: '16px 20px' } }}
    >
      <div className="space-y-4" dir="rtl">
        {/* 1. Account Selector Chips */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            اختر الحساب المالي / الصندوق المراد تخصيصه:
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200">
            {cashboxes.map((acc) => {
              const isSelected = acc.code === selectedCode;
              const isAccMaster = acc.itemType === 'MASTER';
              const isAccBank = acc.itemType === 'BANK';
              return (
                <button
                  key={acc.code}
                  type="button"
                  onClick={() => setSelectedCode(acc.code)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {isAccMaster ? (
                    <IconCreditCard size={13} className={isSelected ? 'text-white' : 'text-blue-600'} />
                  ) : isAccBank ? (
                    <IconBuildingBank size={13} className={isSelected ? 'text-white' : 'text-indigo-600'} />
                  ) : (
                    <IconWallet size={13} className={isSelected ? 'text-white' : 'text-orange-600'} />
                  )}
                  <span>{acc.nameAr}</span>
                  <span
                    className={`font-mono text-[10px] px-1 py-0.2 rounded ${
                      isSelected ? 'bg-orange-700 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {acc.code}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. REALISTIC LIVE PREVIEW CARD */}
        {currentAccount && (
          <div className="p-3 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 rounded-2xl text-white shadow-md border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-orange-400 flex items-center gap-1.5">
                <IconSparkles size={14} />
                معاينة حية ومباشرة للبطاقة في النظام:
              </span>
              <Badge size="xs" color="orange" variant="filled">
                {currentAccount.typeLabel} · {currentAccount.code}
              </Badge>
            </div>

            {/* Render Realistic Card Preview */}
            <div className="flex justify-center items-center py-2 overflow-hidden">
              <div
                className="w-full max-w-sm h-50 rounded-2xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden transition-all duration-200 border border-white/20 select-none text-white"
                dir="ltr"
                style={{
                  background:
                    activeTab === 'UPLOAD' && customImageUrl
                      ? `url(${customImageUrl}) center/cover no-repeat`
                      : activePreset.bg,
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
                {activeTab === 'UPLOAD' && customImageUrl && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/30 z-0" />
                )}

                {/* 1. TOP ROW */}
                <div className="flex justify-between items-center w-full z-10">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shadow-xs animate-pulse" />
                    <span className="text-[11px] font-black tracking-widest text-white drop-shadow-sm uppercase">
                      {isMaster
                        ? activePreset.logo === 'QI_CARD'
                          ? 'QI CARD'
                          : activePreset.logo === 'ZAIN_CASH'
                          ? 'ZAIN CASH'
                          : activePreset.logo === 'FIB'
                          ? 'FIB BANK'
                          : 'MASTERCARD'
                        : isBank
                        ? 'BANK ACCOUNT'
                        : 'SECURED VAULT'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Contactless Wave or Lock Icon */}
                    {isMaster ? (
                      <svg className="w-4 h-4 text-white/80 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                        <path d="M8.5 15.55a6 6 0 0 1 7 0" />
                        <path d="M12 18.55h.01" />
                      </svg>
                    ) : (
                      <IconLock size={13} className="text-amber-400" />
                    )}

                    <span className="text-[10px] font-mono font-bold text-white/90 bg-white/10 backdrop-blur-xs px-2 py-0.5 rounded-md border border-white/15">
                      #{currentAccount.code}
                    </span>
                  </div>
                </div>

                {/* 2. SECOND ROW: Microchip / Dial */}
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

                {/* 3. MIDDLE: FLOATING BALANCES CAPSULE */}
                <div className="z-10 bg-slate-950/55 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/20 my-0.5 grid grid-cols-2 gap-3 text-center shadow-inner" dir="rtl">
                  <div className="border-l border-white/15 pl-2">
                    <span className="text-[8px] text-amber-200/90 font-bold block leading-none mb-0.5">رصيد الدينار</span>
                    <span className="text-[12px] font-black text-amber-300 font-mono block drop-shadow-sm tabular-nums leading-tight">
                      {Number(currentAccount.balanceIQD || 0).toLocaleString('en-US')} <span className="text-[8px]">د.ع</span>
                    </span>
                  </div>
                  <div className="pr-2">
                    <span className="text-[8px] text-emerald-200/90 font-bold block leading-none mb-0.5">رصيد الدولار</span>
                    <span className="text-[12px] font-black text-emerald-300 font-mono block drop-shadow-sm tabular-nums leading-tight">
                      ${Number(currentAccount.balanceUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* 4. CARD / ACCOUNT NUMBER ROW */}
                <div className="z-10 text-left px-0.5" dir="ltr">
                  <span
                    className="font-mono font-bold text-[13px] tracking-[0.18em] text-white drop-shadow-md block opacity-95"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.85)' }}
                  >
                    {formatCardNumber(cardNumber || currentAccount.code)}
                  </span>
                </div>

                {/* 5. BOTTOM ROW: Cardholder (Left) & Brand / Logo (Right) */}
                <div className="flex justify-between items-end w-full z-10 pt-0.5" dir="ltr">
                  <div className="truncate max-w-[170px] text-left">
                    <span className="text-[7.5px] font-mono tracking-wider text-white/70 block uppercase leading-none font-bold">
                      {isMaster ? 'CARDHOLDER' : 'ACCOUNT NAME'}
                    </span>
                    <span className="font-extrabold text-white text-xs drop-shadow-sm block truncate mt-0.5" dir="rtl">
                      {cardHolder || currentAccount.nameAr}
                    </span>
                  </div>

                  {/* Logo / Symbol */}
                  {isMaster ? (
                    <div className="flex items-center -space-x-2 shrink-0">
                      <div className="w-5 h-5 rounded-full bg-[#eb001b] shadow-md" />
                      <div className="w-5 h-5 rounded-full bg-[#f79e1b] opacity-90 shadow-md mix-blend-screen" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 opacity-80 shrink-0">
                      <span className="text-[9px] font-mono font-bold text-slate-200 bg-white/10 px-1.5 py-0.5 rounded border border-white/15">
                        {isBank ? 'BANK' : 'CASH'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Card Number, Holder & Zoom Controls */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextInput
              label={isMaster ? 'رقم حساب / بطاقة الماستر (16 رقم):' : 'رقم تعريف الصندوق / الحساب:'}
              placeholder={isMaster ? '5399 2300 4812 8890' : currentAccount?.code}
              value={cardNumber}
              onChange={(e) => setCardNumber(e.currentTarget.value)}
              leftSection={<IconNumber size={14} />}
              styles={{ input: { fontSize: '12px', fontFamily: 'monospace', direction: 'ltr' } }}
            />

            <TextInput
              label={isMaster ? 'اسم حامل البطاقة المطبوع:' : 'اسم الصندوق / الحساب المطبوع:'}
              placeholder={currentAccount?.nameAr || 'صندوق المحل الرئيسي'}
              value={cardHolder}
              onChange={(e) => setCardHolder(e.currentTarget.value)}
              leftSection={<IconUser size={14} />}
              styles={{ input: { fontSize: '12px' } }}
            />
          </div>

          {/* Scale / Zoom Slider */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <IconZoomIn size={14} className="text-orange-600" />
                تكبير وتصغير حجم البطاقة / الصورة في الشاشة:
              </span>
              <span className="font-mono font-bold text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                {scale}%
              </span>
            </div>

            <Slider
              value={scale}
              onChange={setScale}
              min={70}
              max={160}
              step={5}
              color="orange"
              marks={[
                { value: 70, label: '70%' },
                { value: 100, label: '100% (افتراضي)' },
                { value: 130, label: '130%' },
                { value: 160, label: '160%' },
              ]}
              className="mt-1 mb-5"
            />
          </div>
        </div>

        {/* 4. Design Presets vs Custom Upload Tabs */}
        <Tabs value={activeTab} onChange={(val) => setActiveTab(val || 'PRESETS')} color="orange">
          <Tabs.List className="mb-3">
            <Tabs.Tab value="PRESETS" leftSection={<IconSparkles size={14} />}>
              نماذج وتصاميم جاهزة ({isMaster ? 'بطاقات ماستر وفيزا' : 'خزائن وقاصات نقدية فاخرة'})
            </Tabs.Tab>
            <Tabs.Tab value="UPLOAD" leftSection={<IconUpload size={14} />}>
              رفع صورة مخصصة من الجهاز
            </Tabs.Tab>
          </Tabs.List>

          {/* TAB 1: Presets Gallery */}
          <Tabs.Panel value="PRESETS">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
              {(isMaster ? CARD_PRESETS : SAFE_PRESETS).map((preset) => {
                const isCurSelected = selectedPresetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset.id)}
                    className={`rounded-xl border p-2 flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] ${
                      isCurSelected
                        ? 'border-orange-500 ring-2 ring-orange-400/30 bg-orange-50/40 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    {/* Mini Card Preview */}
                    <div
                      className="w-full h-18 rounded-xl p-2 flex flex-col justify-between shadow-sm relative overflow-hidden"
                      style={{ background: preset.bg, color: preset.textColor || '#ffffff' }}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="text-[8px] font-black tracking-widest opacity-90">
                          {preset.name.split(' ')[0]}
                        </span>
                        <div className="w-3 h-3 rounded-full opacity-90 bg-amber-400 shadow-2xs" />
                      </div>

                      <div className="flex justify-between items-end">
                        <span className="text-[9px] font-mono font-bold opacity-80">•••• 8890</span>
                        {isMaster ? <IconCreditCard size={16} className="opacity-90" /> : <IconLock size={16} className="opacity-90" />}
                      </div>
                    </div>

                    {/* Title & Check */}
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-900 truncate block">
                        {preset.name}
                      </span>
                      {isCurSelected && (
                        <div className="w-4 h-4 rounded-full bg-orange-600 text-white flex items-center justify-center shrink-0">
                          <IconCheck size={10} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Tabs.Panel>

          {/* TAB 2: Upload Custom Image */}
          <Tabs.Panel value="UPLOAD">
            <div className="space-y-3 p-1">
              <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 hover:bg-slate-50 flex flex-col items-center justify-center text-center transition-colors">
                <FileInput
                  placeholder="انقر هنا لاختيار صورة من جهازك (PNG, JPG, SVG)"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  value={uploadedFile}
                  onChange={handleFileUpload}
                  leftSection={<IconPhoto size={16} className="text-orange-600" />}
                  clearable
                  className="w-full max-w-sm"
                  styles={{ input: { fontSize: '11px', textAlign: 'right' } }}
                />
                <span className="text-[10px] text-slate-400 mt-1.5">
                  سيتم استخدام الصورة كخلفية رسمية كاملة مع طباعة الأرصدة والأرقام فوقها مباشرة
                </span>
              </div>

              {/* Or Direct Image URL */}
              <div>
                <TextInput
                  label="أو أدخل رابط الصورة المباشر (URL):"
                  placeholder="https://example.com/card_image.png"
                  value={customImageUrl.startsWith('data:') ? '' : customImageUrl}
                  onChange={(e) => setCustomImageUrl(e.currentTarget.value)}
                  leftSection={<IconPhoto size={14} />}
                  styles={{ input: { fontSize: '11px', direction: 'ltr' } }}
                />
              </div>
            </div>
          </Tabs.Panel>
        </Tabs>

        {/* 5. Modal Footer Actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <Button
            size="xs"
            variant="subtle"
            color="red"
            onClick={handleResetToDefault}
            leftSection={<IconRefresh size={13} />}
          >
            إعادة تعيين للصورة الافتراضية
          </Button>

          <div className="flex items-center gap-2">
            <Button size="xs" variant="default" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              size="xs"
              color="orange"
              onClick={() => {
                handleSaveAll();
                onClose();
              }}
              leftSection={<IconCheck size={14} />}
            >
              حفظ وتطبيق التغييرات
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
