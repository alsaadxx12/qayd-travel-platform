import React, { useState } from 'react';
import { CopilotCardShell, formatDate, formatMoney } from './blockUtils.tsx';
import { looksNumeric } from '../extractMarkdownTables';

export const DataTableBlock: React.FC<{ payload: any; onPrompt?: (text: string) => void }> = ({ payload }) => {
  const columns: any[] = payload.columns || [];
  const allRows: any[] = payload.rows || [];
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? allRows : allRows.slice(0, 8);

  const renderCell = (col: any, row: any) => {
    const value = row[col.key];
    if (col.type === 'money' || (col.type !== 'date' && col.type !== 'badge' && looksNumeric(value))) {
      const currency = col.currency || (col.currencyKey ? row[col.currencyKey] : undefined);
      if (col.type === 'money' || currency === 'USD' || currency === 'IQD') {
        return (
          <span dir="ltr" className="font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
            {formatMoney(value, currency === 'USD' ? 'USD' : undefined)}
          </span>
        );
      }
      return (
        <span dir="ltr" className="font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
          {String(value)}
        </span>
      );
    }
    if (col.type === 'date') return formatDate(value);
    if (col.type === 'badge') {
      return (
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-orange-50 text-[#C2410C] font-semibold">
          {value || '—'}
        </span>
      );
    }
    return <span className="leading-6 text-slate-700">{value || '—'}</span>;
  };

  return (
    <CopilotCardShell>
      {payload.title && (
        <div className="px-3 py-2 text-[12px] font-bold text-slate-800 border-b border-slate-100 bg-slate-50/80">
          {payload.title}
        </div>
      )}
      <div className="overflow-x-auto max-h-72">
        <table className="w-full text-[12px] text-right border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-[1]">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-2 font-bold text-slate-500 whitespace-nowrap border-b border-slate-200">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-slate-100 even:bg-slate-50/60">
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-2 align-top">
                    {renderCell(c, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {allRows.length > 8 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-center text-[11px] py-1.5 text-[#F45A0A] font-semibold border-t border-slate-100 hover:bg-orange-50"
        >
          {expanded ? 'عرض أقل' : `عرض الكل (${payload.totalCount || allRows.length})`}
        </button>
      )}
    </CopilotCardShell>
  );
};
