import React from 'react';
import { AlertCircle, WifiOff, Clock, RotateCw, UserX, CheckCircle2, Info } from 'lucide-react';

export type LoginStatusType = 'error' | 'disabled' | 'expired' | 'offline' | 'no_branch' | 'success' | 'info';

interface LoginStatusMessageProps {
  type?: LoginStatusType;
  message: string;
  onRetry?: () => void;
  lang?: 'ar' | 'en';
}

export const LoginStatusMessage: React.FC<LoginStatusMessageProps> = ({
  type = 'error',
  message,
  onRetry,
  lang = 'ar',
}) => {
  if (!message) return null;

  const isUrgent =
    type === 'error' ||
    type === 'disabled' ||
    type === 'expired' ||
    type === 'offline' ||
    type === 'no_branch';

  return (
    <div
      role={isUrgent ? 'alert' : 'status'}
      aria-live={isUrgent ? 'assertive' : 'polite'}
      className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-xs font-bold transition-all ${
        type === 'success'
          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
          : type === 'info'
          ? 'bg-sky-50 border-sky-300 text-sky-950'
          : type === 'offline'
          ? 'bg-amber-50 border-amber-300 text-amber-900'
          : type === 'expired' || type === 'disabled'
          ? 'bg-slate-100 border-slate-300 text-slate-800'
          : 'bg-rose-50 border-rose-300 text-rose-900'
      }`}
    >
      <div className="flex min-w-0 items-start gap-2">
        {type === 'success' ? (
          <CheckCircle2 size={18} className="text-emerald-700 shrink-0 mt-0.5" />
        ) : type === 'offline' ? (
          <WifiOff size={18} className="text-amber-700 shrink-0 mt-0.5" />
        ) : type === 'expired' ? (
          <Clock size={18} className="text-slate-600 shrink-0 mt-0.5" />
        ) : type === 'disabled' ? (
          <UserX size={18} className="text-slate-600 shrink-0 mt-0.5" />
        ) : type === 'info' ? (
          <Info size={18} className="mt-0.5 shrink-0 text-sky-700" />
        ) : (
          <AlertCircle size={18} className="text-rose-700 shrink-0 mt-0.5" />
        )}
        <span className="leading-5">{message}</span>
      </div>

      {type === 'offline' && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex min-h-8 shrink-0 items-center gap-1 rounded-lg border border-amber-400 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-950 shadow-sm transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-500/30"
        >
          <RotateCw size={13} />
          <span>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</span>
        </button>
      )}
    </div>
  );
};
