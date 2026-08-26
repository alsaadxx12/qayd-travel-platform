import React from 'react';
import { CopilotCardShell, formatDate, formatMoney } from './blockUtils.tsx';

export const JournalCard: React.FC<{ payload: any }> = ({ payload }) => (
  <CopilotCardShell>
    <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
      <div>
        <div className="text-[13px] font-bold text-slate-800">{payload.entryNumber}</div>
        <div className="text-[11px] text-slate-500">{formatDate(payload.date)} · {payload.description}</div>
      </div>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${payload.isBalanced ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
        {payload.isBalanced ? 'متوازن' : 'غير متوازن'}
      </span>
    </div>
    <div className="p-3 space-y-1 text-[11px]">
      {(payload.lines || []).map((l: any, i: number) => (
        <div key={i} className="flex justify-between gap-2">
          <span className="text-slate-600 truncate">{l.accountCode} {l.accountName}</span>
          <span className="font-mono text-slate-800">
            {l.debit > 0 ? `مدين ${formatMoney(l.debit)}` : `دائن ${formatMoney(l.credit)}`}
          </span>
        </div>
      ))}
    </div>
    {(payload.issues || []).length > 0 && (
      <div className="px-3 pb-3 text-[11px] text-red-600">
        {payload.issues.map((iss: string, i: number) => (
          <div key={i}>{iss}</div>
        ))}
      </div>
    )}
  </CopilotCardShell>
);
