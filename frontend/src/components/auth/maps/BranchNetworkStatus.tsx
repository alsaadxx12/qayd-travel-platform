import React from 'react';
import { IraqiBranchCity } from '../../../config/iraqBranches';
import { Building2, Activity, CheckCircle2 } from 'lucide-react';

interface BranchNetworkStatusProps {
  activeBranch: IraqiBranchCity;
}

export const BranchNetworkStatus: React.FC<BranchNetworkStatusProps> = ({ activeBranch }) => {
  return (
    <div className="px-5 py-2.5 bg-slate-900/90 backdrop-blur-md border border-emerald-500/30 rounded-2xl shadow-xl flex items-center gap-3 dir-rtl max-w-sm w-full select-none">
      <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
        <Building2 size={18} />
      </div>

      <div className="space-y-0.5 overflow-hidden flex-1">
        <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400">
          <span>{activeBranch.nameAr}</span>
          <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 px-1 rounded">
            {activeBranch.code}
          </span>
        </div>
        <span className="text-[10px] text-slate-300 font-medium block truncate">
          {activeBranch.syncLabel}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
        <CheckCircle2 size={13} className="text-emerald-400" />
        <span className="text-[10px] font-bold text-emerald-400">مزامنة</span>
      </div>
    </div>
  );
};
