import React, { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  Globe,
  UsersRound,
  User,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency } from '../../utils/currencyUtils';
import { useLanguageStore } from '../../store/useLanguageStore';

interface VisaFinancialSummaryProps {
  invoiceNumber: string;
  status: string;
  visaDestination?: string;
  visaDestinations?: string[];
  issueDate?: Date;
  passengersCount: number;
  passengersNamedCount: number;
  totalBuy: number;
  totalSell: number;
  discountAmount?: number;
  currency: string;
  paymentType: string;
  supplierAccountName?: string;
  customerName?: string;
  completionPercentage: number;
  isComplete: boolean;
  completedCount: number;
  totalCount: number;
  missingRequirements: Array<{
    id: string;
    label: string;
    missingMessage: string;
    targetElementId: string;
  }>;
  onNavigateToField: (targetElementId?: string) => void;
}

export const VisaFinancialSummary: React.FC<VisaFinancialSummaryProps> = ({
  visaDestination,
  visaDestinations,
  passengersCount,
  passengersNamedCount,
  totalBuy,
  totalSell,
  discountAmount = 0,
  currency,
  supplierAccountName,
  customerName,
  completionPercentage,
  isComplete,
  completedCount,
  totalCount,
  missingRequirements,
  onNavigateToField,
}) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [showMissingRequirements, setShowMissingRequirements] = useState(false);

  const netSell = Math.max(0, totalSell - discountAmount);
  const netProfit = netSell - totalBuy;
  const isProfitPositive = netProfit > 0;
  const isProfitNegative = netProfit < 0;

  const formatAmount = (val: number | null | undefined) => {
    return formatCurrency(val, currency);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-3.5 sm:p-4 space-y-3 font-sans text-[#0F172A]" dir={direction}>
      
      {/* ── 1. COMPLETION SCORE (Compact & Hidden Requirements by Default) ── */}
      <div className="space-y-2 pb-2.5 border-b border-slate-100">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 flex items-center gap-1.5 text-[11.5px]">
            <Sparkles size={13} className="text-[#F45A0A]" />
            {isAr ? 'اكتمال البيانات' : 'Completion'}
          </span>
          <span className="font-mono font-bold text-[#F45A0A] text-xs">
            {completionPercentage}% ({completedCount}/{totalCount})
          </span>
        </div>

        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isComplete ? 'bg-emerald-500' : 'bg-[#F45A0A]'
            }`}
            style={{ width: `${completionPercentage}%` }}
          />
        </div>

        {/* Missing Requirements (Hidden by Default per User Rule) */}
        {!isComplete && missingRequirements.length > 0 && (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setShowMissingRequirements((prev) => !prev)}
              className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors py-1 cursor-pointer"
            >
              <span className="flex items-center gap-1">
                <AlertCircle size={12} className="text-amber-500" />
                <span>{isAr ? 'حقول متبقية للإكمال' : 'Required fields'}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-mono font-bold">
                  {missingRequirements.length}
                </span>
              </span>
              <span className="text-[10px] text-[#F45A0A] font-bold">
                {showMissingRequirements ? (isAr ? 'إخفاء ▲' : 'Hide ▲') : (isAr ? 'عرض ▼' : 'Show ▼')}
              </span>
            </button>

            {showMissingRequirements && (
              <div className="pt-1.5 space-y-1">
                {missingRequirements.map((req) => (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => onNavigateToField(req.targetElementId)}
                    className="w-full text-start text-[11px] px-2 py-1 rounded-md bg-amber-50/80 hover:bg-amber-100 text-amber-900 border border-amber-200/70 flex items-center justify-between transition-all cursor-pointer group shadow-2xs"
                  >
                    <span className="font-semibold text-slate-800 truncate max-w-[200px]">{req.label}</span>
                    <span className="text-[10px] text-[#F45A0A] font-bold shrink-0">
                      {isAr ? 'انتقال ←' : 'Go →'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 2. SUMMARY DETAILS (Ultra-Compact Single Lines) ── */}
      <div className="space-y-1.5 text-xs text-slate-600 pb-2.5 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 flex items-center gap-1.5">
            <Globe size={13} className="text-slate-400" />
            {isAr ? 'الوجهة:' : 'Destination:'}
          </span>
          <span className="font-bold text-[#0F172A] text-xs truncate max-w-[160px]">
            {visaDestinations && visaDestinations.length > 0
              ? visaDestinations.join('، ')
              : (visaDestination || '—')}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-500 flex items-center gap-1.5">
            <UsersRound size={13} className="text-slate-400" />
            {isAr ? 'المسافرون:' : 'Travelers:'}
          </span>
          <span className="font-black font-mono text-[#0F172A] text-xs">
            {passengersNamedCount}/{passengersCount}
          </span>
        </div>

        {customerName && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <User size={13} className="text-slate-400" />
              {isAr ? 'العميل:' : 'Customer:'}
            </span>
            <span className="font-bold text-[#0F172A] truncate max-w-[160px]">
              {customerName}
            </span>
          </div>
        )}

        {supplierAccountName && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Building2 size={13} className="text-slate-400" />
              {isAr ? 'المورد:' : 'Supplier:'}
            </span>
            <span className="font-bold text-[#0F172A] truncate max-w-[160px]">
              {supplierAccountName}
            </span>
          </div>
        )}
      </div>

      {/* ── 3. FINANCIAL BREAKDOWN (Compact & Bold) ── */}
      <div className="space-y-2 text-xs font-sans">
        <div className="flex items-center justify-between text-slate-600 text-[11.5px]">
          <span className="font-medium">{isAr ? 'الشراء:' : 'Cost:'}</span>
          <span className="font-mono font-black text-[#0F172A] tabular-nums text-xs">
            {formatAmount(totalBuy)}
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-600 text-[11.5px]">
          <span className="font-medium">{isAr ? 'البيع:' : 'Sell:'}</span>
          <span className="font-mono font-black text-[#0F172A] tabular-nums text-xs">
            {formatAmount(totalSell)}
          </span>
        </div>

        {discountAmount > 0 && (
          <div className="flex items-center justify-between text-red-600 text-[11.5px]">
            <span className="font-medium">{isAr ? 'الخصم:' : 'Discount:'}</span>
            <span className="font-mono font-black text-red-700 tabular-nums text-xs">
              -{formatAmount(discountAmount)}
            </span>
          </div>
        )}

        {/* Net Total & Profit in Clean Horizontal Cards */}
        <div className="pt-2 border-t border-slate-100 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-black text-xs text-[#0F172A]">
              {isAr ? 'الصافي:' : 'Net Total:'}
            </span>
            <span className="font-mono font-black text-[15px] text-[#0F172A] tabular-nums">
              {formatAmount(netSell)}
            </span>
          </div>

          <div
            className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between ${
              isProfitPositive
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : isProfitNegative
                ? 'bg-red-50/70 border-red-200 text-red-950'
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <TrendingUp size={14} className={isProfitPositive ? 'text-emerald-700' : isProfitNegative ? 'text-red-700' : 'text-slate-500'} />
              <span className="font-black text-[11px]">
                {isAr ? 'الربح:' : 'Profit:'}
              </span>
            </div>

            <span className="font-mono font-black text-[13px] tabular-nums">
              {formatAmount(netProfit)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisaFinancialSummary;
