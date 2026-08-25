import React, { useState, useEffect } from 'react';
import { Modal, Switch, Badge, Button, Tooltip } from '@mantine/core';
import {
  IconBrandWhatsapp,
  IconMessage2Code,
  IconBuildingStore,
  IconDatabase,
  IconMail,
  IconApps,
  IconCoins,
  IconCheck,
  IconSparkles,
  IconAlertCircle,
  IconRefresh,
  IconInfoCircle,
} from '@tabler/icons-react';
import { showSuccessNotification, showInfoNotification } from '../../utils/notifications';
import { apiRequest } from '../../api/client';

interface AddonsStoreModalProps {
  opened: boolean;
  onClose: () => void;
}

export interface AddonItem {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: any;
  iconColor: string;
  iconBg: string;
  cost: string;
  costUSD: number;
  availableQuota: string;
  quotaPercentage: number;
  isEnabled: boolean;
  badgeText?: string;
  features: string[];
}

export const AddonsStoreModal: React.FC<AddonsStoreModalProps> = ({ opened, onClose }) => {
  // Saved state in localStorage
  const [addons, setAddons] = useState<AddonItem[]>(() => {
    const defaultAddons: AddonItem[] = [
      {
        id: 'whatsapp',
        name: 'إضافة الواتساب التلقائي (WhatsApp Bot)',
        category: 'الربط والتواصل',
        description: 'إرسال التذاكر، فواتير القبض والدفع، وتنبيهات الحجز للزبائن تلقائياً عبر الواتساب الرسمي.',
        icon: IconBrandWhatsapp,
        iconColor: 'text-emerald-600',
        iconBg: 'bg-emerald-50 border-emerald-200',
        cost: '15.00 $ / شهرياً (أو 22,500 د.ع)',
        costUSD: 15,
        availableQuota: '1,850 / 2,500 رسالة متبقية هذا الشهر',
        quotaPercentage: 74,
        isEnabled: true,
        badgeText: 'أكثر طلباً ⭐',
        features: ['إرسال التذاكر فور صدورها', 'إشعارات سندات القبض', 'دعم المرفقات والـ PDF'],
      },
      {
        id: 'otp',
        name: 'خدمة التحقق والرسائل القصيرة (OTP SMS)',
        category: 'الأمان والتحقق',
        description: 'إرسال رموز التحقق OTP عند تسجيل الدخول، تأكيد العمليات الحساسة، وتنبيهات الأمان.',
        icon: IconMessage2Code,
        iconColor: 'text-cyan-600',
        iconBg: 'bg-cyan-50 border-cyan-200',
        cost: '0.02 $ / رسالة OTP (أو 30 د.ع)',
        costUSD: 0.02,
        availableQuota: 'رصيد متوفر: 480 رسالة OTP',
        quotaPercentage: 48,
        isEnabled: true,
        badgeText: 'حماية وأمان',
        features: ['رمز تحقق عالي السرعة (sub-3s)', 'تأكيد عمليات الحذف والصرف', 'حماية الحسابات من الاختراق'],
      },
      {
        id: 'branches',
        name: 'توسعة الفروع والشركات (Multi-Branch)',
        category: 'إدارة الهيكل',
        description: 'ربط وإضافة فروع ومكاتب جديدة، إدارة الصناديق المنفصلة، وشجرة حسابات موحدة.',
        icon: IconBuildingStore,
        iconColor: 'text-purple-600',
        iconBg: 'bg-purple-50 border-purple-200',
        cost: '25.00 $ / لكل فرع إضافي شهرياً',
        costUSD: 25,
        availableQuota: 'متاح 3 فروع نشطة (السعة: 10 فروع)',
        quotaPercentage: 30,
        isEnabled: true,
        badgeText: 'إداري',
        features: ['صلاحيات منفصلة لكل فرع', 'كشوفات مجمعة ومستقلة', 'صناديق وبنوك فرعية'],
      },
      {
        id: 'database',
        name: 'قواعد البيانات المستقلة والسحابية (Dedicated DB)',
        category: 'البنية التحتية',
        description: 'سيرفر وقاعدة بيانات مخصصة فائقة السرعة مع نسخ احتياطي تلقائي كل ساعتين وتشفير شامل.',
        icon: IconDatabase,
        iconColor: 'text-amber-600',
        iconBg: 'bg-amber-50 border-amber-200',
        cost: '40.00 $ / شهرياً',
        costUSD: 40,
        availableQuota: 'المساحة المستهلكة: 1.4 GB / 50 GB',
        quotaPercentage: 15,
        isEnabled: false,
        badgeText: 'سرعة وأداء',
        features: ['نسخ احتياطي تلقائي مكرر', 'استجابة فائقة لملايين الحركات', 'تشفير AES-256 للبيانات'],
      },
      {
        id: 'email',
        name: 'خدمة البريد والرسائل الدورية (Email & Notifications)',
        category: 'التقارير والإشعارات',
        description: 'إرسال كشوفات الحسابات، التقارير الأسبوعية، وفواتير التذاكر مباشرة إلى إيميل الزبون.',
        icon: IconMail,
        iconColor: 'text-rose-600',
        iconBg: 'bg-rose-50 border-rose-200',
        cost: '10.00 $ / شهرياً (مجاناً حتى 1,000 إيميل)',
        costUSD: 10,
        availableQuota: 'متاح 9,680 / 10,000 إيميل شهرياً',
        quotaPercentage: 96,
        isEnabled: true,
        badgeText: 'تلقائي',
        features: ['إرسال كشوف الحساب تلقائياً', 'تصاميم فواتير احترافية', 'تقارير الأرباح الدورية'],
      },
    ];

    try {
      const saved = localStorage.getItem('app_addons_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return defaultAddons.map(def => ({
          ...def,
          isEnabled: parsed[def.id] !== undefined ? parsed[def.id] : def.isEnabled,
        }));
      }
    } catch (e) {}

    return defaultAddons;
  });

  // Fetch real Brevo account info
  useEffect(() => {
    if (!opened) return;
    apiRequest('/api/email/account-info')
      .then((data) => {
        if (data && data.isConfigured) {
          setAddons((prev) =>
            prev.map((a) => {
              if (a.id === 'email') {
                return {
                  ...a,
                  availableQuota: `متاح ${data.credits} إيميل يومياً (${data.activeSenderEmail || data.email || 'Brevo API'})`,
                  quotaPercentage: 100,
                  cost: '$0.00 / شهرياً (Brevo Free Plan)',
                  costUSD: 0,
                  badgeText: 'Brevo نشط ⭐',
                  isEnabled: true,
                };
              }
              return a;
            })
          );
        }
      })
      .catch((err) => {
        console.error('Failed to fetch Brevo account info in modal:', err);
      });
  }, [opened]);

  const toggleAddon = (id: string) => {
    setAddons(prev => {
      const next = prev.map(a => {
        if (a.id === id) {
          const nextState = !a.isEnabled;
          if (nextState) {
            showSuccessNotification('تم التفعيل', `تم تفعيل خدمة (${a.name}) بنجاح.`);
          } else {
            showInfoNotification('تم الإيقاف', `تم إيقاف خدمة (${a.name}).`);
          }
          return { ...a, isEnabled: nextState };
        }
        return a;
      });

      // Save to localStorage
      const configMap: Record<string, boolean> = {};
      next.forEach(a => { configMap[a.id] = a.isEnabled; });
      localStorage.setItem('app_addons_config', JSON.stringify(configMap));

      return next;
    });
  };

  const totalMonthlyCost = addons
    .filter(a => a.isEnabled)
    .reduce((sum, a) => sum + (a.costUSD || 0), 0);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md">
            <IconApps size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-slate-900">متجر الخدمات والإضافات الذكية</span>
              <Badge size="xs" color="emerald" variant="filled" className="font-extrabold">متجر الإضافات ⭐</Badge>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">إدارة وتفعيل الإضافات، احتساب التكلفة، ومتابعة الرصيد المتاح</p>
          </div>
        </div>
      }
      size="xl"
      centered
      radius="lg"
      overlayProps={{ opacity: 0.45, blur: 3 }}
    >
      <div className="space-y-4 text-xs dir-rtl select-none pt-1">
        {/* Total Subscription Summary Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-md border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <IconCoins size={22} />
            </div>
            <div>
              <span className="text-[10.5px] text-slate-300 font-bold block">مجموع التكلفة المفعّلة حالياً:</span>
              <div className="flex items-center gap-2 font-mono font-black text-base text-emerald-400">
                <span>$ {totalMonthlyCost.toFixed(2)}</span>
                <span className="text-xs text-slate-300 font-normal">/ شهرياً</span>
                <span className="text-slate-400 text-xs font-normal">({(totalMonthlyCost * 1500).toLocaleString()} د.ع تقريباً)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge size="md" color="emerald" variant="light" className="font-extrabold px-3 py-1">
              {addons.filter(a => a.isEnabled).length} من {addons.length} إضافات نشطة
            </Badge>
          </div>
        </div>

        {/* Addons List Containers */}
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {addons.map((addon) => {
            const Icon = addon.icon;
            return (
              <div
                key={addon.id}
                className={`p-3.5 rounded-xl border transition-all duration-200 ${
                  addon.isEnabled
                    ? 'bg-white border-slate-200 shadow-sm hover:border-emerald-300'
                    : 'bg-slate-50/70 border-slate-200/80 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Icon & Title Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${addon.iconBg}`}>
                      <Icon size={24} className={addon.iconColor} />
                    </div>

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-xs">{addon.name}</span>
                        {addon.badgeText && (
                          <Badge size="xs" color="gray" variant="light" className="text-[9.5px] font-extrabold">
                            {addon.badgeText}
                          </Badge>
                        )}
                        <Badge size="xs" color={addon.isEnabled ? 'emerald' : 'gray'} variant={addon.isEnabled ? 'filled' : 'outline'} className="text-[9.5px] font-bold">
                          {addon.isEnabled ? 'نشط ومفعل' : 'معطل'}
                        </Badge>
                      </div>

                      <p className="text-slate-600 text-[11px] leading-relaxed">{addon.description}</p>

                      {/* Features tags */}
                      <div className="flex items-center flex-wrap gap-2 pt-1">
                        {addon.features.map((ft, fIdx) => (
                          <span key={fIdx} className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            <IconCheck size={11} className="text-emerald-600" />
                            <span>{ft}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Toggle Switch Button (تشغيل وإطفاء) */}
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-200 px-2.5 py-1 rounded-lg">
                      <span className="text-[10.5px] font-bold text-slate-700">
                        {addon.isEnabled ? 'تشغيل' : 'إطفاء'}
                      </span>
                      <Switch
                        size="md"
                        color="emerald"
                        checked={addon.isEnabled}
                        onChange={() => toggleAddon(addon.id)}
                        className="cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Metrics & Pricing Footer Box inside Card */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  {/* Cost (التكلفة) */}
                  <div className="flex items-center gap-1.5 bg-emerald-50/60 border border-emerald-200/80 px-2.5 py-1 rounded-md">
                    <span className="text-slate-500 font-bold text-[10px]">التكلفة:</span>
                    <span className="font-mono font-black text-emerald-800 text-[11.5px]">{addon.cost}</span>
                  </div>

                  {/* Available Quota (المتاح والكريدت) */}
                  <div className="flex items-center gap-1.5 bg-blue-50/60 border border-blue-200/80 px-2.5 py-1 rounded-md">
                    <span className="text-slate-500 font-bold text-[10px]">المتاح / الرصيد:</span>
                    <span className="font-mono font-black text-blue-900 text-[11.5px]">{addon.availableQuota}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info note */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10.5px] text-slate-500">
          <div className="flex items-center gap-1 text-slate-600 font-medium">
            <IconInfoCircle size={14} className="text-blue-500 shrink-0" />
            <span>يتم احتساب تكلفة الإضافات المفعلة تلقائياً ضمن الفاتورة الشهرية للشركة.</span>
          </div>
          <Button size="xs" variant="light" color="gray" onClick={onClose} className="font-bold">
            إغلاق المتجر
          </Button>
        </div>
      </div>
    </Modal>
  );
};
