import React from 'react';
import { CopilotCardShell, formatDate, formatMoney } from './blockUtils.tsx';

export const AccountCard: React.FC<{ payload: any; onPrompt?: (text: string) => void }> = ({
  payload,
  onPrompt,
}) => {
  const stateColor =
    payload.state === 'مدين' ? 'text-emerald-700 bg-emerald-50' : payload.state === 'دائن' ? 'text-amber-700 bg-amber-50' : 'text-slate-600 bg-slate-100';

  return (
    <CopilotCardShell>
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <div>
          <div className="text-[13px] font-bold text-slate-800">{payload.name}</div>
          <div className="text-[11px] text-slate-500 font-mono">{payload.code}</div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stateColor}`}>{payload.state || '—'}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 text-[12px]">
        <div>
          <div className="text-slate-400 text-[10px]">الرصيد (د.ع)</div>
          <div className="font-bold text-slate-800">{formatMoney(payload.balanceIQD)}</div>
        </div>
        <div>
          <div className="text-slate-400 text-[10px]">الرصيد ($)</div>
          <div className="font-bold text-slate-800">{formatMoney(payload.balanceUSD, 'USD')}</div>
        </div>
        <div>
          <div className="text-slate-400 text-[10px]">مدين</div>
          <div>{formatMoney(payload.debitIQD)}</div>
        </div>
        <div>
          <div className="text-slate-400 text-[10px]">دائن</div>
          <div>{formatMoney(payload.creditIQD)}</div>
        </div>
      </div>
      {payload.lastMovementDate && (
        <div className="px-3 pb-2 text-[10px] text-slate-500">آخر حركة: {formatDate(payload.lastMovementDate)}</div>
      )}
      {onPrompt && (
        <div className="flex gap-1.5 px-3 pb-3 flex-wrap">
          {['كشف PDF', 'أرسل الكشف بالإيميل', 'كشف الحساب'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() =>
                onPrompt(payload.id ? `${s}\n[[entity:account:${payload.id}:${payload.id}]]` : s)
              }
              className="text-[10px] px-2 py-1 rounded-full bg-orange-50 text-[#F45A0A] font-semibold hover:bg-orange-100"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </CopilotCardShell>
  );
};
