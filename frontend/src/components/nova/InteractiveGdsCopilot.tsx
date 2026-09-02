import React, { useState } from 'react';
import {
  Terminal,
  Sparkles,
  Plane,
  CheckCircle2,
  FileText,
  QrCode,
  Printer,
  Copy,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Zap,
  Layers,
  ChevronRight,
} from 'lucide-react';

interface PnrPreset {
  id: string;
  airline: string;
  flightNo: string;
  route: string;
  departure: string;
  arrival: string;
  passenger: string;
  ticketNo: string;
  rawPnr: string;
  baseFare: number;
  tax: number;
  totalFare: number;
  netCost: number;
  profit: number;
}

const PRESETS: PnrPreset[] = [
  {
    id: 'TK-803',
    airline: 'الخطوط التركية (Turkish Airlines)',
    flightNo: 'TK 803',
    route: 'BGW (بغداد) ✈️ IST (إسطنبول)',
    departure: '15 OCT • 06:00',
    arrival: '15 OCT • 09:30',
    passenger: 'ALSAADY / AHMED MR',
    ticketNo: '235-9842109412',
    rawPnr: `1.1ALSAADY/AHMED MR\n2 TK 803 Y 15OCT BGWIST HK1 0600 0930\nFARE: USD 380.00\nTAX: USD 55.00\nTOTAL: USD 435.00\nCOMMISSION: 7% (USD 30.45)\nNET COST: USD 380.00`,
    baseFare: 380,
    tax: 55,
    totalFare: 435,
    netCost: 380,
    profit: 55,
  },
  {
    id: 'EK-942',
    airline: 'طيران الإمارات (Emirates)',
    flightNo: 'EK 942',
    route: 'BGW (بغداد) ✈️ DXB (دبي)',
    departure: '22 OCT • 11:30',
    arrival: '22 OCT • 14:45',
    passenger: 'KADHIM / HAIDER MR',
    ticketNo: '176-8120481921',
    rawPnr: `1.1KADHIM/HAIDER MR\n2 EK 942 J 22OCT BGWDXB HK1 1130 1445\nFARE: USD 440.00\nTAX: USD 70.00\nTOTAL: USD 510.00\nCOMMISSION: 8% (USD 35.20)\nNET COST: USD 440.00`,
    baseFare: 440,
    tax: 70,
    totalFare: 510,
    netCost: 440,
    profit: 70,
  },
  {
    id: 'RJ-811',
    airline: 'الملكية الأردنية (Royal Jordanian)',
    flightNo: 'RJ 811',
    route: 'BSR (البصرة) ✈️ AMM (عمّان)',
    departure: '28 OCT • 08:15',
    arrival: '28 OCT • 10:45',
    passenger: 'JABBAR / FATIMA MRS',
    ticketNo: '512-3349102844',
    rawPnr: `1.1JABBAR/FATIMA MRS\n2 RJ 811 Y 28OCT BSRAMM HK1 0815 1045\nFARE: USD 360.00\nTAX: USD 55.00\nTOTAL: USD 415.00\nCOMMISSION: 9% (USD 32.40)\nNET COST: USD 360.00`,
    baseFare: 360,
    tax: 55,
    totalFare: 415,
    netCost: 360,
    profit: 55,
  },
];

