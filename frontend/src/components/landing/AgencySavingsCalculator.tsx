import React, { useState } from 'react';
import {
  Calculator,
  Sparkles,
  Clock,
  TrendingUp,
  ShieldCheck,
  Zap,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AgencySavingsCalculatorProps {
  isDark?: boolean;
  isAr?: boolean;
}

export const AgencySavingsCalculator: React.FC<AgencySavingsCalculatorProps> = ({
  isDark = true,
  isAr = true,
}) => {
  const navigate = useNavigate();
  const [monthlyTickets, setMonthlyTickets] = useState(400);
  const [branchCount, setBranchCount] = useState(2);

  // Calculations:
  // Avg time saved per ticket = 10 mins (0.166 hrs)
  const hoursSavedPerMonth = Math.round((monthlyTickets * 0.16) + (branchCount * 15));
  // Financial savings estimated at $15/hr accountant time saved + error prevention
  const monthlySavingsUSD = Math.round(hoursSavedPerMonth * 14 + (monthlyTickets * 1.5));
  const annualSavingsUSD = monthlySavingsUSD * 12;

  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  return (
    <div
      className={`rounded-3xl border p-6 sm:p-10 transition-all shadow-2xl relative overflow-hidden ${
        isDark
          ? 'bg-gradient-to-br from-slate-900 via-slate-950 to-[#1e130c] border-slate-800 text-white'
          : 'bg-gradient-to-br from-white via-orange-50/30 to-amber-50/20 border-slate-200 text-slate-900 shadow-slate-200/80'
      }`}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Inputs & Sliders (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#F45A0A]/10 text-[#F45A0A] border border-[#F45A0A]/25">
              <Calculator size={14} />
              <span>{isAr ? 'حاسبة الوفر والعائد المالي' : 'ROI & Operational Savings Calculator'}</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black">
              {isAr
                ? 'كم ستوفر وكالتك شهرياً عند الانتقال إلى نظام قيد (QAYD)؟'
                : 'How Much Will Your Agency Save with QAYD?'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 font-medium leading-relaxed">
              {isAr
                ? 'حرك المؤشرات لاحتساب ساعات العمل اليدوي الموفرة والتكلفة التقديرية بدقة.'
                : 'Adjust the sliders below to calculate hours and capital saved through automated travel accounting.'}
            </p>
          </div>

          {/* Slider 1: Monthly Tickets */}
          <div className="space-y-2 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300">
                {isAr ? 'عدد تذاكر الطيران والحجوزات شهرياً:' : 'Monthly Flight Tickets Issued:'}
              </span>
              <span className="font-mono text-base font-black text-[#F45A0A] tabular-nums">
                {monthlyTickets} {isAr ? 'تذكرة' : 'tickets'}
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={2500}
              step={25}
              value={monthlyTickets}
              onChange={(e) => setMonthlyTickets(Number(e.target.value))}
              className="w-full accent-[#F45A0A] cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>50</span>
              <span>1,000</span>
              <span>2,500+</span>
            </div>
          </div>

          {/* Slider 2: Number of Branches */}
          <div className="space-y-2 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300">
                {isAr ? 'عدد فروع ومكاتب الوكالة:' : 'Number of Agency Branches:'}
              </span>
              <span className="font-mono text-base font-black text-[#F45A0A] tabular-nums">
                {branchCount} {isAr ? (branchCount === 1 ? 'فرع' : 'فروع') : 'branches'}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={branchCount}
              onChange={(e) => setBranchCount(Number(e.target.value))}
              className="w-full accent-[#F45A0A] cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>1 فرع</span>
              <span>5 فروع</span>
              <span>10 فروع</span>
            </div>
          </div>
        </div>

        {/* Right Output Card (5 Cols) */}
        <div className="lg:col-span-5">
          <div className="p-6 sm:p-7 rounded-3xl bg-slate-900 border-2 border-[#F45A0A]/40 shadow-2xl space-y-5 text-center relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-[#F45A0A] text-white text-[10px] font-black px-4 py-1 rounded-full shadow-md">
                {isAr ? 'الوفر المالي التقديري ★' : 'Estimated Value ★'}
              </span>
            </div>

            <div className="pt-2">
              <span className="text-xs font-bold text-slate-400 block mb-1">
                {isAr ? 'الوفر المالي السنوي لوكالتك' : 'Estimated Annual Savings'}
              </span>
              <div className="text-4xl sm:text-5xl font-black font-mono text-[#F45A0A] tabular-nums" style={{ fontWeight: 800 }}>
                ${annualSavingsUSD.toLocaleString()}
              </div>
              <span className="text-[11px] font-mono text-emerald-400 font-bold block mt-1">
                {isAr ? `(أي ما يعادل $${monthlySavingsUSD.toLocaleString()} شهرياً)` : `(~$${monthlySavingsUSD.toLocaleString()} / month)`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-4 text-start">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold block">
                  {isAr ? 'ساعات العمل الموفرة:' : 'Hours Saved:'}
                </span>
                <span className="text-lg font-black font-mono text-white tabular-nums">
                  {hoursSavedPerMonth} {isAr ? 'ساعة / شهر' : 'hrs/mo'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold block">
                  {isAr ? 'دقة الحسابات والمطابقة:' : 'Audit Accuracy:'}
                </span>
                <span className="text-lg font-black font-mono text-emerald-400 tabular-nums">
                  100% {isAr ? 'آلياً' : 'Automated'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/onboarding')}
              className="w-full py-3.5 px-4 rounded-2xl text-xs font-black text-white bg-[#F45A0A] hover:bg-[#d94806] shadow-lg shadow-[#F45A0A]/30 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{isAr ? 'ابدأ تحصيل هذا الوفر مجاناً (14 يوماً)' : 'Claim Your Free 14-Day Trial'}</span>
              <ArrowIcon size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgencySavingsCalculator;
