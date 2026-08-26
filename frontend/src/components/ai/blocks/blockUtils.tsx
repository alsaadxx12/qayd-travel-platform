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

export const CopilotCardShell: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);
