import React from 'react';
import { CopilotCardShell } from './blockUtils.tsx';

export const GeneratedImageBlock: React.FC<{ payload: any }> = ({ payload }) => {
  if (!payload?.src) return null;
  return (
    <CopilotCardShell>
      <div className="px-3 py-2 text-[12px] font-bold text-slate-700 border-b border-slate-100">
        تصميم الصورة
      </div>
      <div className="p-2">
        <img src={payload.src} alt={payload.prompt || 'generated'} className="w-full rounded-lg max-h-80 object-contain bg-slate-50" />
        {payload.prompt && (
          <p className="text-[10px] text-slate-500 mt-1.5 px-1 line-clamp-2">{payload.prompt}</p>
        )}
      </div>
    </CopilotCardShell>
  );
};
