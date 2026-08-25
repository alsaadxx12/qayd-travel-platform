import React from 'react';
import {
  FileCheck2,
  DollarSign,
  TrendingUp,
  CreditCard,
  Building2,
  User,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Globe,
  UsersRound,
  CheckCircle2,
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
  invoiceNumber,
  status,
  visaDestination,
  visaDestinations,
  issueDate,
  passengersCount,
  passengersNamedCount,
  totalBuy,
  totalSell,
  discountAmount = 0,
  currency,
  paymentType,
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

  const netSell = Math.max(0, totalSell - discountAmount);
  const netProfit = netSell - totalBuy;
  const profitMargin = totalSell > 0 ? Math.round((netProfit / totalSell) * 100) : 0;
  const isProfitPositive = netProfit > 0;
  const isProfitNegative = netProfit < 0;

  const formatAmount = (val: number | null | undefined) => {
    return formatCurrency(val, currency);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-4 font-sans text-[#0F172A]" dir={direction}>
      
      {/* ── 1. STATUS & COMPLETION SCORE ── */}
      <div className="space-y-3 pb-3.5 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">
            {isAr ? 'حالة المعاملة' : 'Transaction Status'}
          </span>
          <span
            className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono ${
              status === 'POSTED'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : status === 'CANCELLED'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-orange-50 text-[#F45A0A] border border-orange-200'
            }`}
          >
            {status === 'POSTED' ? (isAr ? 'معتمدة ومرحلة' : 'Posted') : status === 'CANCELLED' ? (isAr ? 'ملغاة' : 'Cancelled') : (isAr ? 'مسودة' : 'Draft')}
          </span>
        </div>

        {/* Dynamic Progress Indicator */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#F45A0A]" />
              {isAr ? 'اكتمال بيانات التأشيرة' : 'Visa Completion'}
            </span>
            <span className="font-mono font-bold text-[#F45A0A]">
              {completionPercentage}% ({completedCount}/{totalCount})
            </span>
          </div>

          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isComplete ? 'bg-emerald-500' : 'bg-[#F45A0A]'
              }`}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>

          {/* Missing Requirements List (Clean & Refined) */}
          {!isComplete && missingRequirements.length > 0 && (
            <div className="pt-2 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-amber-800 font-bold">
                <span>{isAr ? 'حقول متبقية للإكمال:' : 'Required to complete:'}</span>
                <span className="text-[10.5px] font-mono text-amber-600 font-semibold">
                  ({missingRequirements.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {missingRequirements.map((req) => (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => onNavigateToField(req.targetElementId)}
                    className="w-full text-start text-[11.5px] px-2.5 py-1.5 rounded-lg bg-amber-50/80 hover:bg-amber-100 text-amber-900 border border-amber-200/70 flex items-center justify-between transition-all cursor-pointer group shadow-2xs"
                  >
                    <span className="font-semibold text-slate-800">{req.label}</span>
                    <span className="text-[10.5px] text-[#F45A0A] font-bold shrink-0 flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform">
                      {isAr ? 'انتقال ←' : 'Go →'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. SUMMARY DETAILS (Multiple Destinations Support) ── */}
      <div className="space-y-2.5 text-xs text-slate-600 pb-3 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <span className="text-slate-500 flex items-center gap-1.5 shrink-0 pt-0.5">
            <Globe size={14} className="text-slate-400" />
            {isAr ? 'نوع التأشيرة / الوجهة:' : 'Visa Destination:'}
          </span>
          <div className="text-end">
            {visaDestinations && visaDestinations.length > 0 ? (
              visaDestinations.length === 1 ? (
                <span className="font-black text-[#0F172A] block text-xs">
                  {visaDestinations[0]}
                </span>
              ) : (
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-1 justify-end">
                    {visaDestinations.map((v, i) => (
                      <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-orange-50 text-[#F45A0A] border border-orange-200 font-bold text-[10.5px]">
                        {v}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold block">
                    ({visaDestinations.length} {isAr ? 'أنواع تأشيرات' : 'visa types'})
                  </span>
                </div>
              )
            ) : (
              <span className="font-bold text-[#0F172A] text-xs">
                {visaDestination || (isAr ? 'لم تحدد' : 'Not specified')}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-500 flex items-center gap-1.5">
            <UsersRound size={14} className="text-slate-400" />
            {isAr ? 'عدد المسافرين:' : 'Travelers:'}
          </span>
          <span className="font-black font-mono text-[#0F172A] text-xs">
            {passengersNamedCount}/{passengersCount} {isAr ? 'مسافر' : 'pax'}
          </span>
        </div>

        {customerName && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <User size={14} className="text-slate-400" />
              {isAr ? 'العميل:' : 'Customer:'}
            </span>
            <span className="font-bold text-[#0F172A] truncate max-w-[170px]">
              {customerName}
            </span>
          </div>
        )}

        {supplierAccountName && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Building2 size={14} className="text-slate-400" />
              {isAr ? 'المزود:' : 'Supplier:'}
            </span>
            <span className="font-bold text-[#0F172A] truncate max-w-[170px]">
              {supplierAccountName}
            </span>
          </div>
        )}
      </div>

      {/* ── 3. FINANCIAL BREAKDOWN (Darker & Bold Typography) ── */}
      <div className="space-y-2.5 text-xs font-sans">
        <h4 className="font-black text-[14px] text-[#0F172A] pb-1">
          {isAr ? 'الملخص المالي للتأشيرة' : 'Financial Breakdown'}
        </h4>

        <div className="flex items-center justify-between text-slate-600">
          <span className="font-medium">{isAr ? 'إجمالي تكلفة الشراء (Buy):' : 'Total Purchase Cost:'}</span>
          <span className="font-mono font-black text-[#0F172A] text-[13.5px] tabular-nums">
            {formatAmount(totalBuy)}
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-600">
          <span className="font-medium">{isAr ? 'إجمالي سعر البيع (Sell):' : 'Total Sell Price:'}</span>
          <span className="font-mono font-black text-[#0F172A] text-[13.5px] tabular-nums">
            {formatAmount(totalSell)}
          </span>
        </div>

        {discountAmount > 0 && (
          <div className="flex items-center justify-between text-red-600">
            <span className="font-medium">{isAr ? 'الخصم الممنوح:' : 'Discount:'}</span>
            <span className="font-mono font-black text-red-700 text-[13.5px] tabular-nums">
              -{formatAmount(discountAmount)}
            </span>
          </div>
        )}

        {/* Net Total & Profit Highlights */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-black text-xs text-[#0F172A]">
              {isAr ? 'صافي الفاتورة:' : 'Net Invoice Total:'}
            </span>
            <span className="font-mono font-black text-[17px] text-[#0F172A] tabular-nums">
              {formatAmount(netSell)}
            </span>
          </div>

          <div
            className={`p-3 rounded-xl border flex items-center justify-between ${
              isProfitPositive
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : isProfitNegative
                ? 'bg-red-50/80 border-red-200 text-red-950'
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className={isProfitPositive ? 'text-emerald-700' : isProfitNegative ? 'text-red-700' : 'text-slate-500'} />
              <div>
                <span className="font-black text-xs block">
                  {isAr ? 'صافي الربح المتوقع' : 'Expected Net Profit'}
                </span>
                <span className="text-[10px] font-bold opacity-75">
                  {isAr ? `هامش الربح: ${profitMargin}%` : `Margin: ${profitMargin}%`}
                </span>
              </div>
            </div>

            <span className="font-mono font-black text-[15px] tabular-nums">
              {formatAmount(netProfit)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisaFinancialSummary;
