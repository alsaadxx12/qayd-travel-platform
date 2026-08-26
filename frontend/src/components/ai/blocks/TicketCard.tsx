import React from 'react';
import { CopilotCardShell, formatDate, formatMoney } from './blockUtils.tsx';

export const TicketCardBlock: React.FC<{ payload: any; onPrompt?: (text: string) => void }> = ({
  payload,
  onPrompt,
}) => {
  const unpaid = String(payload.paymentStatus || '').includes('آجل');
  return (
    <CopilotCardShell>
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-bold text-slate-800">{payload.invoiceNumber || payload.id}</div>
          <div className="text-[11px] text-slate-500 font-mono">PNR {payload.pnr || '—'}</div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${unpaid ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {payload.paymentStatus || payload.status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 p-3 text-[12px]">
        <Row label="المسافر" value={payload.passenger || payload.passengers?.[0]?.name} />
        <Row label="العميل" value={payload.customer} />
        <Row label="المورد" value={payload.supplier} />
        <Row label="الشركة" value={payload.airline} />
        <Row label="السعر" value={formatMoney(payload.sell, payload.currency === 'USD' ? 'USD' : undefined)} />
        <Row label="التكلفة" value={formatMoney(payload.cost, payload.currency === 'USD' ? 'USD' : undefined)} />
        <Row label="الربح" value={formatMoney(payload.profit, payload.currency === 'USD' ? 'USD' : undefined)} />
        <Row label="التاريخ" value={formatDate(payload.issueDate)} />
      </div>
      {onPrompt && (
        <div className="flex gap-1.5 px-3 pb-3 flex-wrap">
          <button
            type="button"
            onClick={() => onPrompt(`تفاصيل التذكرة ${payload.invoiceNumber || payload.id}`)}
            className="text-[10px] px-2 py-1 rounded-full bg-orange-50 text-[#F45A0A] font-semibold"
          >
            فتح
          </button>
        </div>
      )}
    </CopilotCardShell>
  );
};

const Row: React.FC<{ label: string; value: any }> = ({ label, value }) => (
  <div>
    <div className="text-[10px] text-slate-400">{label}</div>
    <div className="font-semibold text-slate-700 truncate">{value || '—'}</div>
  </div>
);
