import React, { useState } from 'react';
import { Menu, Modal, Button, TextInput } from '@mantine/core';
import { useAuthStore } from '../../../store/useAuthStore';
import { useLanguageStore } from '../../../store/useLanguageStore';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../../api/client';
import { useQuery } from '@tanstack/react-query';
import { tenantsApi } from '../../../api/tenants';
import {
  UserRound,
  SlidersHorizontal,
  Keyboard,
  KeyRound,
  LogOut,
  ChevronDown,
  Sparkles,
  Eye,
  EyeOff,
  Globe,
} from 'lucide-react';

const ARABIC_TO_LATIN_NAME_MAP: Record<string, string> = {
  'علي': 'Ali',
  'جعفر': 'Jaafar',
  'محمود': 'Mahmood',
  'محمد': 'Mohammed',
  'احمد': 'Ahmed',
  'أحمد': 'Ahmed',
  'حسين': 'Hussein',
  'حسن': 'Hassan',
  'عبد': 'Abd',
  'الله': 'Allah',
  'الساعدي': 'Al-Saadi',
  'السعدي': 'Al-Saadi',
  'مدير': 'Admin',
  'عام': 'General',
  'المحاسب': 'Accountant',
  'المشرف': 'Supervisor',
  'المستخدم': 'User',
};

const getLocalizedUserName = (name?: string, email?: string, nameEn?: string, lang?: string): string => {
  if (!name && !email && !nameEn) return lang === 'ar' ? 'المستخدم' : 'User';
  if (lang === 'ar') return name || nameEn || email?.split('@')[0] || 'المستخدم';
  
  if (nameEn) return nameEn;
  
  if (name && /[\u0600-\u06FF]/.test(name)) {
    const words = name.trim().split(/\s+/);
    const transliterated = words.map((w) => ARABIC_TO_LATIN_NAME_MAP[w] || w).join(' ');
    
    if (!/[\u0600-\u06FF]/.test(transliterated)) {
      return transliterated;
    }
    
    if (email) {
      const emailPrefix = email.split('@')[0].replace(/[._\d]+$/, '').replace(/[._]/g, ' ');
      if (emailPrefix) {
        return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
      }
    }
  }
  
  return name || email?.split('@')[0] || 'User';
};

