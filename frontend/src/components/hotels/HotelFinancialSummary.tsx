import React, { useState } from 'react';
import {
  Building2,
  Users,
  Coins,
  ChevronDown,
  TrendingUp,
  MapPin,
  Calendar,
  Wallet,
  Building,
} from 'lucide-react';
import { useLanguageStore } from '../../store/useLanguageStore';

interface HotelFinancialSummaryProps {
  invoiceNumber: string;
  status: string;
  hotelName: string;
  city?: string;
  checkInDate: Date;
  checkOutDate: Date;
  nights: number;
  roomsCount: number;
  guestsCount: number;
  totalCost: number;
  totalSale: number;
  netProfit: number;
  profitMargin: number;
  currency: string;
  exchangeRate: number;
  paymentType: string;
  customerName: string;
  supplierName: string;
  salesCashboxName?: string;
  purchaseCashboxName?: string;
}

export const HotelFinancialSummary: React.FC<HotelFinancialSummaryProps> = ({
  invoiceNumber,
  status,
  hotelName,
  city,
  checkInDate,
  checkOutDate,
  nights,
  roomsCount,
  guestsCount,
  totalCost,
  totalSale,
  netProfit,
  profitMargin,
  currency,
  exchangeRate,
  paymentType,
  customerName,
  supplierName,
  salesCashboxName,
  purchaseCashboxName,
}) => {
  const [showAccountingDetails, setShowAccountingDetails] = useState(false);
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const formatEngNumber = (val: number) => {
    return Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const isLoss = netProfit < 0;

  return (
    <div
      className="space-y-3 font-sans select-none"
      dir={direction}
      style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
    >
      {/* ── 1. CONTAINER 1: معلومات الحجز والإقامة ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8.5 h-8.5 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center font-bold shadow-2xs">
              <Building2 size={18} />
            </div>
            <div>
              <span className="font-bold text-xs text-slate-900 block leading-tight">
                {hotelName || (isAr ? 'حجز فندقي جديد' : 'New Hotel Booking')}
              </span>
              {city && (
                <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1 mt-0.5">
                  <MapPin size={10} className="text-[#F45A0A]" />
                  <span>{city}</span>
                </span>
              )}
            </div>
          </div>

          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-orange-50 text-[#F45A0A] border border-orange-200"
            style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
            dir="ltr"
          >
            {invoiceNumber || 'HTL-NEW'}
          </span>
        </div>

        {/* Date & Nights Strip */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-1.5 text-slate-700 text-[11px]">
            <Calendar size={12} className="text-[#F45A0A]" />
            <span
              dir="ltr"
              style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
            >
              {checkInDate.toISOString().split('T')[0]} ➔ {checkOutDate.toISOString().split('T')[0]}
            </span>
          </div>

          <span
            className="font-black text-[#F45A0A] bg-white px-2.5 py-0.5 rounded-lg border border-orange-200 text-xs shadow-2xs"
            style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
            dir="ltr"
          >
            {nights} {isAr ? 'Nights' : 'Nights'}
          </span>
        </div>
      </div>

      {/* ── 2. CONTAINER 2: الأرقام المالية والأرباح ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
            <Coins size={15} className="text-[#F45A0A]" />
            <span>{isAr ? 'الأرقام المالية وصافي الربح' : 'Financial Totals'}</span>
          </div>
          <span
            className="font-black text-xs text-[#F45A0A] bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-lg"
            style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
            dir="ltr"
          >
            {currency} {currency === 'USD' ? `(@ ${exchangeRate})` : ''}
          </span>
        </div>

        <div className="space-y-2 text-xs">
          {/* Total Sale */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="font-bold text-slate-700 text-xs">{isAr ? 'إجمالي المبيعات (العميل):' : 'Total Sales:'}</span>
            <span
              className="font-black text-sm text-slate-950"
              style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
              dir="ltr"
            >
              {formatEngNumber(totalSale)} {currency}
            </span>
          </div>

          {/* Total Cost */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="font-bold text-slate-700 text-xs">{isAr ? 'إجمالي التكلفة (المورد):' : 'Total Cost:'}</span>
            <span
              className="font-black text-sm text-slate-950"
              style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
              dir="ltr"
            >
              {formatEngNumber(totalCost)} {currency}
            </span>
          </div>

          {/* Net Profit Banner (Signature Brand Orange) */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between ${
              isLoss
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-[#FFF3E8] border-orange-200 text-slate-950 shadow-2xs'
            }`}
          >
            <div>
              <span className="font-black text-xs block">{isAr ? 'صافي الربح الفندقي:' : 'Net Profit:'}</span>
              <span
                className="text-[11px] font-bold text-orange-600"
                style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                dir="ltr"
              >
                Margin: {profitMargin.toFixed(1)}%
              </span>
            </div>
            <span
              className={`font-black text-base ${
                isLoss ? 'text-rose-700' : 'text-[#F45A0A]'
              }`}
              style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
              dir="ltr"
            >
              {formatEngNumber(netProfit)} {currency}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. CONTAINER 3: أطراف الحسابات والتسوية ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-black text-slate-900 pb-2 border-b border-slate-100">
          <span className="flex items-center gap-1.5">
            <Users size={14} className="text-[#F45A0A]" />
            <span>{isAr ? 'أطراف المعاملة والحسابات' : 'Parties & Settlement'}</span>
          </span>
          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
            {paymentType === 'CASH' ? (isAr ? 'نقدي' : 'Cash') : paymentType === 'CREDIT' ? (isAr ? 'آجل' : 'Credit') : (isAr ? 'إلكتروني' : 'Card/Bank')}
          </span>
        </div>

        <div className="space-y-1.5 text-xs text-slate-700">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500">{isAr ? 'العميل المدين:' : 'Customer:'}</span>
            <span className="font-bold text-slate-900 truncate max-w-[170px]">{customerName || 'عميل عام'}</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500">{isAr ? 'المورد الدائن:' : 'Supplier:'}</span>
            <span className="font-bold text-slate-900 truncate max-w-[170px]">{supplierName || 'شركة الفنادق'}</span>
          </div>

          {salesCashboxName && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-500">{isAr ? 'صندوق المبيعات:' : 'Cashbox:'}</span>
              <span className="font-bold text-slate-800 truncate max-w-[170px]">{salesCashboxName}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. CONTAINER 4: معاينة القيد المحاسبي المزدوج ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3">
        <button
          type="button"
          onClick={() => setShowAccountingDetails(!showAccountingDetails)}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-slate-950 py-0.5 cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <TrendingUp size={14} className="text-[#F45A0A]" />
            <span>{isAr ? 'معاينة القيد المحاسبي المزدوج' : 'Journal Entry Preview'}</span>
          </span>
          <ChevronDown
            size={14}
            className={`transition-transform ${showAccountingDetails ? 'rotate-180' : ''}`}
          />
        </button>

        {showAccountingDetails && (
          <div
            className="mt-2.5 space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs"
            style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
            dir="ltr"
          >
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span>Dr. {paymentType === 'CASH' ? 'Cashbox' : 'Customer Acc'}</span>
              <span className="font-black">{formatEngNumber(totalSale)}</span>
            </div>
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span>Cr. Supplier Acc</span>
              <span className="font-black">{formatEngNumber(totalCost)}</span>
            </div>
            <div className="flex items-center justify-between text-[#F45A0A] border-t border-slate-200 pt-1.5 font-black">
              <span>Cr. Hotel Revenue Profit</span>
              <span className="font-black">{formatEngNumber(netProfit)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
