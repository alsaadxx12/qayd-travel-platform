import React, { useState } from 'react';
import {
  AlertTriangle,
  Plane,
  FileCheck,
  Coins,
  CheckCircle2,
  ChevronDown,
  ArrowLeft,
} from 'lucide-react';
import { formatCurrency, getCurrencySymbol, getCurrencyLabel } from '../../utils/currencyUtils';
import { useLanguageStore } from '../../store/useLanguageStore';

export interface CompletionRequirement {
  id: string;
  label: string;
  isCompleted: boolean;
  missingMessage: string;
  targetElementId?: string;
}

interface TicketFinancialSummaryProps {
  invoiceNumber: string;
  status: string;
  airline?: string;
  airlineLogo?: string;
  fromAirport?: string;
  toAirport?: string;
  travelDate?: Date | null;
  pnr?: string;
  passengersCount: number;
  totalBuy: number;
  totalSell: number;
  totalTaxesBuy: number;
  totalTaxesSell: number;
  totalCharges: number;
  discountAmount: number;
  currency: string;
  paymentType: string;
  paidAmount?: number;
  supplierAccountName?: string;
  customerName?: string;
  passengersNamedCount?: number;
  completionPercentage?: number;
  isComplete?: boolean;
  completedCount?: number;
  totalCount?: number;
  missingRequirements?: CompletionRequirement[];
  onNavigateToField?: (targetElementId?: string) => void;
}

