import React, { useState, useEffect, useRef } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { PasswordField } from './PasswordField';
import { LoginStatusMessage } from './LoginStatusMessage';
import { User, ArrowLeft, ArrowRight, Loader2, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';

interface LoginFormProps {
  onSubmit: (identifier: string, password: string, rememberMe: boolean) => Promise<void>;
  loading?: boolean;
  isSuccess?: boolean;
  statusMessage?: { type: 'error' | 'disabled' | 'expired' | 'offline' | 'no_branch' | 'success'; text: string } | null;
  onRetryConnection?: () => void;
  lang?: 'ar' | 'en';
  isDark?: boolean;
  onStepChange?: (step: number) => void;
}

const T = {
  ar: {
    systemDesc: 'نظام المحاسبة وإدارة خدمات السفر',
    title: 'تسجيل الدخول',
    subtitle: 'أدخل بياناتك للوصول إلى مساحة عمل الفرع',
    emailLabel: 'البريد الإلكتروني أو اسم المستخدم',
    emailPlaceholder: 'أدخل البريد أو اسم المستخدم',
    rememberMe: 'تذكر بيانات الدخول',
    loginBtn: 'تسجيل الدخول',
    loadingBtn: 'جاري التحقق...',
    successBtn: 'تمت المصادقة بنجاح',
    security: 'اتصال مشفر وآمن بمعايير مؤسسية',
    trialQuestion: 'هل ترغب بتجربة النظام السحابي لمؤسستك؟',
    trialAction: '✨ ابدأ فترة تجريبية مجانية (14 يوماً)',
    pricingAction: 'عرض الباقات والأسعار',
  },
  en: {
    systemDesc: 'Accounting & Travel Services Management',
    title: 'Sign In',
    subtitle: 'Enter your credentials to access your branch workspace',
    emailLabel: 'Email or Username',
    emailPlaceholder: 'Enter your email or username',
    rememberMe: 'Remember me',
    loginBtn: 'Sign In',
    loadingBtn: 'Verifying...',
    successBtn: 'Authenticated',
    security: 'Enterprise-grade encrypted connection',
    trialQuestion: 'Want to experience our cloud platform for your business?',
    trialAction: '✨ Start Free 14-Day Trial',
    pricingAction: 'View Pricing & Plans',
  },
};

export const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit, loading = false, isSuccess = false, statusMessage = null, onRetryConnection, lang = 'ar', isDark = false, onStepChange,
}) => {
  const t = T[lang];
  const isAr = lang === 'ar';
  const [identifier, setIdentifier] = useState(() => localStorage.getItem('remembered_identifier') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('remembered_identifier'));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isSuccess) return;
    if (rememberMe) localStorage.setItem('remembered_identifier', identifier.trim());
    else localStorage.removeItem('remembered_identifier');
    await onSubmit(identifier.trim(), password, rememberMe);
  };

  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const canSubmit = identifier.trim().length > 0 && password.trim().length > 0 && !loading && !isSuccess;

  // Dynamic colors based on isDark
  const colors = {
    heading: isDark ? '#f1f5f9' : '#0F172A',
    subtext: isDark ? '#94a3b8' : '#64748B',
    label: isDark ? '#e2e8f0' : '#0F172A',
    inputBg: isDark ? 'rgba(8,20,38,0.7)' : '#FFFFFF',
    inputBorder: isDark ? 'rgba(244,90,10,0.18)' : '#D8E3E0',
    inputText: isDark ? '#f1f5f9' : '#0F172A',
    inputHover: isDark ? 'rgba(71,85,105,0.5)' : '#cbd5e1',
    placeholder: isDark ? 'rgba(148,163,184,0.4)' : '#94a3b8',
    checkText: isDark ? '#94a3b8' : '#0F172A',
    checkBorder: isDark ? 'rgba(244,90,10,0.25)' : '#D8E3E0',
    checkBg: isDark ? 'rgba(8,20,38,0.5)' : '#FFFFFF',
    divider: isDark ? 'rgba(244,90,10,0.12)' : '#D8E3E0',
    descColor: isDark ? '#94a3b8' : '#64748B',
    securityText: isDark ? 'rgba(148,163,184,0.5)' : '#64748B',
    disabledBtnBg: isDark ? 'rgba(30,41,59,0.6)' : '#D8E3E0',
    disabledBtnText: isDark ? '#475569' : '#94a3b8',
  };

  return (
    <div className="w-full max-w-[460px] mx-auto select-none" dir={isAr ? 'rtl' : 'ltr'}>

      {/* ═══ BRANDING ═══ */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-[56px] h-[56px] rounded-2xl border flex items-center justify-center shrink-0 relative overflow-hidden"
            style={{
              background: isDark ? 'rgba(244,90,10,0.1)' : '#0a1628',
              borderColor: isDark ? 'rgba(244,90,10,0.3)' : 'rgba(244,90,10,0.3)',
              transition: 'background 1.2s ease, border-color 1.2s ease',
            }}>
            <div className="absolute inset-0 bg-[#F45A0A]/[0.08] rounded-2xl" />
            <div className="relative flex items-center justify-center">
              <ShieldCheck size={30} className="text-[#F45A0A]" strokeWidth={1.8} />
            </div>
          </div>
          <div>
            <h2 className="text-[24px] font-black leading-tight tracking-[-0.02em]" dir="ltr"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", letterSpacing: '-0.5px', color: colors.heading, transition: 'color 1.2s ease' }}>
              QAYD Travel Accounting
            </h2>
            <p className="text-[13px] font-medium leading-tight mt-0.5"
              style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', sans-serif" : "'Inter', sans-serif", color: colors.descColor, transition: 'color 1.2s ease' }}>
              {t.systemDesc}
            </p>
          </div>
        </div>
        <div className="h-px" style={{ background: `linear-gradient(to left, transparent, ${colors.divider}, transparent)`, transition: 'background 1.2s ease' }} />
      </div>

      {statusMessage && (
        <div className="mb-5">
          <LoginStatusMessage type={statusMessage.type} message={statusMessage.text} onRetry={onRetryConnection} />
        </div>
      )}

      {/* ═══ FORM ═══ */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="login-username" className="text-[14px] font-semibold flex items-center gap-1"
            style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', sans-serif" : "'Inter', sans-serif", color: colors.label, transition: 'color 1.2s ease' }}>
            {t.emailLabel}
            <span className="text-rose-500">*</span>
          </label>
          <div className="relative group">
            <div className={`absolute ${isAr ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#F45A0A] transition-colors pointer-events-none`}>
              <User size={18} />
            </div>
            <input
              id="login-username" ref={inputRef} type="text" required
              disabled={loading || isSuccess} autoComplete="username"
              value={identifier}
              onFocus={() => onStepChange?.(1)}
              onChange={(e) => { setIdentifier(e.target.value); if (e.target.value.length > 0) onStepChange?.(2); }}
              placeholder={t.emailPlaceholder}
              style={{
                fontFamily: isAr ? "'IBM Plex Sans Arabic', sans-serif" : "'Inter', sans-serif",
                background: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText,
                transition: 'background 1.2s ease, border-color 1.2s ease, color 1.2s ease',
              }}
              className={`w-full ${isAr ? 'pl-4 pr-12' : 'pr-4 pl-12'} h-[50px] border rounded-xl text-[14px] font-medium focus:outline-none focus:border-[#F45A0A] focus:ring-[3px] focus:ring-[#F45A0A]/15 placeholder:font-normal`}
            />
          </div>
        </div>

        <PasswordField
          id="login-password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => onStepChange?.(3)}
          disabled={loading || isSuccess} required
          autoComplete="current-password" lang={lang} isDark={isDark}
        />

        <div className="flex items-center justify-between py-1">
          <label className="flex items-center gap-2.5 cursor-pointer select-none group">
            <div className="relative">
              <input type="checkbox" checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading || isSuccess} className="sr-only peer" />
              <div className="w-[18px] h-[18px] rounded-[5px] border peer-checked:bg-[#F45A0A] peer-checked:border-[#F45A0A] transition-all flex items-center justify-center peer-focus:ring-2 peer-focus:ring-[#F45A0A]/20"
                style={{ borderColor: colors.checkBorder, background: rememberMe ? undefined : colors.checkBg, transition: 'border-color 1.2s ease, background 1.2s ease' }}>
                {rememberMe && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </div>
            </div>
            <span className="text-[13px] font-medium"
              style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', sans-serif" : "'Inter', sans-serif", color: colors.checkText, transition: 'color 1.2s ease' }}>
              {t.rememberMe}
            </span>
          </label>
        </div>

        <button type="submit" disabled={!canSubmit}
          className={`w-full h-[50px] rounded-xl font-bold text-[14px] transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer relative overflow-hidden ${
            isSuccess
              ? 'bg-[#F45A0A] text-white shadow-lg shadow-[#F45A0A]/25'
              : canSubmit
                ? 'bg-[#F45A0A] text-white shadow-md shadow-[#F45A0A]/20 hover:bg-[#d94806] hover:shadow-lg hover:shadow-[#F45A0A]/30 active:scale-[0.99]'
                : ''
          }`}
          style={{
            fontFamily: isAr ? "'IBM Plex Sans Arabic', sans-serif" : "'Inter', sans-serif",
            ...(!canSubmit && !isSuccess ? { background: colors.disabledBtnBg, color: colors.disabledBtnText, transition: 'background 1.2s ease, color 1.2s ease' } : {}),
          }}
        >
          {isSuccess ? (
            <><CheckCircle2 size={19} /><span>{t.successBtn}</span></>
          ) : loading ? (
            <><Loader2 size={19} className="animate-spin" /><span>{t.loadingBtn}</span></>
          ) : (
            <><span>{t.loginBtn}</span><ArrowIcon size={18} /></>
          )}
        </button>
      </form>

      {/* ═══ TRIAL ONBOARDING & PRICING LINKS ═══ */}
      <div
        className="mt-5 p-3.5 rounded-2xl text-center space-y-2 border transition-all"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(244,90,10,0.12) 0%, rgba(234,88,12,0.06) 50%, rgba(249,115,22,0.08) 100%)'
            : 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
          borderColor: isDark ? 'rgba(244,90,10,0.3)' : 'rgba(244,90,10,0.3)',
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div
          className="text-xs font-bold"
          style={{ color: isDark ? '#cbd5e1' : '#334155' }}
        >
          {t.trialQuestion}
        </div>
        <div className="flex items-center justify-center gap-3 text-xs font-black flex-wrap">
          <a
            href="/onboarding"
            className="text-[#F45A0A] hover:text-[#d94806] underline underline-offset-4 decoration-[#F45A0A]/60 font-black transition-colors flex items-center gap-1"
          >
            <span>{t.trialAction}</span>
          </a>
          <span className="text-slate-400 opacity-60">•</span>
          <a
            href="/pricing"
            className="text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300 underline underline-offset-4 decoration-amber-500/60 font-bold transition-colors"
          >
            {t.pricingAction}
          </a>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mt-5">
        <Lock size={13} className="text-[#F45A0A]" />
        <span className="text-[12px] font-medium"
          style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', sans-serif" : "'Inter', sans-serif", color: colors.securityText, transition: 'color 1.2s ease' }}>
          {t.security}
        </span>
      </div>
    </div>
  );
};

export default LoginForm;
