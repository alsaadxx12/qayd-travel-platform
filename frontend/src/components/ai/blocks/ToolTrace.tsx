import React from 'react';
import { Loader } from '@mantine/core';

export const ToolTrace: React.FC<{
  tools: Array<{ name: string; label: string; status: 'running' | 'ok' | 'error' }>;
}> = ({ tools }) => {
  if (!tools.length) return null;
  return (
    <div className="flex flex-col gap-1 my-1">
      {tools.map((t, i) => (
        <div key={`${t.name}-${i}`} className="flex items-center gap-1.5 text-[11px] text-slate-500">
          {t.status === 'running' ? <Loader size={10} color="orange" /> : <span className={t.status === 'ok' ? 'text-emerald-500' : 'text-red-500'}>●</span>}
          <span>{t.label || t.name}</span>
        </div>
      ))}
    </div>
  );
};

export const SkeletonBlock: React.FC = () => (
  <div className="space-y-2 animate-pulse">
    <div className="h-3 bg-slate-100 rounded w-3/4" />
    <div className="h-3 bg-slate-100 rounded w-1/2" />
    <div className="h-16 bg-slate-50 rounded-xl border border-slate-100" />
  </div>
);
