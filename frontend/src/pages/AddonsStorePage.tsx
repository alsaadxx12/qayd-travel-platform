import React, { useState, useEffect } from 'react';
import { Switch, Badge, Modal, TextInput, Textarea, Button, Select, NumberInput } from '@mantine/core';
import {
  IconBrandWhatsapp,
  IconBuildingStore,
  IconDatabase,
  IconMail,
  IconCheck,
  IconInfoCircle,
  IconCoins,
  IconSend,
  IconServer,
  IconRefresh,
  IconPlugConnected,
  IconSparkles,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { showSuccessNotification, showInfoNotification, showErrorNotification } from '../utils/notifications';
import { apiRequest } from '../api/client';
import { branchesApi } from '../api/branches';
import { tenantsApi } from '../api/tenants';
import { useLanguageStore } from '../store/useLanguageStore';
import { useAuthStore } from '../store/useAuthStore';
import { aiAssistantApi, type AiBillingSnapshot } from '../api/aiAssistant';

export const AddonsStorePage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const { user } = useAuthStore();
  const activeCompanyName = user?.companyName || 'QAYD Travel Accounting';

  const [brevoInfo, setBrevoInfo] = useState<any>(null);
  const [loadingBrevo, setLoadingBrevo] = useState(false);
  const [brevoModalOpen, setBrevoModalOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiBilling, setAiBilling] = useState<AiBillingSnapshot | null>(null);
  const [loadingAiBilling, setLoadingAiBilling] = useState(false);
  const [grantInput, setGrantInput] = useState<number | string>('');
  const [savingGrant, setSavingGrant] = useState(false);

  // Sender Config state
  const [senderEmailInput, setSenderEmailInput] = useState('acc2.rooda10@gmail.com');
  const [senderNameInput, setSenderNameInput] = useState(activeCompanyName);
  const [savingSenderConfig, setSavingSenderConfig] = useState(false);

  // Test email state inside modal
  const [testRecipient, setTestRecipient] = useState('alsaady.rrr123r@gmail.com');
  const [testSubject, setTestSubject] = useState(
    isAr ? 'رسالة اختبار من نظام قيد المحاسبي عبر Brevo' : 'Test message from QAYD Travel Accounting via Brevo'
  );
  const [testMessage, setTestMessage] = useState(
    isAr
      ? 'مرحباً، هذه رسالة تجريبية لتأكيد ربط خدمة Brevo بنجاح لإرسال كشوفات الحساب والتقارير المالية.'
      : 'Hello, this is a live test email confirming that the Brevo integration is successfully configured for account statements and financial reports.'
  );
  const [sendingTest, setSendingTest] = useState(false);

  // Addons toggle state stored locally
  const [enabledAddons, setEnabledAddons] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('app_addons_cards_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      ai_copilot: true,
      whatsapp_otp: true,
      branches: true,
      database: true,
      transactional_email: true,
    };
  });

  // Query real branches count
  const { data: branchesList = [] } = useQuery({
    queryKey: ['addons-branches-count'],
    queryFn: branchesApi.getAll,
    staleTime: 60000,
  });

  // Query real database usage
  const { data: dbUsage } = useQuery({
    queryKey: ['addons-db-usage'],
    queryFn: () => tenantsApi.getDatabaseUsage().catch(() => null),
    staleTime: 60000,
  });

  // Fetch real Brevo stats
  const fetchBrevoStats = async () => {
    setLoadingBrevo(true);
    try {
      const data = await apiRequest<any>('/api/email/account-info');
      if (data && data.isConfigured) {
        setBrevoInfo(data);
        if (data.activeSenderEmail) {
          setSenderEmailInput(data.activeSenderEmail);
        }
        if (data.activeSenderName) {
          setSenderNameInput(data.activeSenderName);
        }
      }
    } catch (e: any) {
      console.error('Failed to fetch Brevo account info:', e);
    } finally {
      setLoadingBrevo(false);
    }
  };

  const fetchAiBilling = async (live = false) => {
    setLoadingAiBilling(true);
    try {
      const data = await aiAssistantApi.getBilling(live);
      setAiBilling(data);
      if (data.allocatedUsd || data.grantUsd) setGrantInput(Number((data.allocatedUsd ?? data.grantUsd).toFixed(2)));
    } catch (e) {
      console.error('Failed to fetch AI billing:', e);
    } finally {
      setLoadingAiBilling(false);
    }
  };

  useEffect(() => {
    fetchBrevoStats();
    fetchAiBilling();
  }, []);

  const handleSaveSenderConfig = async () => {
    if (!senderEmailInput || !senderEmailInput.trim()) {
      showErrorNotification(
        isAr ? 'خطأ' : 'Error',
        isAr ? 'يرجى إدخال عنوان البريد الإلكتروني المعتمد.' : 'Please enter an authorized sender email.'
      );
      return;
    }

    try {
      setSavingSenderConfig(true);
      await apiRequest('/api/email/sender-config', {
        method: 'POST',
        body: JSON.stringify({
          senderEmail: senderEmailInput.trim(),
          senderName: senderNameInput.trim() || activeCompanyName || 'QAYD Travel Accounting',
        }),
      });
      showSuccessNotification(
        isAr ? 'تم الحفظ بنجاح' : 'Saved Successfully',
        isAr ? `تم تحديث واعتماد بريد الإرسال (${senderEmailInput}) بنجاح.` : `Authorized sender email (${senderEmailInput}) updated successfully.`
      );
      fetchBrevoStats();
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'خطأ في الحفظ' : 'Save Error',
        err.message || (isAr ? 'تعذر حفظ البريد المعتمد' : 'Failed to save authorized sender')
      );
    } finally {
      setSavingSenderConfig(false);
    }
  };

  const toggleAddon = (id: string, nameEn: string) => {
    setEnabledAddons((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem('app_addons_cards_config', JSON.stringify(next));
      } catch {}
      if (next[id]) {
        showSuccessNotification(
          isAr ? 'تم التفعيل' : 'Enabled',
          isAr ? `تم تفعيل إضافة (${nameEn}) بنجاح.` : `Addon (${nameEn}) enabled successfully.`
        );
      } else {
        showInfoNotification(
          isAr ? 'تم الإيقاف' : 'Disabled',
          isAr ? `تم إيقاف إضافة (${nameEn}).` : `Addon (${nameEn}) disabled.`
        );
      }
      return next;
    });
  };

  const handleSendTestEmail = async () => {
    if (!testRecipient || !testRecipient.trim()) {
      showErrorNotification(
        isAr ? 'تنبيه' : 'Notice',
        isAr ? 'يرجى إدخال عنوان البريد الإلكتروني لتجربة الإرسال.' : 'Please enter a recipient email address for the test.'
      );
      return;
    }

    setSendingTest(true);
    try {
      await apiRequest('/api/email/send', {
        method: 'POST',
        body: JSON.stringify({
          to: testRecipient.trim(),
          subject: testSubject,
          htmlContent: `
            <div dir="${direction}" style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
              <h2 style="color: #ea580c; margin-top: 0;">✔ ${isAr ? 'تم إرسال رسالة الاختبار بنجاح' : 'Test Email Sent Successfully'}</h2>
              <p style="color: #334155; font-size: 14px; line-height: 1.6;">${testMessage}</p>
              <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 15px 0;" />
              <p style="font-size: 12px; color: #64748b;">${isAr ? 'المرسل' : 'Sender'}: ${senderEmailInput} • ${isAr ? 'عبر مزود Brevo API الرسمي' : 'Via Official Brevo API'}</p>
            </div>
          `,
        }),
      });

      showSuccessNotification(
        isAr ? 'تم الإرسال بنجاح' : 'Sent Successfully',
        isAr ? `تم إرسال بريد تجريبي حقيقي إلى: ${testRecipient}` : `Live test email sent to: ${testRecipient}`
      );
      fetchBrevoStats();
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'خطأ في الإرسال' : 'Send Error',
        err.message || (isAr ? 'فشل إرسال البريد التجريبي' : 'Failed to send test email')
      );
    } finally {
      setSendingTest(false);
    }
  };

  const formatUsd = (n?: number, known = true) => {
    if (!known || n == null || Number.isNaN(n)) return '—';
    if (n > 0 && n < 0.01) return `$${n.toFixed(4)}`;
    return `$${n.toFixed(2)}`;
  };

  const handleSaveAiGrant = async () => {
    const value = Number(grantInput);
    if (!Number.isFinite(value) || value < 0) {
      showErrorNotification(
        isAr ? 'خطأ' : 'Error',
        isAr ? 'أدخل مبلغ الرصيد المتوفر بالدولار.' : 'Enter the available credit amount in USD.'
      );
      return;
    }
    try {
      setSavingGrant(true);
      const data = await aiAssistantApi.setCreditGrant(value);
      setAiBilling(data);
      showSuccessNotification(
        isAr ? 'تم الحفظ' : 'Saved',
        isAr ? 'تم تحديث الرصيد المتوفر لوكيل الذكاء.' : 'AI Copilot available credit updated.'
      );
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'خطأ في الحفظ' : 'Save Error',
        err.message || (isAr ? 'تعذر حفظ الرصيد' : 'Failed to save credit')
      );
    } finally {
      setSavingGrant(false);
    }
  };

  const formattedDbSize = dbUsage?.database?.physicalBytes
    ? `${(dbUsage.database.physicalBytes / (1024 * 1024)).toFixed(1)} MB`
    : 'Real-time Sync';

  const addonsList = [
    {
      id: 'ai_copilot',
      nameEn: 'AI Copilot Agent',
      nameAr: 'وكيل الذكاء (المستشار الذكي)',
      description: isAr
        ? 'وكيل قراءة وتحليل لحسابات الشركة: أرصدة، تذاكر، سندات، وقيود — عبر نموذج OpenAI.'
        : 'Read-only accounting copilot for balances, tickets, vouchers, and journals via OpenAI.',
      icon: IconSparkles,
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50 border-indigo-200',
      tagType: 'usage' as const,
      tagLabel: isAr ? 'وكيل الذكاء' : 'AI Agent',
      statLabel1: isAr ? 'الرصيد المخصص' : 'Allocated',
      statVal1: formatUsd(aiBilling?.allocatedUsd ?? aiBilling?.grantUsd ?? 0, Boolean(aiBilling?.remainingKnown)),
      statLabel2: isAr ? 'المستخدم' : 'Used',
      statVal2: formatUsd(aiBilling?.usedMonthUsd ?? aiBilling?.usedUsd ?? 0, true),
      statLabel3: isAr ? 'المتبقي' : 'Remaining',
      statVal3: aiBilling?.remainingKnown ? formatUsd(aiBilling.remainingUsd) : '—',
      isConfigurable: true,
      manageLabel: isAr ? 'إدارة الرصيد' : 'Manage credit',
    },
    {
      id: 'transactional_email',
      nameEn: 'Transactional Email (Brevo)',
      nameAr: 'خدمة البريد وكشف الحساب',
      description: isAr
        ? `إرسال كشوف الحساب والتقارير المالية عبر البريد المعتمد (${brevoInfo?.activeSenderEmail || 'acc2.rooda10@gmail.com'}).`
        : `Automated sending of account statements and invoices via verified email (${brevoInfo?.activeSenderEmail || 'acc2.rooda10@gmail.com'}).`,
      icon: IconMail,
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-50 border-rose-200',
      tagType: 'usage' as const,
      tagLabel: isAr ? 'Brevo نشط' : 'Brevo Active',
      statLabel1: isAr ? 'الحد اليومي' : 'Daily Limit',
      statVal1: `${brevoInfo?.credits ?? 300} ${isAr ? 'يومياً' : '/ day'}`,
      statLabel2: isAr ? 'المصادقة' : 'Verification',
      statVal2: isAr ? 'مصادق ✔' : 'Verified ✔',
      statLabel3: isAr ? 'الرصيد المتاح' : 'Available',
      statVal3: `${brevoInfo?.credits ?? 300}`,
      isConfigurable: true,
      manageLabel: isAr ? 'إدارة Brevo وتجربة الإرسال' : 'Manage Brevo & Test',
    },
    {
      id: 'branches',
      nameEn: 'Multi-Branch Hierarchy',
      nameAr: 'إدارة وتوسعة الفروع والشركات',
      description: isAr
        ? 'ربط وتوسعة فروع المؤسسة بصناديق وكشوفات حسابات ومستخدمين مستقلين.'
        : 'Connect and expand branch offices with independent cashboxes, statements, and users.',
      icon: IconBuildingStore,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-50 border-purple-200',
      tagType: 'subscription' as const,
      tagLabel: isAr ? 'نظام الفروع' : 'Branch System',
      statLabel1: isAr ? 'الفروع النشطة' : 'Active Branches',
      statVal1: `${branchesList.length} ${isAr ? 'فروع' : 'Branches'}`,
      statLabel2: isAr ? 'المزامنة' : 'Sync Status',
      statVal2: isAr ? 'فورية ومباشرة' : 'Live Realtime',
      statLabel3: isAr ? 'صلاحيات الفروع' : 'Permissions',
      statVal3: isAr ? 'مستقلة' : 'Isolated',
      isConfigurable: false,
      manageLabel: '',
    },
    {
      id: 'database',
      nameEn: 'Dedicated Cloud Database',
      nameAr: 'قواعد البيانات السحابية المستقلة',
      description: isAr
        ? 'سيرفر وقاعدة بيانات Supabase PostgreSQL مؤمّنة مع نسخ احتياطي وتشفير عالي.'
        : 'Enterprise Supabase PostgreSQL database engine with automatic backups and encryption.',
      icon: IconDatabase,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50 border-amber-200',
      tagType: 'usage' as const,
      tagLabel: isAr ? 'قاعدة البيانات' : 'Cloud DB',
      statLabel1: isAr ? 'المحرك' : 'Engine',
      statVal1: 'PostgreSQL 15',
      statLabel2: isAr ? 'حجم البيانات' : 'Live Storage',
      statVal2: formattedDbSize,
      statLabel3: isAr ? 'النسخ الاحتياطي' : 'Backups',
      statVal3: isAr ? 'يومي تلقائي' : 'Daily Auto',
      isConfigurable: false,
      manageLabel: '',
    },
    {
      id: 'whatsapp_otp',
      nameEn: 'WhatsApp Cloud Gateway',
      nameAr: 'بوابة إشعارات الواتساب السحابية',
      description: isAr
        ? 'إرسال التذاكر والفواتير وإشعارات القبض والصرف للعملاء والوكلاء عبر WhatsApp.'
        : 'Send flight tickets, hotel vouchers, and payment receipts to customers via WhatsApp.',
      icon: IconBrandWhatsapp,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50 border-emerald-200',
      tagType: 'subscription' as const,
      tagLabel: isAr ? 'واتساب للأعمال' : 'WhatsApp API',
      statLabel1: isAr ? 'حالة البوابة' : 'Gateway Status',
      statVal1: isAr ? 'جاهز للربط' : 'Ready',
      statLabel2: isAr ? 'نوع الإرسال' : 'Messaging',
      statVal2: isAr ? 'تذاكر وفواتير' : 'Tickets & Invoices',
      statLabel3: isAr ? 'التسليم' : 'Delivery',
      statVal3: isAr ? 'فوري' : 'Instant',
      isConfigurable: false,
      manageLabel: '',
    },
  ];

  return (
    <div
      className="p-4 md:p-6 space-y-5 max-w-[1500px] mx-auto select-none"
      dir={direction}
      style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}
    >
      {/* ── Page Top Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#F45A0A] flex items-center justify-center text-white shadow-md shadow-orange-500/20">
            <IconBuildingStore size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-base text-slate-900 tracking-tight">
                {isAr ? 'متجر الإضافات والخدمات السحابية' : 'Add-ons & Cloud Integrations'}
              </h1>
              <Badge size="xs" color="orange" variant="filled" className="font-black px-2">
                {isAr ? 'إضافات النظام ⭐' : 'System Addons ⭐'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              {isAr
                ? 'إدارة إضافات النظام وخدمات البريد والتواصل والبيانات والمزامنة السحابية.'
                : 'Manage system add-ons, email services, multi-branch communications, and cloud database.'}
            </p>
          </div>
        </div>

        {/* Status Summary */}
        <div className="flex items-center gap-3 bg-orange-50/80 border border-orange-200/90 text-slate-900 px-4 py-2 rounded-xl shadow-2xs">
          <IconCoins size={20} className="text-orange-600 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-500 font-bold block">
              {isAr ? 'الإضافات النشطة:' : 'Active Integrations:'}
            </span>
            <span className="font-mono font-black text-xs text-orange-950 tabular-nums">
              {Object.values(enabledAddons).filter(Boolean).length} / {addonsList.length} {isAr ? 'مفعلة' : 'Active'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Addons Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {addonsList.map((addon) => {
          const Icon = addon.icon;
          const isEnabled = enabledAddons[addon.id] ?? true;
          const isEmailAddon = addon.id === 'transactional_email';
          const isAiAddon = addon.id === 'ai_copilot';

          return (
            <div
              key={addon.id}
              className={`bg-white border rounded-xl p-3 flex flex-col justify-between space-y-2.5 transition-all duration-200 ${
                isEnabled
                  ? 'border-slate-200/90 shadow-2xs hover:shadow-md hover:border-orange-300'
                  : 'border-slate-200/60 bg-slate-50/70 opacity-75'
              }`}
            >
              {/* 1. Top Section: Type Tag, Status Badge, Title & Icon Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  {/* Left: Tag Badge */}
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    addon.tagType === 'usage'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200/80'
                      : 'bg-amber-50 text-amber-800 border border-amber-200/80'
                  }`}>
                    {addon.tagLabel}
                  </span>

                  {/* Right: Status Badge + App Icon */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                      isEnabled
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'}`}></span>
                      <span>{isEnabled ? (isAr ? 'متصلة ونشطة' : 'Active') : (isAr ? 'معطلة' : 'Disabled')}</span>
                    </span>

                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${addon.iconBg}`}>
                      <Icon size={18} className={addon.iconColor} />
                    </div>
                  </div>
                </div>

                {/* Title & Subtitle */}
                <div>
                  <h3 className="font-black text-slate-900 text-[13px] leading-tight">
                    {isAr ? addon.nameAr : addon.nameEn}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-bold block font-mono">
                    {isAr ? addon.nameEn : addon.nameAr}
                  </span>
                </div>

                {/* Description Text */}
                <p className="text-slate-600 text-[11px] leading-snug font-medium">
                  {addon.description}
                </p>
              </div>

              {/* 2. Middle Section: Real Technical Metrics */}
              <div className="bg-slate-50/90 border border-slate-200/80 rounded-lg p-2 grid grid-cols-3 text-center divide-x divide-slate-200/80">
                <div className="px-1">
                  <span className="text-[9px] text-slate-500 font-bold block">{addon.statLabel1}</span>
                  <span className="font-mono font-black text-slate-900 text-[11px] block tabular-nums">{addon.statVal1}</span>
                </div>
                <div className="px-1">
                  <span className="text-[9px] text-slate-500 font-bold block">{addon.statLabel2}</span>
                  <span className="font-mono font-black text-slate-900 text-[11px] block tabular-nums">{addon.statVal2}</span>
                </div>
                <div className="px-1">
                  <span className="text-[9px] text-slate-500 font-bold block">{addon.statLabel3}</span>
                  <span className="font-mono font-black text-emerald-700 text-[11px] block tabular-nums">{addon.statVal3}</span>
                </div>
              </div>

              {/* 3. Bottom Section: Active Switch, Manage Button */}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                <div className="flex items-center gap-1.5 bg-slate-100/80 px-2 py-0.5 rounded-lg border border-slate-200/80">
                  <Switch
                    size="xs"
                    color="emerald"
                    checked={isEnabled}
                    onChange={() => toggleAddon(addon.id, addon.nameEn)}
                    className="cursor-pointer"
                  />
                  <span className="text-[10px] font-black text-slate-700">
                    {isEnabled ? (isAr ? 'مُفعّلة' : 'Enabled') : (isAr ? 'معطّلة' : 'Disabled')}
                  </span>
                </div>

                {addon.isConfigurable ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (isEmailAddon) {
                        setBrevoModalOpen(true);
                        fetchBrevoStats();
                      } else if (isAiAddon) {
                        setAiModalOpen(true);
                        fetchAiBilling(true);
                      }
                    }}
                    className="flex items-center gap-1 text-[11px] font-black text-orange-700 hover:text-white bg-orange-50 hover:bg-[#F45A0A] border border-orange-200/90 px-2.5 py-1 rounded-lg transition-all shadow-2xs cursor-pointer active:scale-95"
                  >
                    <IconPlugConnected size={13} />
                    <span>{addon.manageLabel}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                    <IconCheck size={13} className="text-emerald-600" />
                    <span>{isAr ? 'مدمجة بالنظام' : 'Native Core'}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info Note */}
      <div className="bg-white border border-slate-200 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs text-slate-700 font-bold shadow-2xs">
        <div className="flex items-center gap-2.5">
          <IconInfoCircle size={18} className="text-[#F45A0A] shrink-0" />
          <span>
            {isAr
              ? 'تم ربط خدمة البريد الإلكتروني مع مزود Brevo الرسمي لإرسال كشوف الحسابات والتقارير المالية بصورة مؤتمتة.'
              : 'Email delivery is officially powered by Brevo API for automated account statements and financial reports.'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            fetchBrevoStats();
            fetchAiBilling(true);
          }}
          disabled={loadingBrevo || loadingAiBilling}
          className="flex items-center gap-1.5 text-xs font-black text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl cursor-pointer shadow-2xs shrink-0 transition-colors"
        >
          <IconRefresh size={14} className={loadingBrevo || loadingAiBilling ? 'animate-spin text-orange-600' : 'text-slate-500'} />
          <span>{isAr ? 'تحديث البيانات' : 'Refresh Data'}</span>
        </button>
      </div>

      {/* ── Brevo Account & Test Email Modal ── */}
      <Modal
        opened={brevoModalOpen}
        onClose={() => setBrevoModalOpen(false)}
        size="lg"
        centered
        radius="xl"
        title={
          <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
            <IconMail size={19} className="text-rose-600" />
            <span>{isAr ? 'بيانات ربط خدمة البريد Brevo (Sendinblue API v3)' : 'Brevo Email Service Integration (API v3)'}</span>
          </div>
        }
      >
        <div
          className="space-y-4 text-xs"
          dir={direction}
          style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}
        >
          {/* Account Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 font-bold block">{isAr ? 'بريد الإرسال المعتمد' : 'Sender Email'}</span>
              <strong className="text-xs text-slate-900 truncate block mt-0.5 font-mono" title={brevoInfo?.activeSenderEmail || 'acc2.rooda10@gmail.com'}>
                {brevoInfo?.activeSenderEmail || 'acc2.rooda10@gmail.com'}
              </strong>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 font-bold block">{isAr ? 'اسم المرسل' : 'Sender Name'}</span>
              <strong className="text-xs text-slate-900 block mt-0.5 truncate">
                {brevoInfo?.activeSenderName || activeCompanyName || 'QAYD Travel Accounting'}
              </strong>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-center">
              <span className="text-[10px] text-emerald-800 font-bold block">{isAr ? 'الرصيد المتبقي المتاح' : 'Available Credits'}</span>
              <strong className="text-sm text-emerald-900 font-mono block mt-0.5 tabular-nums">
                {brevoInfo?.credits ?? 300} {isAr ? 'إيميل' : 'Emails'}
              </strong>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl text-center">
              <span className="text-[10px] text-blue-800 font-bold block">{isAr ? 'حالة المصادقة' : 'Verification'}</span>
              <span className="inline-flex items-center gap-1 text-xs text-blue-900 font-black mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{isAr ? 'مرسل مصادق ✔' : 'Verified ✔'}</span>
              </span>
            </div>
          </div>

          {/* ── Sender Configuration Section ── */}
          <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-800 flex items-center gap-1.5 text-xs">
                <IconMail size={15} className="text-orange-600" />
                <span>{isAr ? 'تعيين البريد المعتمد واسم المرسل:' : 'Configure Sender Email & Display Name:'}</span>
              </span>
              <Badge size="xs" color="orange" variant="light">
                {isAr ? 'إعدادات الإرسال الرسمية' : 'Official Settings'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-black text-slate-700 mb-1 text-[11px]">
                  {isAr ? 'بريد الإرسال المعتمد (Sender Email) *:' : 'Sender Email *:'}
                </label>
                {brevoInfo?.senders && brevoInfo.senders.length > 0 ? (
                  <Select
                    size="xs"
                    data={[
                      ...brevoInfo.senders.map((s: any) => ({
                        value: s.email,
                        label: `${s.email} (${s.name || (isAr ? 'معتمد' : 'Verified')})`,
                      })),
                      ...(brevoInfo.senders.some((s: any) => s.email === senderEmailInput)
                        ? []
                        : [{ value: senderEmailInput, label: `${senderEmailInput} (${isAr ? 'مخصص' : 'Custom'})` }]),
                    ]}
                    value={senderEmailInput}
                    onChange={(val) => {
                      if (val) {
                        setSenderEmailInput(val);
                        const found = brevoInfo.senders.find((s: any) => s.email === val);
                        if (found?.name) setSenderNameInput(found.name);
                      }
                    }}
                    searchable
                    styles={{ input: { fontFamily: 'monospace', fontSize: '11px', fontWeight: 700 } }}
                  />
                ) : (
                  <TextInput
                    size="xs"
                    placeholder="acc2.rooda10@gmail.com"
                    value={senderEmailInput}
                    onChange={(e) => setSenderEmailInput(e.currentTarget.value)}
                    styles={{ input: { fontFamily: 'monospace', fontSize: '11px', fontWeight: 700 } }}
                  />
                )}
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {isAr
                    ? 'البريد المصادق عليه في Brevo لإرسال كشوفات الحساب والتقارير.'
                    : 'Verified sender email on Brevo for delivering reports.'}
                </p>
              </div>

              <div>
                <label className="block font-black text-slate-700 mb-1 text-[11px]">
                  {isAr ? 'اسم المرسل الظاهر للزبائن (Sender Name):' : 'Sender Display Name:'}
                </label>
                <TextInput
                  size="xs"
                  placeholder={activeCompanyName || 'QAYD Travel Accounting'}
                  value={senderNameInput}
                  onChange={(e) => setSenderNameInput(e.currentTarget.value)}
                  styles={{ input: { fontSize: '11px', fontWeight: 700 } }}
                />
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {isAr
                    ? 'الاسم الذي سيظهر في صندوق بريد العميل عند استلام الرسالة.'
                    : 'The sender name displayed in client inbox.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                size="xs"
                color="emerald"
                loading={savingSenderConfig}
                leftSection={<IconCheck size={13} />}
                onClick={handleSaveSenderConfig}
                className="font-black shadow-2xs bg-emerald-600 hover:bg-emerald-700"
              >
                {isAr ? 'حفظ وتحديث البريد المعتمد' : 'Save & Update Sender'}
              </Button>
            </div>
          </div>

          {/* Brevo Connection Details Box */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-slate-700 font-black border-b border-slate-100 pb-1.5">
              <span className="flex items-center gap-1.5">
                <IconServer size={14} className="text-slate-500" />
                <span>{isAr ? 'إعدادات خادم الترحيل (SMTP / API Relay):' : 'Relay Server Settings (SMTP / API):'}</span>
              </span>
              <Badge size="xs" color="emerald" variant="light">
                {isAr ? 'API Key مفعل' : 'API Key Active'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-slate-600 font-bold">
              <div>
                <span className="text-slate-400 block text-[10px]">{isAr ? 'مزود الخدمة:' : 'Provider:'}</span>
                <span className="font-mono text-slate-800">Brevo (Sendinblue)</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{isAr ? 'خادم SMTP:' : 'SMTP Host:'}</span>
                <span className="font-mono text-slate-800">smtp-relay.brevo.com:587</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{isAr ? 'إرسال كشوف الحساب:' : 'Statement Sending:'}</span>
                <span className="text-emerald-700">{isAr ? 'جاهز ومفعل ✔' : 'Ready & Active ✔'}</span>
              </div>
            </div>
          </div>

          {/* Test Email Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-800 flex items-center gap-1.5">
                <IconSend size={14} className="text-orange-600" />
                <span>{isAr ? 'تجربة إرسال بريد إلكتروني فوري:' : 'Send Live Test Email:'}</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Brevo Official API</span>
            </div>

            <div>
              <label className="block font-black text-slate-700 mb-1 text-[11px]">
                {isAr ? 'البريد الإلكتروني للمستلم التجريبي:' : 'Recipient Email Address:'}
              </label>
              <TextInput
                size="xs"
                placeholder="example@gmail.com"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.currentTarget.value)}
                styles={{ input: { fontFamily: 'monospace', fontSize: '11px', fontWeight: 700 } }}
              />
            </div>

            <div>
              <label className="block font-black text-slate-700 mb-1 text-[11px]">
                {isAr ? 'عنوان الرسالة:' : 'Subject:'}
              </label>
              <TextInput
                size="xs"
                placeholder={isAr ? 'عنوان البريد...' : 'Email subject...'}
                value={testSubject}
                onChange={(e) => setTestSubject(e.currentTarget.value)}
              />
            </div>

            <div>
              <label className="block font-black text-slate-700 mb-1 text-[11px]">
                {isAr ? 'محتوى الرسالة:' : 'Message Body:'}
              </label>
              <Textarea
                size="xs"
                rows={2}
                placeholder={isAr ? 'نص الرسالة...' : 'Email body text...'}
                value={testMessage}
                onChange={(e) => setTestMessage(e.currentTarget.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                size="xs"
                variant="default"
                onClick={() => setBrevoModalOpen(false)}
                className="font-bold"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </Button>

              <Button
                size="xs"
                color="orange"
                loading={sendingTest}
                leftSection={<IconSend size={13} />}
                onClick={handleSendTestEmail}
                className="bg-[#F45A0A] hover:bg-[#DD4F05] font-black"
              >
                {isAr ? 'إرسال بريد تجريبي الآن' : 'Send Test Email Now'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        opened={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        size="md"
        centered
        radius="xl"
        title={
          <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
            <IconSparkles size={19} className="text-indigo-600" />
            <span>{isAr ? 'رصيد وكيل الذكاء (OpenAI)' : 'AI Copilot Credit (OpenAI)'}</span>
          </div>
        }
      >
        <div
          className="space-y-4 text-xs"
          dir={direction}
          style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-xl text-center">
              <span className="text-[10px] text-indigo-800 font-bold block">{isAr ? 'الرصيد المخصص' : 'Allocated'}</span>
              <strong className="text-sm text-indigo-950 font-mono block mt-0.5 tabular-nums">
                {formatUsd(aiBilling?.allocatedUsd ?? aiBilling?.grantUsd, Boolean(aiBilling?.remainingKnown))}
              </strong>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 font-bold block">{isAr ? 'استهلاك اليوم' : 'Used today'}</span>
              <strong className="text-sm text-slate-900 font-mono block mt-0.5 tabular-nums">
                {formatUsd(aiBilling?.usedTodayUsd ?? 0)}
              </strong>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 font-bold block">{isAr ? 'هذا الشهر' : 'This month'}</span>
              <strong className="text-sm text-slate-900 font-mono block mt-0.5 tabular-nums">
                {formatUsd(aiBilling?.usedMonthUsd ?? aiBilling?.usedUsd ?? 0)}
              </strong>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-center">
              <span className="text-[10px] text-emerald-800 font-bold block">{isAr ? 'المتبقي' : 'Remaining'}</span>
              <strong className="text-sm text-emerald-900 font-mono block mt-0.5 tabular-nums">
                {formatUsd(aiBilling?.remainingUsd, Boolean(aiBilling?.remainingKnown))}
              </strong>
            </div>
          </div>

          <div className="bg-orange-50/70 border border-orange-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-700">{isAr ? 'نسبة الاستهلاك' : 'Usage'}</span>
            <strong className="font-mono text-sm text-orange-800 tabular-nums">
              {(aiBilling?.usagePercent ?? 0).toFixed(1)}%
            </strong>
          </div>

          <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3.5 space-y-3">
            <p className="text-slate-700 font-bold leading-relaxed">
              {isAr
                ? 'OpenAI لا تعيد رقم الرصيد المتبقي مباشرة. الرصيد المخصص يُحفظ هنا، والاستهلاك يُجلب من Costs API، والمتبقي = المخصص − المستخدم. قد يتأخر ظهور التكلفة بضع دقائق.'
                : 'OpenAI does not expose remaining prepaid credit. Allocated budget is stored here, usage comes from the Costs API, and remaining = allocated − used. Billing can lag a few minutes.'}
            </p>
            {aiBilling?.costsLagging && (
              <p className="text-[11px] text-amber-800 font-bold">
                {isAr
                  ? 'Costs API لم يحدّث بعد؛ يظهر استهلاك تقديري من طلبات المستشار إلى حين وصول فاتورة OpenAI.'
                  : 'Costs API has not caught up yet; showing estimated Copilot usage until OpenAI billing updates.'}
              </p>
            )}
            <NumberInput
              size="xs"
              min={0}
              decimalScale={2}
              thousandSeparator=","
              prefix="$ "
              value={grantInput}
              onChange={setGrantInput}
              label={isAr ? 'الرصيد المخصص ($)' : 'Allocated budget ($)'}
              styles={{ input: { fontFamily: 'monospace', fontWeight: 700 } }}
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                size="xs"
                variant="default"
                leftSection={<IconRefresh size={13} />}
                loading={loadingAiBilling}
                onClick={() => fetchAiBilling(true)}
                className="font-bold"
              >
                {isAr ? 'تحديث الاستهلاك الآن' : 'Refresh usage now'}
              </Button>
              <Button
                size="xs"
                color="indigo"
                loading={savingGrant}
                leftSection={<IconCheck size={13} />}
                onClick={handleSaveAiGrant}
                className="font-black"
              >
                {isAr ? 'حفظ الرصيد المخصص' : 'Save allocated budget'}
              </Button>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 font-bold">
            {isAr ? 'النموذج:' : 'Model:'} {aiBilling?.model || 'gpt-5.6-sol'}
            {aiBilling?.lastCheckedAt ? ` • ${new Date(aiBilling.lastCheckedAt).toLocaleString()}` : ''}
          </p>
        </div>
      </Modal>
    </div>
  );
};