export const InteractiveGdsCopilot: React.FC<{ isAr?: boolean }> = ({ isAr = true }) => {
  const [selectedPreset, setSelectedPreset] = useState<PnrPreset>(PRESETS[0]);
  const [pnrInput, setPnrInput] = useState<string>(PRESETS[0].rawPnr);
  const [parsing, setParsing] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [postedSuccess, setPostedSuccess] = useState(false);

  const handleSelectPreset = (preset: PnrPreset) => {
    setSelectedPreset(preset);
    setPnrInput(preset.rawPnr);
    setPostedSuccess(false);
    setActiveStep(0);
  };

  const handleDecompileAndPost = () => {
    if (parsing) return;
    setParsing(true);
    setActiveStep(1);

    setTimeout(() => {
      setActiveStep(2);
    }, 400);

    setTimeout(() => {
      setActiveStep(3);
      setParsing(false);
      setPostedSuccess(true);
    }, 900);
  };

  return (
    <section className="py-20 bg-slate-950 text-white relative overflow-hidden border-y border-slate-800">
      {/* Futuristic Background Glow Lines */}
      <div className="absolute -top-32 right-1/3 w-[600px] h-[300px] bg-[#F45A0A]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/4 w-[500px] h-[300px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-[#F45A0A] text-xs font-mono font-black mb-3">
            <Sparkles size={14} />
            <span>AI GDS COPILOT • INTELLIGENT PARSER</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
            {isAr ? (
              <>
                كونسول الذكاء الاصطناعي لتفكيك شفرات الحجز{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F45A0A] via-[#FF6F22] to-[#DD4F05]">
                  إلى سندات وقيود حية
                </span>
              </>
            ) : (
              <>
                AI GDS Copilot: Turning Raw PNR Text into{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F45A0A] via-[#FF6F22] to-[#DD4F05]">
                  Audited Live Vouchers
                </span>
              </>
            )}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-400 font-medium">
            {isAr
              ? 'انسخ نص الحجز من أنظمة الطيران العالمية (Amadeus / Sabre / Galileo) وشاهد كيف يستخرج النظام المسافر، والأسعار، ويرحل القيد المحاسبي المزدوج في 0.16 ثانية.'
              : 'Paste or pick raw cryptic GDS airline text and witness instant AI token parsing, margin audit, and balanced ledger posting.'}
          </p>
        </div>

        {/* ── THE INTERACTIVE CYBER TERMINAL ── */}
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden backdrop-blur-md">
          
          {/* Terminal Window Header Bar */}
          <div className="bg-slate-950/90 px-6 py-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              </div>
              <span className="font-mono text-xs text-slate-400 font-bold flex items-center gap-2">
                <Terminal size={15} className="text-[#F45A0A]" />
                <span>QAYD_GDS_PARSER_v3.2.sh</span>
              </span>
            </div>

            {/* Presets Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono text-slate-400 hidden sm:inline-block">
                {isAr ? 'حجوزات تجريبية:' : 'Sample PNRs:'}
              </span>
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    selectedPreset.id === p.id
                      ? 'bg-[#F45A0A] text-white shadow-xs'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {p.id}
                </button>
              ))}
            </div>
          </div>

          {/* Terminal Workspace Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 sm:p-8">
            
            {/* Left Side: GDS Raw Input Terminal */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                  <span>INPUT: CRYPTIC GDS PNR TEXT</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE READY
                  </span>
                </div>

                <div className="relative">
                  <textarea
                    value={pnrInput}
                    onChange={(e) => setPnrInput(e.target.value)}
                    rows={8}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-emerald-400 focus:outline-none focus:border-[#F45A0A] transition-colors leading-relaxed selection:bg-[#F45A0A]/40 resize-none"
                    spellCheck={false}
                  />
                  {parsing && (
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={24} className="animate-spin text-[#F45A0A]" />
                      <span className="font-mono text-xs text-[#F45A0A] font-black tracking-wider animate-pulse">
                        PARSING GDS TOKENS & MARGINS...
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Trigger Button */}
              <button
                type="button"
                onClick={handleDecompileAndPost}
                disabled={parsing}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-[#F45A0A] via-[#FF6F22] to-[#DD4F05] text-white font-black text-xs shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-all hover:brightness-110"
              >
                <Zap size={16} />
                <span>{isAr ? '⚡ فك التشفير والترحيل المالي الذكي' : '⚡ Decompile & Auto-Post to Ledger'}</span>
              </button>
            </div>

            {/* Right Side: Visual Decompiled Outputs (Flight Pass + Journal Entry + Receipt) */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Output 1: Decoded Visual Flight Pass */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <Plane size={16} className="text-[#F45A0A]" />
                    <span className="font-bold text-white">{selectedPreset.airline}</span>
                  </div>
                  <span className="font-mono text-slate-400 font-bold" dir="ltr">{selectedPreset.ticketNo}</span>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">PASSENGER</span>
                    <span className="font-bold text-amber-400">{selectedPreset.passenger}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">FLIGHT</span>
                    <span className="font-bold text-white">{selectedPreset.flightNo}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">ROUTE</span>
                    <span className="font-bold text-white">{selectedPreset.route}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">TIME</span>
                    <span className="font-bold text-white">{selectedPreset.departure}</span>
                  </div>
                </div>
              </div>

              {/* Output 2: Balanced Double-Entry Accounting Table */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px]">
                  <span className="text-[#F45A0A] font-bold flex items-center gap-1.5">
                    <Layers size={14} />
                    <span>{isAr ? 'القيد المحاسبي المزدوج المتولد آلياً' : 'Automated Double-Entry Journal'}</span>
                  </span>
                  <span className="text-emerald-400 font-bold">100% BALANCED</span>
                </div>

                <div className="mt-3 divide-y divide-slate-800/80">
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-300">{isAr ? 'مدين: حساب العميل (وكالة الأفق)' : 'Debit: Client Account'}</span>
                    <span className="font-black text-amber-400" dir="ltr">${selectedPreset.totalFare}.00</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-300">{isAr ? 'دائن: حساب خط الطيران' : 'Credit: Airline Carrier'}</span>
                    <span className="font-black text-slate-300" dir="ltr">${selectedPreset.netCost}.00</span>
                  </div>
                  <div className="py-1.5 flex justify-between bg-emerald-950/30 px-2 rounded-lg text-emerald-400">
                    <span className="font-bold">{isAr ? 'دائن: إيراد عمولة الوكالة (الربح الصافي)' : 'Credit: Agency Net Margin'}</span>
                    <span className="font-black text-emerald-400" dir="ltr">+${selectedPreset.profit}.00</span>
                  </div>
                </div>
              </div>

              {/* Output 3: Instant Success Notification Toast */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                postedSuccess
                  ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-300'
                  : 'bg-slate-950/40 border-slate-800 text-slate-500'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                    postedSuccess ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                  }`}>
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <span className="font-bold text-xs block text-white">
                      {postedSuccess
                        ? (isAr ? 'تم ترحيل السند وتحديث شجرة الحسابات بنجاح!' : 'Voucher Posted & Ledger Audited!')
                        : (isAr ? 'بانتظار أمر الترحيل...' : 'Waiting for trigger...')}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      VOUCHER: RV-2026-0914 • AUDIT SPEED: 0.16s
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-black text-emerald-400">
                    STATUS: OK
                  </span>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
