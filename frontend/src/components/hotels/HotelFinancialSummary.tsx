import React, { useState } from 'react';
import {
  Building2,
  Users,
  Coins,
  ChevronDown,
  TrendingUp,
  MapPin,
  Calendar,
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
  status: _status,
  hotelName,
  city,
  checkInDate,
  checkOutDate,
  nights,
  roomsCount: _roomsCount,
  guestsCount: _guestsCount,
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
  purchaseCashboxName: _purchaseCashboxName,
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
      className="space-y-2.5 font-sans select-none text-xs"
      dir={direction}
      style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
    >
      {/* ── 1. CONTAINER 1: الحجز والإقامة ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center font-bold shrink-0">
              <Building2 size={15} />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-slate-900 block truncate leading-tight">
                {hotelName || (isAr ? 'حجز جديد' : 'New Booking')}
              </span>
              {city && (
                <span className="text-[10.5px] text-slate-500 font-medium flex items-center gap-1 mt-0.5 truncate">
                  <MapPin size={9} className="text-[#F45A0A] shrink-0" />
                  <span className="truncate">{city}</span>
                </span>
              )}
            </div>
          </div>

          <span
            className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200 shrink-0"
            style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
            dir="ltr"
          >
            {invoiceNumber || 'HTL-NEW'}
          </span>
        </div>

        {/* Date & Nights Strip */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-600 font-mono" dir="ltr">
            <Calendar size={11} className="text-[#F45A0A]" />
            <span>
              {checkInDate.toISOString().split('T')[0]} ➔ {checkOutDate.toISOString().split('T')[0]}
            </span>
          </div>

          <span
            className="font-bold text-[#F45A0A] font-mono"
            style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
            dir="ltr"
          >
            {nights} {isAr ? 'ليالٍ' : 'Nights'}
          </span>
        </div>
      </div>

      {/* ── 2. CONTAINER 2: الأرقام المالية وصافي الربح ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3 space-y-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
          <div className="flex items-center gap-1 text-[11.5px] font-bold text-slate-900">
            <Coins size={13} className="text-[#F45A0A]" />
            <span>{isAr ? 'الملخص المالي' : 'Financials'}</span>
          </div>
          <span
            className="font-bold text-[10.5px] text-[#F45A0A] bg-orange-50 border border-orange-200 px-1.5 py-0.2 rounded"
            style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
            dir="ltr"
          >
            {currency} {currency === 'USD' && exchangeRate ? `@ ${exchangeRate}` : ''}
          </span>
        </div>

        <div className="space-y-1.5 text-xs">
          {/* Total Sale */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70">
            <span className="font-semibold text-slate-600 text-[11px]">{isAr ? 'المبيعات:' : 'Sales:'}</span>
            <span
              className="font-extrabold text-xs text-slate-950 font-mono"
              style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
              dir="ltr"
            >
              {formatEngNumber(totalSale)} {currency}
            </span>
          </div>

          {/* Total Cost */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70">
            <span className="font-semibold text-slate-600 text-[11px]">{isAr ? 'التكلفة:' : 'Cost:'}</span>
            <span
              className="font-extrabold text-xs text-slate-950 font-mono"
              style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
              dir="ltr"
            >
              {formatEngNumber(totalCost)} {currency}
            </span>
          </div>

          {/* Net Profit Banner */}
          <div
            className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between ${
              isLoss
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-[#FFF3E8] border-orange-200 text-slate-950'
            }`}
          >
            <div>
              <span className="font-bold text-[11px] block">{isAr ? 'الربح:' : 'Profit:'}</span>
              <span
                className="text-[10px] font-bold text-orange-700 font-mono"
                style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                dir="ltr"
              >
                {profitMargin.toFixed(1)}%
              </span>
            </div>
            <span
              className={`font-black text-sm font-mono ${
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

      {/* ── 3. CONTAINER 3: أطراف الحسابات ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11.5px] font-bold text-slate-900 pb-1.5 border-b border-slate-100">
          <span className="flex items-center gap-1">
            <Users size={13} className="text-[#F45A0A]" />
            <span>{isAr ? 'أطراف الحسابات' : 'Parties'}</span>
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
            {paymentType === 'CASH' ? (isAr ? 'نقدي' : 'Cash') : paymentType === 'CREDIT' ? (isAr ? 'آجل' : 'Credit') : (isAr ? 'إلكتروني' : 'Card')}
          </span>
        </div>

        <div className="space-y-1 text-[11px] text-slate-700">
          <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-50 border border-slate-100">
            <span className="text-slate-500 font-medium">{isAr ? 'العميل:' : 'Customer:'}</span>
            <span className="font-bold text-slate-900 truncate max-w-[150px]">{customerName || 'عميل عام'}</span>
          </div>

          <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-50 border border-slate-100">
            <span className="text-slate-500 font-medium">{isAr ? 'المورد:' : 'Supplier:'}</span>
            <span className="font-bold text-slate-900 truncate max-w-[150px]">{supplierName || 'شركة الفنادق'}</span>
          </div>

          {salesCashboxName && (
            <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-50 border border-slate-100">
              <span className="text-slate-500 font-medium">{isAr ? 'الصندوق:' : 'Cashbox:'}</span>
              <span className="font-bold text-slate-800 truncate max-w-[150px]">{salesCashboxName}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. CONTAINER 4: معاينة القيد المحاسبي المزدوج (قابل للطي) ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-2.5">
        <button
          type="button"
          onClick={() => setShowAccountingDetails(!showAccountingDetails)}
          className="w-full flex items-center justify-between text-[11px] font-bold text-slate-700 hover:text-slate-950 cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <TrendingUp size={12} className="text-[#F45A0A]" />
            <span>{isAr ? 'معاينة القيد' : 'Journal Preview'}</span>
          </span>
          <ChevronDown
            size={12}
            className={`transition-transform ${showAccountingDetails ? 'rotate-180' : ''}`}
          />
        </button>

        {showAccountingDetails && (
          <div
            className="mt-2 space-y-1 p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-[10.5px]"
            style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
            dir="ltr"
          >
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span>Dr. {paymentType === 'CASH' ? 'Cashbox' : 'Customer'}</span>
              <span className="font-black">{formatEngNumber(totalSale)}</span>
            </div>
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span>Cr. Supplier</span>
              <span className="font-black">{formatEngNumber(totalCost)}</span>
            </div>
            <div className="flex items-center justify-between text-[#F45A0A] border-t border-slate-200 pt-1 font-black">
              <span>Cr. Profit</span>
              <span className="font-black">{formatEngNumber(netProfit)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
