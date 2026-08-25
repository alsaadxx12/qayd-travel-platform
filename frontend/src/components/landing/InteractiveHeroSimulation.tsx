import React, { useState } from 'react';
import {
  Plane,
  TrendingUp,
  RefreshCw,
  Building2,
  CheckCircle2,
} from 'lucide-react';

interface InteractiveHeroSimulationProps {
  isDark?: boolean;
  isAr?: boolean;
}

export const InteractiveHeroSimulation: React.FC<InteractiveHeroSimulationProps> = ({
  isDark = true,
  isAr = true,
}) => {
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'IQD'>('USD');
  const [activeTicket, setActiveTicket] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const tickets = [
    {
      pnr: 'IA-9482',
      passenger: isAr ? 'أحمد علي حسن' : 'Ahmed Ali Hassan',
      route: 'BGW ➔ DXB',
      fromCity: isAr ? 'مطار بغداد الدولي' : 'Baghdad Intl (BGW)',
      toCity: isAr ? 'مطار دبي الدولي' : 'Dubai Intl (DXB)',
      airline: isAr ? 'الخطوط الجوية العراقية' : 'Iraqi Airways',
      fareUSD: 520,
      costUSD: 470,
      profitUSD: 50,
      branch: isAr ? 'فرع بغداد الرئيسي' : 'Baghdad HQ',
    },
    {
      pnr: 'TK-3310',
      passenger: isAr ? 'سارة محمد كريم' : 'Sarah Mohammed',
      route: 'EBL ➔ IST',
      fromCity: isAr ? 'مطار أربيل الدولي' : 'Erbil Intl (EBL)',
      toCity: isAr ? 'مطار إسطنبول' : 'Istanbul Airport (IST)',
      airline: isAr ? 'الخطوط التركية' : 'Turkish Airlines',
      fareUSD: 680,
      costUSD: 615,
      profitUSD: 65,
      branch: isAr ? 'فرع أربيل' : 'Erbil Branch',
    },
    {
      pnr: 'QR-7821',
      passenger: isAr ? 'حيدر جاسم كاظم' : 'Haider Jassim',
      route: 'NJF ➔ DOH',
      fromCity: isAr ? 'مطار النجف الدولي' : 'Najaf Intl (NJF)',
      toCity: isAr ? 'مطار حمد الدولي' : 'Hamad Intl (DOH)',
      airline: isAr ? 'الخطوط القطرية' : 'Qatar Airways',
      fareUSD: 440,
      costUSD: 395,
      profitUSD: 45,
      branch: isAr ? 'فرع النجف' : 'Najaf Branch',
    },
  ];

  const current = tickets[activeTicket];
  const rate = 1530; // 1 USD = 1530 IQD

  const formatMoney = (usd: number) => {
    if (selectedCurrency === 'USD') {
      return `$${usd.toLocaleString()}`;
    }
    return `${(usd * rate).toLocaleString()} د.ع`;
  };

  const handleSimulateNext = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setActiveTicket((prev) => (prev + 1) % tickets.length);
      setIsSyncing(false);
    }, 250);
  };

  return (
    <div
      className={`rounded-3xl border p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 shadow-xl h-full select-none ${
        isDark
          ? 'bg-slate-950/90 border-slate-800 text-slate-100 shadow-black/40'
          : 'bg-white border-orange-200/90 text-slate-900 shadow-orange-500/5'
      }`}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div>
        {/* Top Header: Badge & Currency Switcher */}
        <div className="flex items-center justify-between gap-3 mb-5 border-b pb-4 border-orange-200/60 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#F45A0A] animate-ping" />
            <span className="text-xs font-black tracking-wider uppercase text-[#F45A0A]">
              {isAr ? 'محاكاة القيود اللحظية الآلية' : 'Live Auto-GL Simulation'}
            </span>
          </div>

          {/* Currency Switcher */}
          <div
            className={`flex items-center p-0.5 rounded-xl border text-[11px] font-black ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-orange-50 border-orange-200'
            }`}
          >
            <button
              type="button"
              onClick={() => setSelectedCurrency('USD')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                selectedCurrency === 'USD'
                  ? 'bg-[#F45A0A] text-white shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              USD ($)
            </button>
            <button
              type="button"
              onClick={() => setSelectedCurrency('IQD')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                selectedCurrency === 'IQD'
                  ? 'bg-[#F45A0A] text-white shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              IQD (د.ع)
            </button>
          </div>
        </div>

        {/* Ticket Header & Live Route Display */}
        <div
          className={`p-4 rounded-2xl border mb-4 relative overflow-hidden transition-all ${
            isDark
              ? 'bg-slate-900/90 border-slate-800'
              : 'bg-orange-50/50 border-orange-200/80'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#F45A0A]/15 text-[#F45A0A] flex items-center justify-center border border-[#F45A0A]/30">
                <Plane size={16} />
              </div>
              <div>
                <span
                  className={`text-xs font-black block leading-tight ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {current.airline}
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  PNR: {current.pnr}
                </span>
              </div>
            </div>

            <span className="text-[10.5px] font-black px-2.5 py-1 rounded-full bg-orange-100 text-[#ea580c] border border-orange-200 dark:bg-[#F45A0A]/15 dark:text-[#F45A0A] dark:border-[#F45A0A]/30">
              {isAr ? 'مُرحّل محاسبياً' : 'Posted to GL'}
            </span>
          </div>

          {/* Route Visual */}
          <div
            className={`flex items-center justify-between py-2.5 px-3.5 rounded-xl border text-center ${
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-orange-200'
            }`}
          >
            <div>
              <span
                className={`text-base font-black font-mono tracking-wider block ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {current.route.split('➔')[0].trim()}
              </span>
              <span className="text-[9.5px] text-slate-500 font-medium truncate max-w-[100px] block">
                {current.fromCity}
              </span>
            </div>

            <div className="flex flex-col items-center px-2">
              <span className="text-[9.5px] font-mono text-[#F45A0A] font-black">
                {current.passenger}
              </span>
              <div className="w-20 h-px bg-gradient-to-r from-transparent via-[#F45A0A] to-transparent my-1" />
              <Plane size={12} className="text-[#F45A0A] rotate-90" />
            </div>

            <div>
              <span
                className={`text-base font-black font-mono tracking-wider block ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {current.route.split('➔')[1].trim()}
              </span>
              <span className="text-[9.5px] text-slate-500 font-medium truncate max-w-[100px] block">
                {current.toCity}
              </span>
            </div>
          </div>
        </div>

        {/* Auto-Generated Accounting Entry Breakdown */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-[11px] font-black text-slate-500 dark:text-slate-400 px-1">
            <span>{isAr ? 'القيد المحاسبي الآلي المولد فورياً:' : 'Generated Balanced GL Entry:'}</span>
            <span className="font-mono text-[11px] text-[#F45A0A] font-black">
              {isAr ? 'متزن 100%' : 'Balanced'}
            </span>
          </div>

          <div
            className={`p-3.5 rounded-2xl border space-y-2.5 text-xs font-mono font-bold ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-orange-50/40 border-orange-200/80'
            }`}
          >
            {/* Debit Entry */}
            <div className="flex items-center justify-between">
              <span className={isDark ? 'text-slate-200 font-black' : 'text-slate-800 font-black'}>
                {isAr ? 'من حـ / الصندوق الرئيسي (قبض التذكرة)' : 'Dr. Cashbox (Customer Recv)'}
              </span>
              <span className="font-black tabular-nums text-slate-900 dark:text-white">
                +{formatMoney(current.fareUSD)}
              </span>
            </div>

            {/* Credit Entry */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">
                {isAr ? 'إلى حـ / مجهز الطيران (تكلفة التذكرة)' : 'Cr. Airline Vendor (Cost)'}
              </span>
              <span className="font-bold tabular-nums text-rose-500 dark:text-rose-400">
                -{formatMoney(current.costUSD)}
              </span>
            </div>

            {/* Profit Entry */}
            <div
              className={`flex items-center justify-between pt-2 border-t ${
                isDark ? 'border-slate-800' : 'border-orange-200/60'
              }`}
            >
              <span
                className={`font-sans font-black flex items-center gap-1 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                <TrendingUp size={13} className="text-[#F45A0A]" />
                <span>{isAr ? 'إلى حـ / إيراد عمولة التذاكر (الربح)' : 'Cr. Commission Income (Profit)'}</span>
              </span>
              <span className="font-black tabular-nums text-sm text-[#F45A0A]">
                +{formatMoney(current.profitUSD)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action to switch ticket */}
      <div className="flex items-center justify-between pt-2 border-t border-orange-200/60 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-400">
          <Building2 size={13} className="text-[#F45A0A]" />
          <span>{current.branch}</span>
        </div>

        <button
          type="button"
          onClick={handleSimulateNext}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
            isDark
              ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
              : 'bg-white hover:bg-orange-50 text-[#F45A0A] border-orange-200 shadow-2xs'
          }`}
        >
          <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
          <span>{isAr ? 'تجربة تذكرة أخرى' : 'Next Ticket Simulation'}</span>
        </button>
      </div>
    </div>
  );
};

export default InteractiveHeroSimulation;