export const UserMenu: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { language, setLanguage, t } = useLanguageStore();
  const navigate = useNavigate();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [changeResult, setChangeResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Current tenant subscription details
  const { data: currentTenant } = useQuery({
    queryKey: ['current-tenant'],
    queryFn: () => tenantsApi.getCurrentTenant(),
    staleTime: 60000,
  });

  const activeSub = currentTenant?.activeSubscription || currentTenant?.subscriptions?.[0];
  const isRootOwner = currentTenant?.isRoot === true;
  const planName = isRootOwner ? (language === 'ar' ? 'مالك المنصة' : 'Platform Owner') : activeSub?.planVersion?.plan?.nameAr || currentTenant?.planName || (language === 'ar' ? 'الباقة الاحترافية' : 'Pro Plan');
  const daysRemaining = currentTenant?.daysRemaining ?? null;

  const activeName = getLocalizedUserName(user?.name, user?.email, (user as any)?.nameEn, language);
  const activeRole = isRootOwner ? (language === 'ar' ? 'مدير عام النظام' : 'General Admin') : (user?.role || (language === 'ar' ? 'مستخدم النظام' : 'User'));
  const activeEmail = user?.email || '';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const canSubmit = oldPassword.length > 0 && newPassword.length >= 8 && passwordsMatch && !changingPassword;

  const handleChangePassword = async () => {
    if (!canSubmit) return;
    setChangingPassword(true);
    setChangeResult(null);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setChangeResult({ type: 'success', text: language === 'ar' ? 'تم تغيير كلمة المرور بنجاح!' : 'Password changed successfully!' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setChangeResult({ type: 'error', text: err.message || (language === 'ar' ? 'حدث خطأ أثناء تغيير كلمة المرور' : 'Error changing password') });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <>
      <Menu position="bottom-start" offset={6} shadow="lg" radius="lg" width={320}>
        <Menu.Target>
          <button
            type="button"
            className="flex items-center gap-2 px-2 py-1 rounded-[10px] hover:bg-slate-100/80 transition-all cursor-pointer select-none group"
          >
            <div className="w-[34px] h-[34px] rounded-full bg-[#FFF3E8] text-[#F45A0A] font-bold text-xs flex items-center justify-center border border-orange-200 shrink-0 shadow-2xs">
              {activeName.charAt(0).toUpperCase()}
            </div>
            <div className={`text-${language === 'ar' ? 'right' : 'left'} hidden sm:block`}>
              <span className="font-semibold text-slate-800 text-[12.5px] block leading-tight truncate max-w-[110px]">
                {activeName}
              </span>
              <span className="text-[10.5px] text-slate-400 font-medium block truncate max-w-[110px]">
                {activeRole}
              </span>
            </div>
            <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-600 transition-transform" />
          </button>
        </Menu.Target>

        <Menu.Dropdown dir={language === 'ar' ? 'rtl' : 'ltr'} className="font-sans p-2 max-h-[520px] overflow-y-auto date-picker-scroll select-none">
          {/* Header with 42px Avatar */}
          <div className="flex items-center gap-3 p-2.5 bg-[#FAFAFA] rounded-[11px] border border-[#E5E7EB] mb-2">
            <div className="w-[42px] h-[42px] rounded-full bg-[#F45A0A] text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
              {activeName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[13.5px] text-slate-900 truncate">{activeName}</div>
              <div className="text-[11.5px] text-slate-500 truncate">{activeRole}</div>
              {activeEmail && <div className="text-[10.5px] text-slate-400 font-mono truncate">{activeEmail}</div>}
            </div>
          </div>

          {/* Compact Subscription Card */}
          <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-[10px] p-2.5 mb-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-[#C2410C] font-bold text-xs">
                <Sparkles size={14} className="text-[#F45A0A]" />
                <span>{planName}</span>
              </div>
              <span className="text-[10.5px] bg-[#F45A0A] text-white px-2 py-0.5 rounded-full font-bold">{t('user.active')}</span>
            </div>
            {daysRemaining !== null && (
              <div className="text-[11px] text-[#9A3412] mb-2 font-medium">
                {language === 'ar' ? `متبقي على التجديد: ` : `Days remaining: `}<strong>{daysRemaining} {language === 'ar' ? 'يوم' : 'days'}</strong>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-orange-200/60">
              <button
                type="button"
                onClick={() => navigate('/subscription-settings')}
                className="h-[28px] px-3 bg-[#F45A0A] hover:bg-[#DD4F05] text-white rounded-md text-[11px] font-bold transition-colors cursor-pointer"
              >
                {t('user.manageSub')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/pricing')}
                className="text-[11px] text-[#C2410C] font-bold hover:underline cursor-pointer"
              >
                {t('user.upgrade')}
              </button>
            </div>
          </div>

          {/* Language Switcher Section */}
          <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-[10px] p-2 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-700 text-xs font-semibold">
              <Globe size={15} className="text-[#F45A0A]" />
              <span>{t('user.language')}</span>
            </div>
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setLanguage('ar', true)}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                  language === 'ar' ? 'bg-[#F45A0A] text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                العربية
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en', true)}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                  language === 'en' ? 'bg-[#F45A0A] text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Menu Items (42px Height) */}
          <div className="space-y-0.5 text-[13px]">
            <Menu.Item
              leftSection={<UserRound size={16} className="text-slate-500" />}
              onClick={() => navigate('/system-settings')}
              className="h-[42px] rounded-lg font-medium text-slate-700 hover:bg-slate-50"
            >
              {t('user.profile')}
            </Menu.Item>

            <Menu.Item
              leftSection={<SlidersHorizontal size={16} className="text-slate-500" />}
              onClick={() => navigate('/system-settings')}
              className="h-[42px] rounded-lg font-medium text-slate-700 hover:bg-slate-50"
            >
              {t('user.displaySettings')}
            </Menu.Item>

            <Menu.Item
              leftSection={<Keyboard size={16} className="text-slate-500" />}
              onClick={() => setShortcutsOpen(true)}
              className="h-[42px] rounded-lg font-medium text-slate-700 hover:bg-slate-50"
            >
              {t('user.shortcuts')}
            </Menu.Item>

            <Menu.Item
              leftSection={<KeyRound size={16} className="text-slate-500" />}
              onClick={() => {
                setPasswordModalOpen(true);
                setChangeResult(null);
              }}
              className="h-[42px] rounded-lg font-medium text-slate-700 hover:bg-slate-50"
            >
              {t('user.changePassword')}
            </Menu.Item>

            <Menu.Divider className="my-1.5" />

            <Menu.Item
              leftSection={<LogOut size={16} className="text-[#DC2626]" />}
              onClick={handleLogout}
              className="h-[42px] rounded-lg font-semibold text-[#DC2626] hover:bg-[#FEF2F2]"
            >
              {t('user.logout')}
            </Menu.Item>
          </div>
        </Menu.Dropdown>
      </Menu>

      {/* Keyboard Shortcuts Modal */}
      <Modal
        opened={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        title={<span className="font-bold text-slate-800 text-sm">{t('user.shortcuts')}</span>}
        size="sm"
        centered
        radius="lg"
      >
        <div className="space-y-2 text-xs text-right font-sans" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {[
            { key: 'Ctrl + K', desc: language === 'ar' ? 'فتح البحث السريع' : 'Open Quick Search' },
            { key: 'Ctrl + N', desc: language === 'ar' ? 'إنشاء قيد يومية جديد' : 'New Journal Entry' },
            { key: 'Esc', desc: language === 'ar' ? 'إغلاق النوافذ المنبثقة' : 'Close Modals' },
          ].map((s, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-800 font-bold">{s.key}</span>
              <span className="text-slate-600 font-medium">{s.desc}</span>
            </div>
          ))}
        </div>
      </Modal>

      {/* Password Change Modal */}
      <Modal
        opened={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        title={<span className="font-bold text-slate-800 text-sm">{t('user.changePassword')}</span>}
        size="sm"
        centered
        radius="lg"
      >
        <div className="space-y-3 p-1 text-right font-sans" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {changeResult && (
            <div className={`p-2.5 rounded-lg text-xs font-semibold ${changeResult.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {changeResult.text}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">
              {language === 'ar' ? 'كلمة المرور الحالية' : 'Current Password'}
            </label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full h-10 px-3 pr-9 rounded-lg border border-slate-200 text-xs outline-none focus:border-[#F45A0A]"
              />
              <button
                type="button"
                onClick={() => setShowOld((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showOld ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">
              {language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-10 px-3 pr-9 rounded-lg border border-slate-200 text-xs outline-none focus:border-[#F45A0A]"
              />
              <button
                type="button"
                onClick={() => setShowNew((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">
              {language === 'ar' ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-10 px-3 pr-9 rounded-lg border border-slate-200 text-xs outline-none focus:border-[#F45A0A]"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <Button
              fullWidth
              disabled={!canSubmit}
              loading={changingPassword}
              onClick={handleChangePassword}
              color="orange"
              className="bg-[#F45A0A] hover:bg-[#DD4F05] font-bold text-xs"
            >
              {language === 'ar' ? 'حفظ كلمة المرور الجديدة' : 'Save New Password'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default UserMenu;
