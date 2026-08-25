import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface PasswordFieldProps {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  lang?: 'ar' | 'en';
  isDark?: boolean;
  invalid?: boolean;
  error?: string;
  onForgotPassword?: () => void;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({
  id = 'password-input',
  value,
  onChange,
  onFocus,
  disabled = false,
  required = true,
  autoComplete = 'current-password',
  placeholder = '••••••••',
  lang = 'ar',
  isDark = false,
  invalid = false,
  error,
  onForgotPassword,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const isAr = lang === 'ar';
  const label = isAr ? 'كلمة المرور' : 'Password';
  const forgotText = isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?';
  const forgotAlert = isAr
    ? 'يرجى التواصل مع مدير النظام لإعادة ضبط كلمة المرور'
    : 'Please contact the system administrator to reset your password';
  const capsText = isAr ? 'تنبيه: Caps Lock مفعّل' : 'Warning: Caps Lock is active';

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) setCapsLockActive(e.getModifierState('CapsLock'));
  };

  const handleForgotPassword = () => {
    if (onForgotPassword) onForgotPassword();
    else window.alert(forgotAlert);
  };

  return (
    <div className="w-full space-y-1.5">
      <style>{`
        #${id}::-ms-reveal,
        #${id}::-ms-clear {
          display: none !important;
        }
      `}</style>
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className={`flex items-center gap-1 text-xs font-bold ${isDark ? 'text-slate-100' : 'text-[#17243D]'}`}
        >
          {label}
          {required && <span className="text-rose-500">*</span>}
        </label>
        <button
          type="button"
          className="min-h-8 rounded-md px-1 text-xs font-bold text-[#C2410C] underline-offset-4 transition-colors hover:text-[#9A3412] hover:underline focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#FF5F0A]/25"
          onClick={handleForgotPassword}
        >
          {forgotText}
        </button>
      </div>

      <div className="relative group">
        <div
          className={`absolute ${
            isAr ? 'right-3.5' : 'left-3.5'
          } pointer-events-none top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#FF5F0A]`}
        >
          <Lock size={17} />
        </div>
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onKeyDown={handleKey}
          onKeyUp={handleKey}
          onBlur={() => setCapsLockActive(false)}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={invalid || Boolean(error) || undefined}
          aria-describedby={
            [error ? `${id}-error` : null, capsLockActive ? `${id}-caps-lock` : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className={`w-full ${
            isAr ? 'pl-11 pr-11' : 'pr-11 pl-11'
          } h-[52px] animate-none rounded-xl border text-base font-semibold tracking-[0.08em] transition-none placeholder:tracking-normal focus:border-[#C2410C] focus:outline-none focus:ring-[3px] focus:ring-[#FF5F0A]/18 disabled:cursor-not-allowed disabled:opacity-65 sm:text-sm ${
            isDark
              ? 'border-slate-700 bg-slate-900/70 text-slate-100 placeholder:text-slate-500 focus:bg-slate-900'
              : 'border-[#94A3B8] bg-[#F8FAFC] text-[#17243D] placeholder:text-[#64748B] hover:border-[#64748B] focus:bg-white'
          } ${invalid || error ? 'border-rose-400' : ''}`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          disabled={disabled}
          aria-label={
            showPassword
              ? isAr
                ? 'إخفاء كلمة المرور'
                : 'Hide password'
              : isAr
                ? 'إظهار كلمة المرور'
                : 'Show password'
          }
          aria-pressed={showPassword}
          className={`absolute ${
            isAr ? 'left-1.5' : 'right-1.5'
          } top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-[#FF5F0A]/25 disabled:cursor-not-allowed`}
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-semibold text-rose-700">
          {error}
        </p>
      )}

      {capsLockActive && (
        <div id={`${id}-caps-lock`} role="status" className="flex items-center gap-1.5 pt-0.5 text-xs font-semibold text-amber-700">
          <AlertTriangle size={13} />
          <span>{capsText}</span>
        </div>
      )}
    </div>
  );
};

export default PasswordField;
