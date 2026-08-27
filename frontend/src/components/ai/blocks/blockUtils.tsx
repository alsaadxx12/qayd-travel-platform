import React from 'react';

export function formatMoney(value: any, currency?: string) {
  const n = Number(value) || 0;
  const formatted = n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (currency === 'USD' || currency === '$') return `$${formatted}`;
  return `${formatted} د.ع`;
}

export function formatDate(value: any) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB');
}

/** Shared surface for every Copilot block, so cards read as one family. */
export const CopilotCardShell: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div
    className={`rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-14px_rgba(15,23,42,0.22)] ${className}`}
  >
    {children}
  </div>
);

/** Card header. `accent` marks the block the answer actually hangs on. */
export const CopilotCardHeader: React.FC<{ children: React.ReactNode; accent?: boolean }> = ({
  children,
  accent = false,
}) => (
  <div
    className={`flex items-center gap-2 px-3.5 py-2.5 text-[12px] font-bold border-b ${
      accent
        ? 'bg-[#FFF3E8] border-orange-100 text-[#9A3412]'
        : 'bg-slate-50/70 border-slate-100 text-slate-700'
    }`}
  >
    <span className={`w-1 h-3.5 rounded-full shrink-0 ${accent ? 'bg-[#F45A0A]' : 'bg-slate-300'}`} />
    <span className="truncate">{children}</span>
  </div>
);