export const TicketFinancialSummary: React.FC<TicketFinancialSummaryProps> = ({
  invoiceNumber,
  status,
  airline,
  airlineLogo,
  fromAirport = 'MHD',
  toAirport = 'BGW',
  travelDate,
  pnr,
  passengersCount,
  totalBuy,
  totalSell,
  totalTaxesBuy,
  totalTaxesSell,
  totalCharges,
  discountAmount,
  currency,
  paymentType,
  paidAmount,
  supplierAccountName,
  customerName,
  passengersNamedCount = 0,
  completionPercentage = 0,
  isComplete = false,
  completedCount = 0,
  totalCount = 0,
  missingRequirements = [],
  onNavigateToField,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const totalTaxes = totalTaxesBuy + totalTaxesSell + totalCharges;
  const netSell = Math.max(0, totalSell - discountAmount);
  const netBuy = totalBuy;
  const netProfit = netSell - netBuy;
  const profitMargin = netBuy > 0 ? Number(((netProfit / netBuy) * 100).toFixed(1)) : 0;
  const isLoss = netProfit < 0;

  const isCash = paymentType === 'نقدي' || paymentType === 'CASH';
  const actualPaid = isCash ? netSell : (paidAmount || 0);
  const remainingOnCustomer = Math.max(0, netSell - actualPaid);

  const formatAmount = (val: number | null | undefined) => {
    return formatCurrency(val, currency);
  };

  return (
    <div className="w-full xl:w-[360px] max-w-full space-y-3.5 font-sans text-xs shrink-0" dir={direction}>
      {/* ── CARD 1: INVOICE STATUS & INTERACTIVE DATA COMPLETION (حالة الفاتورة ونسبة الاكتمال) ── */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs p-4 space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileCheck size={16} className="text-slate-600" />
            <h4 className="font-bold text-[15px] text-slate-900 leading-tight">
              {isAr ? 'حالة الفاتورة' : 'Invoice Status'}
            </h4>
          </div>
          <span className="font-mono font-medium text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded" dir="ltr">
            {invoiceNumber || 'TK-NEW'}
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium text-[12.5px]">
              {isAr ? 'الحالة:' : 'Status:'}
            </span>
            {status === 'POSTED' ? (
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                {isAr ? 'مرحلة محاسبيًا' : 'Posted'}
              </span>
            ) : status === 'CANCELLED' ? (
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
                {isAr ? 'ملغاة' : 'Cancelled'}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-[#FFF3E8] text-[#F45A0A] border border-orange-200">
                {isAr ? 'مسودة' : 'Draft'}
              </span>
            )}
          </div>

          {/* ── Interactive Completion Card Section ── */}
          <div
            onClick={() => setShowDetails(!showDetails)}
            className="p-2.5 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] hover:bg-white hover:border-[#D1D5DB] transition-all cursor-pointer select-none space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {isComplete ? (
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle size={15} className="text-[#F45A0A] shrink-0" />
                )}
                <span className="font-bold text-[12.5px] text-slate-900">
                  {isComplete
                    ? isAr ? 'البيانات مكتملة' : 'Data Complete'
                    : isAr ? 'نسبة اكتمال البيانات' : 'Data Completion'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className={`font-mono font-bold text-xs ${
                    isComplete ? 'text-emerald-700' : 'text-[#F45A0A]'
                  }`}
                >
                  {completionPercentage}%
                </span>
                <ChevronDown
                  size={14}
                  className={`text-slate-400 transition-transform duration-200 ${
                    showDetails ? 'rotate-180 text-slate-700' : ''
                  }`}
                />
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-[6px] bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isComplete ? 'bg-emerald-500' : 'bg-[#F45A0A]'
                }`}
                style={{ width: `${completionPercentage}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>
                {isComplete
                  ? isAr ? 'جميع المتطلبات الإلزامية جاهزة' : 'All requirements ready'
                  : isAr ? `مكتمل ${completedCount} من ${totalCount} متطلب` : `${completedCount} of ${totalCount} completed`}
              </span>
              <span className="text-[10.5px] text-[#F45A0A] hover:underline">
                {showDetails
                  ? isAr ? 'إخفاء التفاصيل' : 'Hide'
                  : isAr ? 'عرض المتطلبات' : 'View Requirements'}
              </span>
            </div>
          </div>

          {/* ── Expandable Missing Requirements Checklist ── */}
          {showDetails && (
            <div className="p-3 bg-white border border-[#E5E7EB] rounded-xl shadow-xs space-y-2 animate-in fade-in-50 duration-150">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-xs">
                <span className="font-bold text-slate-800">
                  {isComplete
                    ? isAr ? 'قائمة المتطلبات:' : 'Requirements Checklist:'
                    : isAr ? `حقول متبقية (${missingRequirements.length}):` : `Remaining Fields (${missingRequirements.length}):`}
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  {completedCount}/{totalCount}
                </span>
              </div>

              {isComplete ? (
                <div className="py-2 text-center text-xs font-semibold text-emerald-700 space-y-1">
                  <div>{isAr ? '✓ جميع الحقول الإلزامية مكتملة 100%' : '✓ All required fields complete'}</div>
                  <div className="text-[10.5px] text-slate-500 font-normal">
                    {isAr ? 'يمكنك الآن حفظ الفاتورة أو اعتمادها وترحيلها محاسبيًا.' : 'Invoice is ready to save or post.'}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {missingRequirements.map((req) => (
                    <div
                      key={req.id}
                      onClick={() => onNavigateToField?.(req.targetElementId)}
                      className="p-2 rounded-lg bg-orange-50/60 border border-orange-200/70 hover:bg-orange-100/70 hover:border-orange-300 transition-colors cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-[11.5px] text-slate-900 block leading-tight">
                          {req.label}
                        </span>
                        <span className="text-[10.5px] text-slate-600 font-normal block truncate">
                          {req.missingMessage}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10.5px] font-semibold text-[#F45A0A] shrink-0">
                        <span>{isAr ? 'انتقال' : 'Go'}</span>
                        <ArrowLeft size={11} className={direction === 'ltr' ? 'rotate-180' : ''} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CARD 2: FLIGHT SUMMARY (ملخص الرحلة) ── */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs p-4 space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Plane size={16} className="text-slate-600" />
            <h4 className="font-bold text-[15px] text-slate-900 leading-tight">
              {isAr ? 'ملخص الرحلة' : 'Flight Summary'}
            </h4>
          </div>
          <div className="flex items-center gap-1.5 max-w-[170px] truncate">
            {airlineLogo && (
              <img
                src={airlineLogo}
                alt={airline || 'Airline'}
                className="w-4 h-4 object-contain shrink-0 rounded"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            )}
            <span className="text-xs text-slate-700 font-medium truncate">{airline || (isAr ? 'طيران' : 'Airline')}</span>
          </div>
        </div>

        <div className="space-y-2.5 text-xs">
          {/* Short Route Pill */}
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-center">
            <span className="text-sm font-bold text-slate-900 font-mono tracking-wider block" dir="ltr">
              {fromAirport || 'MHD'} → {toAirport || 'BGW'}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-600 font-normal text-[12.5px]">
            <span>{isAr ? 'تاريخ السفر:' : 'Travel Date:'}</span>
            <span className="font-mono text-slate-900 font-medium">
              {travelDate ? travelDate.toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB') : (isAr ? 'لم يحدد بعد' : 'Not set')}
            </span>
          </div>

          {pnr ? (
            <div className="flex items-center justify-between text-slate-600 font-normal text-[12.5px]">
              <span>{isAr ? 'رمز PNR:' : 'PNR Code:'}</span>
              <span className="font-mono font-bold text-slate-900 uppercase" dir="ltr">{pnr}</span>
            </div>
          ) : null}

          <div className="flex items-center justify-between text-slate-600 font-normal text-[12.5px]">
            <span>{isAr ? 'عدد المسافرين:' : 'Passengers:'}</span>
            <span className="font-medium text-slate-900">
              {passengersCount} {isAr ? 'مسافر' : 'Pax'}
            </span>
          </div>
        </div>
      </div>

      {/* ── CARD 3: FINANCIAL SUMMARY (الملخص المالي) ── */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs p-4 space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Coins size={16} className="text-slate-600" />
            <h4 className="font-bold text-[15px] text-slate-900 leading-tight">
              {isAr ? 'الملخص المالي' : 'Financial Summary'}
            </h4>
          </div>
          <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            {currency}
          </span>
        </div>

        {/* Loss Warning */}
        {isLoss && (
          <div className="p-2.5 bg-red-50 rounded-lg border border-red-200 flex items-center gap-2 text-red-900">
            <AlertTriangle size={16} className="text-red-600 shrink-0" />
            <span className="text-xs font-medium leading-tight">
              {isAr ? `سعر البيع أقل من التكلفة بخسارة (${formatAmount(Math.abs(netProfit))})` : `Selling price is below cost by (${formatAmount(Math.abs(netProfit))})`}
            </span>
          </div>
        )}

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-600 font-normal text-[12.5px]">
            <span>{isAr ? 'تكلفة الشراء:' : 'Buy Cost:'}</span>
            <span className="font-mono text-slate-900 font-medium" dir="ltr">{formatAmount(totalBuy)}</span>
          </div>

          <div className="flex items-center justify-between text-slate-600 font-normal text-[12.5px]">
            <span>{isAr ? 'سعر البيع:' : 'Sell Price:'}</span>
            <span className="font-mono text-slate-900 font-medium" dir="ltr">{formatAmount(totalSell)}</span>
          </div>

          {totalTaxes > 0 && (
            <div className="flex items-center justify-between text-slate-500 font-normal text-[12px]">
              <span>{isAr ? 'الضرائب والرسوم:' : 'Taxes & Fees:'}</span>
              <span className="font-mono" dir="ltr">{formatAmount(totalTaxes)}</span>
            </div>
          )}

          {discountAmount > 0 && (
            <div className="flex items-center justify-between text-red-600 font-normal text-[12px]">
              <span>{isAr ? 'الخصم الممنوح:' : 'Discount:'}</span>
              <span className="font-mono font-medium" dir="ltr">-{formatAmount(discountAmount)}</span>
            </div>
          )}
        </div>

        {/* Net Total Box (18-20px bold font) */}
        <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-200 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-700">
            {isAr ? 'صافي الفاتورة:' : 'Invoice Net Total:'}
          </span>
          <span className="font-mono text-[19px] font-bold text-slate-900" dir="ltr">
            {formatAmount(netSell)}
          </span>
        </div>

        {/* Payment Settlement */}
        <div className="space-y-1.5 pt-1 text-xs">
          <div className="flex items-center justify-between text-slate-600 font-normal text-[12.5px]">
            <span>
              {isCash
                ? isAr ? 'المبلغ المستلم كاش:' : 'Cash Received:'
                : isAr ? 'المتبقي على العميل:' : 'Customer Due Balance:'}
            </span>
            <span className="font-mono text-slate-900 font-medium" dir="ltr">
              {formatAmount(isCash ? netSell : remainingOnCustomer)}
            </span>
          </div>

          {!isCash && supplierAccountName && (
            <div className="flex items-center justify-between text-slate-600 font-normal text-[12.5px]">
              <span>{isAr ? 'المستحق للمورد:' : 'Supplier Due Balance:'}</span>
              <span className="font-mono text-slate-900 font-medium" dir="ltr">{formatAmount(netBuy)}</span>
            </div>
          )}
        </div>

        {/* Profit */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-700 block">
              {isAr ? 'صافي الربح:' : 'Net Profit:'}
            </span>
            <span className="text-[11px] text-slate-400 font-mono font-normal">
              {isAr ? 'الهامش:' : 'Margin:'} {profitMargin}%
            </span>
          </div>
          <span
            className={`font-mono font-bold text-sm ${
              netProfit > 0 ? 'text-[#078B61]' : netProfit < 0 ? 'text-red-600' : 'text-slate-700'
            }`}
            dir="ltr"
          >
            {netProfit >= 0 ? `+${formatAmount(netProfit)}` : formatAmount(netProfit)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TicketFinancialSummary;
