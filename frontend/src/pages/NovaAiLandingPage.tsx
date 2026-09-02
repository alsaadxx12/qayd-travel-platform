import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plane,
  FileText,
  CreditCard,
  QrCode,
  Printer,
  ShieldCheck,
  Zap,
  Check,
  ChevronDown,
  Star,
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  Building2,
  Users,
  Calendar,
  Search,
  Sparkles,
  Headphones,
  CheckCircle2,
  Globe,
  DollarSign,
  Layers,
  ChevronRight,
  Menu,
  X,
  Clock,
  Send,
  Sliders,
  CheckCircle,
  BarChart3,
  Lock,
  RefreshCw,
  Award,
  Smartphone,
  Repeat,
  Wallet,
  Wifi,
  ExternalLink,
} from 'lucide-react';

export const NovaAiLandingPage: React.FC = () => {
  const [isAr, setIsAr] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pricingCycle, setPricingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // ── Money Flow Simulation State ──
  const [flowActive, setFlowActive] = useState(false);
  const [flowStep, setFlowStep] = useState<number>(0);
  const [vaultBalance, setVaultBalance] = useState<number>(52140);
  const [airlineSettlement, setAirlineSettlement] = useState<number>(184200);

  // ── Stripe Checkout Simulation State ──
  const [checkoutRoute, setCheckoutRoute] = useState<'BGW-IST' | 'BGW-DXB' | 'BSR-AMM'>('BGW-IST');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'transfer'>('card');
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'processing' | 'success'>('idle');

  // ── Interactive Chart Filter ──
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d'>('7d');
  const [hoveredDataPoint, setHoveredDataPoint] = useState<number | null>(null);

  const direction = isAr ? 'rtl' : 'ltr';
  const toggleLanguage = () => setIsAr((prev) => !prev);

  // Trigger money flow animation sequence
  const handleTriggerFlow = () => {
    if (flowActive) return;
    setFlowActive(true);
    setFlowStep(1);

    setTimeout(() => setFlowStep(2), 600);
    setTimeout(() => setFlowStep(3), 1200);
    setTimeout(() => {
      setFlowStep(4);
      setVaultBalance((v) => v + 65);
      setAirlineSettlement((a) => a + 420);
      setFlowActive(false);
    }, 1800);
  };

  // Trigger Checkout
  const handleProcessCheckout = () => {
    if (checkoutStatus === 'processing') return;
    setCheckoutStatus('processing');
    setTimeout(() => {
      setCheckoutStatus('success');
    }, 1000);
  };

  // Chart data points
  const chartData = useMemo(() => {
    if (chartPeriod === '7d') {
      return [
        { label: isAr ? 'السبت' : 'Sat', val: 12400, profit: 1450, tickets: 34 },
        { label: isAr ? 'الأحد' : 'Sun', val: 16800, profit: 1980, tickets: 46 },
        { label: isAr ? 'الاثنين' : 'Mon', val: 14200, profit: 1720, tickets: 40 },
        { label: isAr ? 'الثلاثاء' : 'Tue', val: 21500, profit: 2640, tickets: 62 },
        { label: isAr ? 'الأربعاء' : 'Wed', val: 18900, profit: 2310, tickets: 55 },
        { label: isAr ? 'الخميس' : 'Thu', val: 26400, profit: 3200, tickets: 78 },
        { label: isAr ? 'الجمعة' : 'Fri', val: 29800, profit: 3680, tickets: 89 },
      ];
    }
    return [
      { label: 'W1', val: 68400, profit: 8900, tickets: 195 },
      { label: 'W2', val: 84200, profit: 11200, tickets: 245 },
      { label: 'W3', val: 92600, profit: 12800, tickets: 280 },
      { label: 'W4', val: 114500, profit: 15400, tickets: 335 },
    ];
  }, [chartPeriod, isAr]);

  const maxChartVal = Math.max(...chartData.map((d) => d.val));

  return (
    <div
      className="min-h-screen bg-[#FAFAFC] text-slate-900 font-sans selection:bg-[#FFF3E8] selection:text-[#F45A0A] overflow-x-hidden"
      dir={direction}
      style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* ── 1. STRIPE-STYLE MESH BACKGROUND GRADIENT ── */}
      <div className="absolute top-0 inset-x-0 h-[720px] overflow-hidden -z-10 pointer-events-none">
        {/* Angled Stripe Slant */}
        <div
          className="absolute -top-[20%] -left-[10%] w-[120%] h-[120%] opacity-90"
          style={{
            transform: 'skewY(-6deg)',
            background:
              'radial-gradient(ellipse at 75% 20%, rgba(244,90,10,0.18) 0%, rgba(255,140,56,0.1) 35%, rgba(255,255,255,0) 70%), radial-gradient(ellipse at 25% 40%, rgba(254,215,170,0.3) 0%, rgba(255,247,237,0.1) 45%, rgba(255,255,255,0) 75%)',
          }}
        />
        {/* Crisp Architectural Grid Lines */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* ── 2. TOP TICKER STRIP ── */}
      <div className="bg-slate-900 text-white text-[12px] font-bold py-2 px-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="bg-[#F45A0A] text-white px-2 py-0.5 rounded-full text-[10px] font-mono font-black tracking-wider">
              FINTECH 2026
            </span>
            <span className="text-slate-200">
              {isAr
                ? 'البنية التحتية المالية الأولى لوكالات السفر: ترحيل فوري، بطاقات دفع افتراضية، ومطابقة تدفقات النقد.'
                : 'The Financial Operating System for Travel: Real-Time Postings, Virtual Cards & Automated Flow.'}
            </span>
          </div>
          <Link
            to="/login"
            className="text-[#F45A0A] hover:text-orange-400 inline-flex items-center gap-1 text-xs font-black transition-colors"
          >
            <span>{isAr ? 'تجربة المنظومة مجاناً' : 'Start Free Demo'}</span>
            {isAr ? <ArrowLeft size={13} /> : <ArrowRight size={13} />}
          </Link>
        </div>
      </div>

      {/* ── 3. STRIPE-STYLE ULTRA-CLEAN NAVBAR ── */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#F45A0A] via-[#FF6A18] to-[#FF8C42] text-white flex items-center justify-center shadow-lg shadow-orange-500/25 group-hover:scale-105 transition-transform">
              <Plane size={22} strokeWidth={2.5} className="rotate-[-20deg]" />
            </div>
            <div className="text-start">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-black text-2xl text-slate-900 tracking-tight font-mono">QAYD</span>
                <span className="font-black text-2xl text-[#F45A0A]">قَيْد</span>
              </div>
              <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mt-1 font-mono">
                {isAr ? 'منظومة السفر والمحاسبة المالية' : 'Travel Fintech Cloud'}
              </p>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden lg:flex items-center gap-8 text-[13px] font-bold text-slate-700">
            <a href="#flow" className="hover:text-[#F45A0A] transition-colors">{isAr ? 'محاكاة حركة الأموال' : 'Money Flow'}</a>
            <a href="#checkout" className="hover:text-[#F45A0A] transition-colors">{isAr ? 'بوابة الدفع والإصدار' : 'Checkout Terminal'}</a>
            <a href="#analytics" className="hover:text-[#F45A0A] transition-colors">{isAr ? 'الرسوم والتحليلات' : 'Analytics'}</a>
            <a href="#solutions" className="hover:text-[#F45A0A] transition-colors">{isAr ? 'الحلول السياحية' : 'Solutions'}</a>
            <a href="#pricing" className="hover:text-[#F45A0A] transition-colors">{isAr ? 'الأسعار' : 'Pricing'}</a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              <Globe size={14} className="text-[#F45A0A]" />
              <span className="font-mono">{isAr ? 'EN' : 'عربي'}</span>
            </button>

            {/* Login */}
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              {isAr ? 'تسجيل الدخول' : 'Sign In'}
            </Link>

            {/* Get Started Button */}
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F45A0A] to-[#DD4F05] text-white text-xs font-black shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>{isAr ? 'ابدأ الآن مجاناً' : 'Get Started'}</span>
              {isAr ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-6 py-4 space-y-3 shadow-xl">
            <a href="#flow" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-sm font-bold text-slate-800">{isAr ? 'محاكاة حركة الأموال' : 'Money Flow'}</a>
            <a href="#checkout" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-sm font-bold text-slate-800">{isAr ? 'بوابة الدفع والإصدار' : 'Checkout Terminal'}</a>
            <a href="#analytics" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-sm font-bold text-slate-800">{isAr ? 'الرسوم والتحليلات' : 'Analytics'}</a>
            <a href="#solutions" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-sm font-bold text-slate-800">{isAr ? 'الحلول السياحية' : 'Solutions'}</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block py-1 text-sm font-bold text-slate-800">{isAr ? 'الأسعار' : 'Pricing'}</a>
            <div className="pt-2 border-t border-slate-100">
              <Link to="/login" className="block text-center py-2.5 rounded-xl bg-[#F45A0A] text-white font-black text-xs">
                {isAr ? 'تسجيل الدخول للنظام' : 'Sign In'}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── 4. STRIPE FINTECH HERO SECTION WITH 3D CARDS ── */}
      <section className="relative pt-12 pb-24 md:pt-20 md:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Bold Value Proposition */}
            <div className="lg:col-span-6 text-start space-y-6">
              
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-[#F45A0A] text-xs font-black shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#F45A0A] animate-pulse" />
                <span>{isAr ? 'البنية التحتية المالية الأذكى لوكالات السفر' : 'Financial Infrastructure for Modern Travel'}</span>
              </div>

              {/* Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15]">
                {isAr ? (
                  <>
                    تدفقات مالية وحسابات سفر تدار{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F45A0A] via-[#FF6F22] to-[#DD4F05]">
                      بدقة ذكية فائقة
                    </span>
                  </>
                ) : (
                  <>
                    Travel Cashflow & Bookings Powered by{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F45A0A] via-[#FF6F22] to-[#DD4F05]">
                      Smart Financial Precision
                    </span>
                  </>
                )}
              </h1>

              {/* Subtitle */}
              <p className="text-sm sm:text-base md:text-lg text-slate-600 font-medium leading-relaxed max-w-xl">
                {isAr
                  ? 'منصة مالية وسياحية متكاملة تجمع بين حجز التذاكر، إدارة الكروبات، سندات القبض والدفع، وكشوفات الحساب التفاعلية برمز QR، مع ترحيل محاسبي لحظي في أجزاء من الثانية.'
                  : 'A unified financial suite unifying ticket issuance, group packages, instant payment vouchers, and real-time QR statements with zero reconciliation delays.'}
              </p>

              {/* Dual Action Buttons */}
              <div className="flex items-center gap-3.5 flex-wrap pt-2">
                <Link
                  to="/login"
                  className="h-13 px-8 rounded-2xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-sm font-black flex items-center justify-center gap-2.5 shadow-xl shadow-orange-500/25 hover:shadow-orange-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <span>{isAr ? 'ابدأ تجربتك المجانية الآن' : 'Start Free 14-Day Trial'}</span>
                  {isAr ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                </Link>
                <a
                  href="#flow"
                  className="h-13 px-6 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold flex items-center justify-center gap-2 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
                >
                  <Repeat size={16} className="text-[#F45A0A]" />
                  <span>{isAr ? 'شاهد محاكاة تدفق الأموال' : 'Explore Money Flow'}</span>
                </a>
              </div>

              {/* Metrics Strip */}
              <div className="pt-8 border-t border-slate-200/80 grid grid-cols-3 gap-4 text-start font-mono">
                <div>
                  <span className="font-black text-2xl text-slate-900 block" dir="ltr">+500</span>
                  <span className="text-[11px] font-sans font-bold text-slate-500">{isAr ? 'وكالة معتمدة' : 'Agencies'}</span>
                </div>
                <div>
                  <span className="font-black text-2xl text-[#059669] block" dir="ltr">&lt; 0.2s</span>
                  <span className="text-[11px] font-sans font-bold text-slate-500">{isAr ? 'سرعة الترحيل' : 'Sync Latency'}</span>
                </div>
                <div>
                  <span className="font-black text-2xl text-[#F45A0A] block" dir="ltr">100%</span>
                  <span className="text-[11px] font-sans font-bold text-slate-500">{isAr ? 'مطابقة محاسبية' : 'Reconciliation'}</span>
                </div>
              </div>

            </div>

            {/* Right Column: STRIPE-GRADE FLOATING 3D CARDS VISUAL */}
            <div className="lg:col-span-6 relative flex items-center justify-center min-h-[460px] select-none">
              
              {/* Floating Ambient Halo */}
              <div className="absolute w-80 h-80 bg-gradient-to-tr from-[#F45A0A]/25 via-amber-400/20 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

              {/* CARD 1 (PRIMARY): 3D Metallic Travel Mastercard */}
              <div
                className="w-full max-w-[380px] h-[230px] rounded-3xl p-6 text-white shadow-2xl relative transition-transform duration-300 hover:scale-[1.03] overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 60%, #020617 100%)',
                  boxShadow: '0 25px 50px -12px rgba(244, 90, 10, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                  transform: 'rotate(-4deg) translateY(-15px)',
                }}
              >
                {/* Gloss Light Reflection Line */}
                <div className="absolute -top-24 -left-24 w-72 h-72 bg-gradient-to-br from-white/20 to-transparent rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-lg tracking-wider text-white">QAYD</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#F45A0A] text-[9.5px] font-black uppercase tracking-wider">
                      CORPORATE
                    </span>
                  </div>
                  <Wifi size={20} className="rotate-90 text-slate-400" />
                </div>

                {/* EMV Gold Chip Simulation */}
                <div className="mt-5 w-11 h-8 rounded-lg bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300/60 shadow-sm relative overflow-hidden">
                  <div className="absolute inset-x-0 top-1/2 h-[1px] bg-amber-800/40" />
                  <div className="absolute inset-y-0 left-1/3 w-[1px] bg-amber-800/40" />
                </div>

                {/* Card Number & Balance */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-mono text-xs tracking-widest text-slate-300" dir="ltr">
                    •••• •••• •••• 9412
                  </span>
                  <span className="font-mono font-black text-base text-emerald-400" dir="ltr">
                    $52,140.00
                  </span>
                </div>

                {/* Cardholder & Brand Logo */}
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider block">AGENCY VAULT</span>
                    <span className="font-bold text-xs text-white uppercase tracking-wide font-mono">AL-OFUQ TRAVEL CORP</span>
                  </div>
                  {/* Mastercard circles */}
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-[#EA580C] opacity-90" />
                    <div className="w-6 h-6 rounded-full bg-[#F59E0B] opacity-90" />
                  </div>
                </div>
              </div>

              {/* CARD 2 (SECONDARY): Floating Multi-Currency IQD Vault */}
              <div
                className="w-full max-w-[340px] h-[190px] rounded-3xl p-5 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl absolute transition-transform duration-300 hover:scale-[1.03]"
                style={{
                  transform: 'rotate(6deg) translate(25px, 90px)',
                }}
              >
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center font-black">
                      IQ
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">{isAr ? 'صندوق الدينار العراقي' : 'IQD Cash Vault'}</span>
                      <span className="text-[10px] text-slate-400 font-mono">1,510 Rate Lock</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono font-bold text-[10px] border border-emerald-200">
                    LIVE
                  </span>
                </div>

                <div className="mt-3">
                  <span className="text-[10.5px] text-slate-500 font-bold block">{isAr ? 'الرصيد النقدي المتوفر' : 'Available Cash Balance'}</span>
                  <span className="font-mono font-black text-2xl text-slate-900 block mt-0.5" dir="ltr">
                    68,500,000 IQD
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-slate-600 bg-slate-50 p-2 rounded-xl">
                  <span>{isAr ? 'آخر تسوية صندوق:' : 'Last Balance Close:'}</span>
                  <span className="font-mono text-slate-900" dir="ltr">2026-09-02 22:40</span>
                </div>
              </div>

              {/* FLOATING PILL 3: Live Posted Transaction Toast */}
              <div
                className="absolute bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-xl flex items-center gap-3 animate-bounce"
                style={{
                  top: '10px',
                  left: '0px',
                  animationDuration: '3s',
                }}
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Check size={16} />
                </div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block">
                    {isAr ? 'سند قبض تم ترحيله تلقائياً' : 'Receipt Posted Instantly'}
                  </span>
                  <span className="font-mono text-[11px] font-black text-[#059669]" dir="ltr">
                    +$4,200.00 • RV-00482
                  </span>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ── 5. INTERACTIVE MONEY FLOW SIMULATION ENGINE (محاكاة تدفق الأموال) ── */}
      <section id="flow" className="py-20 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-wider text-[#F45A0A] font-mono block mb-2">
              {isAr ? 'محرك التدفق المالي الذكي' : 'Automated Money Flow Engine'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {isAr ? 'شاهد كيف تسري الأموال والقيود فورياً داخل قيد' : 'Watch How Transactions Flow in Real Time'}
            </h2>
            <p className="mt-3 text-sm text-slate-600 font-medium">
              {isAr
                ? 'اضغط على الزر التفاعلي لمشاهدة كيف ينتقل المبلغ من العميل، ويوزع تلقائياً بين أرباح القاصة وتكلفة خط الطيران.'
                : 'Click the trigger to simulate an incoming booking payment and watch automated ledger distribution.'}
            </p>
          </div>

          {/* Money Flow Canvas */}
          <div className="bg-[#F8FAFC] rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-sm">
            
            {/* Action Trigger Button Bar */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-200 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-xs text-slate-500 uppercase tracking-wider">
                  FLOW SIMULATOR
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-[#F45A0A] text-xs font-bold font-mono">
                  {flowActive ? (isAr ? 'جارِ نقل وتسوية البيانات...' : 'PULSE IN TRANSIT...') : (isAr ? 'جاهز للتجربة' : 'READY')}
                </span>
              </div>

              <button
                type="button"
                onClick={handleTriggerFlow}
                disabled={flowActive}
                className="h-11 px-6 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-black text-xs shadow-md shadow-orange-500/25 flex items-center gap-2 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <Zap size={15} />
                <span>{isAr ? '⚡ إطلاق نبضة مالية تجريبية' : '⚡ Simulate Payment Pulse'}</span>
              </button>
            </div>

            {/* Visual Flow Nodes Grid */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4 relative">
              
              {/* NODE 1: The Passenger / Customer */}
              <div className={`p-5 rounded-2xl border transition-all ${
                flowStep === 1
                  ? 'bg-orange-50 border-[#F45A0A] shadow-md scale-[1.02]'
                  : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#F45A0A] flex items-center justify-center font-black">
                    1
                  </div>
                  <span className="font-mono text-[11px] font-bold text-slate-400">PAYER</span>
                </div>
                <h4 className="font-black text-slate-900 text-sm">{isAr ? 'العميل أو المسافر' : 'Customer Payment'}</h4>
                <p className="text-[11.5px] text-slate-500 font-medium mt-1">
                  {isAr ? 'دفع قيمة تذكرة الرحلة ($485)' : 'Issues ticket checkout: $485'}
                </p>
                <div className="mt-3 pt-2 border-t border-slate-100 font-mono font-bold text-xs text-slate-700">
                  Total: $485.00
                </div>
              </div>

              {/* NODE 2: QAYD Smart Ledger Posting */}
              <div className={`p-5 rounded-2xl border transition-all ${
                flowStep === 2
                  ? 'bg-orange-50 border-[#F45A0A] shadow-md scale-[1.02]'
                  : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">
                    2
                  </div>
                  <span className="font-mono text-[11px] font-bold text-[#F45A0A]">AUTO POST</span>
                </div>
                <h4 className="font-black text-slate-900 text-sm">{isAr ? 'الترحيل التلقائي الفوري' : 'Instant Ledger Engine'}</h4>
                <p className="text-[11.5px] text-slate-500 font-medium mt-1">
                  {isAr ? 'توليد قيد مزدوج وسند قبض معتمد' : 'Generates double-entry & voucher'}
                </p>
                <div className="mt-3 pt-2 border-t border-slate-100 font-mono font-bold text-xs text-[#059669]">
                  Audited: 0.18s
                </div>
              </div>

              {/* NODE 3: Agency Vault (Net Profit) */}
              <div className={`p-5 rounded-2xl border transition-all ${
                flowStep >= 3
                  ? 'bg-emerald-50 border-emerald-500 shadow-md scale-[1.02]'
                  : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                    3A
                  </div>
                  <span className="font-mono text-[11px] font-bold text-emerald-700">PROFIT</span>
                </div>
                <h4 className="font-black text-slate-900 text-sm">{isAr ? 'قاصة وأرباح الوكالة' : 'Agency Net Profit'}</h4>
                <p className="text-[11.5px] text-slate-500 font-medium mt-1">
                  {isAr ? 'تحويل ربح المقعد فوراً للقاصة' : 'Direct margin credited to box'}
                </p>
                <div className="mt-3 pt-2 border-t border-slate-100 font-mono font-black text-xs text-[#059669]">
                  +$65.00 (Total: ${vaultBalance.toLocaleString()})
                </div>
              </div>

              {/* NODE 4: Airline Settlement Account */}
              <div className={`p-5 rounded-2xl border transition-all ${
                flowStep >= 3
                  ? 'bg-blue-50 border-blue-500 shadow-md scale-[1.02]'
                  : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                    3B
                  </div>
                  <span className="font-mono text-[11px] font-bold text-blue-700">SETTLED</span>
                </div>
                <h4 className="font-black text-slate-900 text-sm">{isAr ? 'تسوية خط الطيران' : 'Carrier Settlement'}</h4>
                <p className="text-[11.5px] text-slate-500 font-medium mt-1">
                  {isAr ? 'تسوية كلفة الشراء بدون تداخل' : 'Purchase cost earmarked'}
                </p>
                <div className="mt-3 pt-2 border-t border-slate-100 font-mono font-bold text-xs text-blue-800">
                  $420.00 (Balance: ${airlineSettlement.toLocaleString()})
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ── 6. STRIPE CHECKOUT TERMINAL & TICKETING WIDGET ── */}
      <section id="checkout" className="py-20 bg-[#FAFAFC] border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-12">
            <span className="text-xs font-black uppercase tracking-wider text-[#F45A0A] font-mono block mb-2">
              {isAr ? 'تجربة حية لوحدة الإصدار والدفع' : 'Interactive Payment Terminal'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {isAr ? 'إصدار ودفع وترحيل في أقل من ثانيتين' : 'Issue, Charge, and Post in Under 2 Seconds'}
            </h2>
            <p className="mt-2 text-sm text-slate-600 font-medium">
              {isAr ? 'جرّب عملية الدفع أدناه وشاهد الإيصال وكود الـ QR اللحظي.' : 'Simulate a real booking payment with instant verified QR slip.'}
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            {/* Left Col: The Terminal Inputs */}
            <div className="md:col-span-7 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">{isAr ? 'اختر خط السير والرحلة:' : 'Select Route:'}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'BGW-IST', label: 'BGW ✈️ IST', price: 435 },
                    { id: 'BGW-DXB', label: 'BGW ✈️ DXB', price: 510 },
                    { id: 'BSR-AMM', label: 'BSR ✈️ AMM', price: 415 },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCheckoutRoute(item.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                        checkoutRoute === item.id
                          ? 'border-[#F45A0A] bg-orange-50/50 text-[#F45A0A]'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="block font-black">{item.label}</span>
                      <span className="text-[11px] text-slate-500">${item.price}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">{isAr ? 'وسيلة الدفع:' : 'Payment Instrument:'}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'card', label: isAr ? 'ماستركارد / فيزا' : 'Card', icon: CreditCard },
                    { id: 'cash', label: isAr ? 'نقد (صندوق)' : 'Cash Vault', icon: Wallet },
                    { id: 'transfer', label: isAr ? 'حوالة مصرفية' : 'Bank Transfer', icon: Building2 },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as any)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          paymentMethod === m.id
                            ? 'border-[#F45A0A] bg-orange-50/50 text-[#F45A0A]'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <Icon size={14} />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Checkout Action Button */}
              <button
                type="button"
                onClick={handleProcessCheckout}
                disabled={checkoutStatus === 'processing'}
                className="w-full h-12 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-black text-xs shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-all"
              >
                {checkoutStatus === 'processing' ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>{isAr ? 'جارٍ التحقق وترحيل السند...' : 'Processing & posting to ledger...'}</span>
                  </>
                ) : (
                  <>
                    <Lock size={15} />
                    <span>{isAr ? 'دفع وترحيل السند فوراً' : 'Authorize & Post Transaction'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Right Col: The Generated Receipt with QR Code */}
            <div className="md:col-span-5 bg-slate-50 p-5 rounded-2xl border border-dashed border-slate-300 font-mono text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <span className="font-bold text-slate-900">QAYD RECEIPT SLIP</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black">
                  {checkoutStatus === 'success' ? 'VERIFIED' : 'READY'}
                </span>
              </div>

              <div className="mt-3 space-y-2 text-slate-600">
                <div className="flex justify-between">
                  <span>Route:</span>
                  <span className="font-black text-slate-900">{checkoutRoute}</span>
                </div>
                <div className="flex justify-between">
                  <span>Method:</span>
                  <span className="uppercase text-slate-800 font-bold">{paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span>Voucher Ref:</span>
                  <span className="text-slate-800">RV-2026-9812</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-sm text-slate-900">
                  <span>Total Amount:</span>
                  <span className="text-[#F45A0A]">$435.00</span>
                </div>
              </div>

              {/* QR Code Container */}
              <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <span className="font-sans font-bold text-[11px] text-slate-800 block">
                    {isAr ? 'امسح الرمز لعرض كشف الحساب' : 'Scan for live statement'}
                  </span>
                  <span className="text-[10px] text-slate-400">qayd-travel.com/qr/9812</span>
                </div>
                <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center p-1 shadow-xs">
                  <QrCode size={34} className="text-orange-400" />
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── 7. LIVE INTERACTIVE CASHFLOW ANALYTICS (الرسم البياني المالي التفاعلي) ── */}
      <section id="analytics" className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[#F45A0A] font-mono block mb-1">
                {isAr ? 'تحليلات التدفق النقدي المباشرة' : 'Live Cashflow Analytics'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                {isAr ? 'رؤية مالية واضحة لأرباح ومبيعات الوكالة' : 'Real-Time Financial Visibility & Margins'}
              </h2>
            </div>

            {/* Time Toggle */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setChartPeriod('7d')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  chartPeriod === '7d' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-600'
                }`}
              >
                {isAr ? 'آخر 7 أيام' : 'Last 7 Days'}
              </button>
              <button
                type="button"
                onClick={() => setChartPeriod('30d')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  chartPeriod === '30d' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-600'
                }`}
              >
                {isAr ? 'آخر شهر' : 'Last 30 Days'}
              </button>
            </div>
          </div>

          {/* Interactive Chart Canvas Container */}
          <div className="bg-[#F8FAFC] rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
            
            {/* Top KPI Metrics Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-6 border-b border-slate-200 text-start">
              <div>
                <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'إجمالي المبيعات' : 'Total Revenue'}</span>
                <span className="font-mono font-black text-xl text-slate-900 block mt-0.5" dir="ltr">$142,850.00</span>
                <span className="text-[10px] text-emerald-600 font-bold">↑ +14.2% {isAr ? 'نمو' : 'growth'}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'صافي الأرباح' : 'Net Margin'}</span>
                <span className="font-mono font-black text-xl text-[#059669] block mt-0.5" dir="ltr">+$18,420.50</span>
                <span className="text-[10px] text-emerald-600 font-bold">↑ +8.5% {isAr ? 'هامش ربح' : 'margin'}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'التذاكر المصدرة' : 'Tickets Issued'}</span>
                <span className="font-mono font-black text-xl text-[#F45A0A] block mt-0.5" dir="ltr">412</span>
                <span className="text-[10px] text-slate-500 font-bold">98.5% {isAr ? 'مؤكدة' : 'confirmed'}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'حركات السندات' : 'Voucher Postings'}</span>
                <span className="font-mono font-black text-xl text-slate-900 block mt-0.5" dir="ltr">856</span>
                <span className="text-[10px] text-emerald-600 font-bold">100% {isAr ? 'مطابقة' : 'audited'}</span>
              </div>
            </div>

            {/* Interactive SVG / Bar Chart Simulation */}
            <div className="mt-8 pt-4">
              <div className="flex items-end justify-between gap-2 h-56 pt-6">
                {chartData.map((d, idx) => {
                  const heightPercent = Math.round((d.val / maxChartVal) * 100);
                  const isHovered = hoveredDataPoint === idx;

                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center gap-2 group cursor-pointer"
                      onMouseEnter={() => setHoveredDataPoint(idx)}
                      onMouseLeave={() => setHoveredDataPoint(null)}
                    >
                      {/* Floating Tooltip on Hover */}
                      <div className={`transition-all duration-200 ${
                        isHovered ? 'opacity-100 -translate-y-1' : 'opacity-0 pointer-events-none'
                      }`}>
                        <div className="bg-slate-900 text-white px-2.5 py-1 rounded-lg text-[10px] font-mono text-center shadow-lg whitespace-nowrap">
                          <div>Rev: ${d.val.toLocaleString()}</div>
                          <div className="text-emerald-400 font-bold">Profit: +${d.profit}</div>
                        </div>
                      </div>

                      {/* Bar Pillar */}
                      <div className="w-full max-w-[48px] bg-slate-200/80 rounded-xl overflow-hidden flex flex-col justify-end h-40">
                        <div
                          className="w-full bg-gradient-to-t from-[#F45A0A] to-[#FF8C42] rounded-xl transition-all duration-500 group-hover:brightness-110"
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>

                      {/* Label */}
                      <span className="font-mono text-xs font-bold text-slate-600 group-hover:text-[#F45A0A] transition-colors">
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── 8. FINTECH TRAVEL CAPABILITIES BENTO (حلول السفر المالية) ── */}
      <section id="solutions" className="py-20 bg-[#FAFAFC] border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-wider text-[#F45A0A] font-mono block mb-2">
              {isAr ? 'منظومة شاملة لشركات السفر' : 'All-In-One Fintech Capabilities'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
              {isAr ? 'كل ما تحتاجه للتحكم المالي والإداري الكامل' : 'Complete Financial & Booking Control'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all">
              <div className="w-11 h-11 rounded-2xl bg-orange-50 text-[#F45A0A] flex items-center justify-center font-bold mb-4">
                <FileText size={22} />
              </div>
              <h3 className="font-black text-base text-slate-900 mb-1.5">{isAr ? 'شجرة الحسابات السياحية' : 'Travel Chart of Accounts'}</h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                {isAr ? 'شجرة متخصصة لقيود التذاكر والفنادق والفيزا مع مطابقة لحظية لأرصدة الوكلاء والخطوط.' : 'Automated double-entry journals generated with every PNR booking.'}
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center font-bold mb-4">
                <QrCode size={22} />
              </div>
              <h3 className="font-black text-base text-slate-900 mb-1.5">{isAr ? 'بوابة كشف الحساب QR' : 'Interactive QR Portal'}</h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                {isAr ? 'كشف حساب حي ومحدث لحظياً عبر رمز QR يمسحه العميل بهاتفه دون الحاجة لكلمات مرور.' : 'Clients scan receipt QR codes for instant self-serve statements.'}
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-4">
                <Users size={22} />
              </div>
              <h3 className="font-black text-base text-slate-900 mb-1.5">{isAr ? 'باقات الكروبات والمقاعد' : 'Tour Groups & Margins'}</h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                {isAr ? 'قوالب الأسعار، تكاليف الطيران والفنادق، وإدارة أسماء المسافرين وأرباح الكروب.' : 'Build price templates, allocate seats, and manage group manifests.'}
              </p>
            </div>

            {/* Card 4 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-all">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold mb-4">
                <ShieldCheck size={22} />
              </div>
              <h3 className="font-black text-base text-slate-900 mb-1.5">{isAr ? 'فروع وصناديق مستقلة' : 'Multi-Branch Desks'}</h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                {isAr ? 'صناديق وقاصات نقدية متعددة مع إقفال ومطابقة يومية تمنع العجز المالي.' : 'Multi-branch cashbox management with automated daily closing.'}
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── 9. TRANSPARENT PRICING GRID ── */}
      <section id="pricing" className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-wider text-[#F45A0A] font-mono block mb-2">
              {isAr ? 'باقات اشتراك واضحة' : 'Transparent Pricing'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
              {isAr ? 'استثمر في راحة بالك ونمو أرباحك' : 'Plans That Scale With Your Agency'}
            </h2>
            <p className="mt-2 text-sm text-slate-600 font-medium">
              {isAr ? 'تجربة مجانية كاملة المزايا لمدة 14 يوماً مع تدريب مجاني لفريقك.' : '14-day free trial with complimentary team onboarding.'}
            </p>

            {/* Cycle Toggle */}
            <div className="mt-6 inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPricingCycle('monthly')}
                className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                  pricingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                {isAr ? 'اشتراك شهري' : 'Monthly'}
              </button>
              <button
                type="button"
                onClick={() => setPricingCycle('yearly')}
                className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  pricingCycle === 'yearly' ? 'bg-[#F45A0A] text-white shadow-2xs font-black' : 'text-slate-600'
                }`}
              >
                <span>{isAr ? 'اشتراك سنوي' : 'Annual'}</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.2 rounded-full font-mono">
                  {isAr ? 'وفر 20%' : 'Save 20%'}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            
            {/* Starter Plan */}
            <div className="bg-[#F8FAFC] rounded-3xl p-7 border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <span className="font-bold text-slate-500 text-xs block mb-1">{isAr ? 'المكاتب والشركات الناشئة' : 'Starter'}</span>
                <h3 className="font-black text-2xl text-slate-900 mb-2">{isAr ? 'الباقة الأساسية' : 'Starter Plan'}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="font-mono font-black text-3xl text-slate-900" dir="ltr">
                    {pricingCycle === 'monthly' ? '$39' : '$31'}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">{isAr ? '/ شهر' : '/ mo'}</span>
                </div>
                <ul className="space-y-3 text-xs font-bold text-slate-700 mb-8">
                  <li className="flex items-center gap-2"><Check size={16} className="text-[#059669]" /><span>{isAr ? 'حتى 3 مستخدمين للنظام' : 'Up to 3 Users'}</span></li>
                  <li className="flex items-center gap-2"><Check size={16} className="text-[#059669]" /><span>{isAr ? 'إصدار التذاكر وسندات القبض والدفع' : 'Tickets & Vouchers'}</span></li>
                  <li className="flex items-center gap-2"><Check size={16} className="text-[#059669]" /><span>{isAr ? 'شجرة الحسابات وكشوفات الحساب' : 'Chart of Accounts'}</span></li>
                  <li className="flex items-center gap-2"><Check size={16} className="text-[#059669]" /><span>{isAr ? 'طباعة حرارية و A4' : 'A4 & Thermal Print'}</span></li>
                </ul>
              </div>
              <Link to="/login" className="w-full py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-bold text-xs text-slate-900 text-center transition-colors block">
                {isAr ? 'ابدأ بالأساسية' : 'Choose Starter'}
              </Link>
            </div>

            {/* Pro Plan (Featured) */}
            <div className="bg-white rounded-3xl p-7 border-2 border-[#F45A0A] shadow-xl shadow-orange-500/10 relative flex flex-col justify-between">
              <div className="absolute -top-3.5 right-1/2 translate-x-1/2 bg-[#F45A0A] text-white text-[10.5px] font-black px-4 py-0.5 rounded-full uppercase tracking-wider">
                {isAr ? 'الأكثر طلباً' : 'Most Popular'}
              </div>
              <div>
                <span className="font-bold text-[#F45A0A] text-xs block mb-1">{isAr ? 'للشركات المتطورة' : 'Growing Travel ERP'}</span>
                <h3 className="font-black text-2xl text-slate-900 mb-2">{isAr ? 'الباقة المتقدمة (Pro)' : 'Professional Plan'}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="font-mono font-black text-4xl text-[#F45A0A]" dir="ltr">
                    {pricingCycle === 'monthly' ? '$79' : '$63'}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">{isAr ? '/ شهر' : '/ mo'}</span>
                </div>
                <ul className="space-y-3 text-xs font-bold text-slate-700 mb-8">
                  <li className="flex items-center gap-2"><Check size={16} className="text-[#059669]" /><span>{isAr ? 'مستخدمين غير محدودين' : 'Unlimited Users'}</span></li>
                  <li className="flex items-center gap-2"><Check size={16} className="text-[#059669]" /><span>{isAr ? 'منظومة الكروبات والمقاعد' : 'Tour Groups & Margins'}</span></li>
                  <li className="flex items-center gap-2"><Check size={16} className="text-[#059669]" /><span>{isAr ? 'بوابة كشف الحساب التفاعلية عبر QR' : 'Interactive QR Statements'}</span></li>
                  <li className="flex items-center gap-2"><Check size={16} className="text-[#059669]" /><span>{isAr ? 'دعم الفروع والصناديق المتعددة' : 'Multi-Branch Vaults'}</span></li>
                  <li className="flex items-center gap-2"><Check size={16} className="text-[#059669]" /><span>{isAr ? 'دعم فني ذو أولوية 24/7' : '24/7 Priority Support'}</span></li>
                </ul>
              </div>
              <Link to="/login" className="w-full py-3.5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] font-black text-xs text-white text-center shadow-md shadow-orange-500/25 transition-all block">
                {isAr ? 'ابدأ تجربة البرو المجانية' : 'Start Professional Trial'}
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-[#F8FAFC] rounded-3xl p-7 border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all">
              <div>
                <span className="font-bold text-slate-500 text-xs block mb-1">{isAr ? 'للشركات الكبرى وسلاسل الفروع' : 'Enterprise'}</span>
                <h3 className="font-black text-2xl text-slate-900 mb-2">{isAr ? 'باقة المؤسسات' : 'Enterprise Plan'}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="font-mono font-black text-3xl text-slate-900" dir="ltr">
                    {pricingCycle === 'monthly' ? '$149' : '$119'}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">{isAr ? '/ شهر' : '/ mo'}</span>
                </div>
                <ul className="space-y-3 text-xs font-bold text-slate-700 mb-8">
                  <li className="flex items-center gap-2"><Check size={16} className="text-[#059669]" /><span>{isAr ? 'جميع ميزات الباقة المتقدمة' : 'All Pro Features'}</span></li>
                  <li className="flex items-center gap-2"><Check size={16} className="text-[#059669]" /><span>{isAr ? 'فروع وشبكات غير محدودة' : 'Unlimited Branches'}</span></li>
                  <li className="flex items-center gap-2"><Check size={16} className="text-[#059669]" /><span>{isAr ? 'ربط API مخصص' : 'Custom API Integrations'}</span></li>
                  <li className="flex items-center gap-2"><Check size={16} className="text-[#059669]" /><span>{isAr ? 'سيرفرات ونسخ احتياطي مخصص' : 'Dedicated Cloud Servers'}</span></li>
                </ul>
              </div>
              <Link to="/login" className="w-full py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-bold text-xs text-slate-900 text-center transition-colors block">
                {isAr ? 'تواصل مع المبيعات' : 'Contact Enterprise'}
              </Link>
            </div>

          </div>

        </div>
      </section>

      {/* ── 10. GRAND STRIPE-STYLE FINTECH CTA ── */}
      <section className="py-20 bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-900 text-white relative overflow-hidden">
        {/* Glow ambient lines */}
        <div className="absolute -top-24 right-1/4 w-96 h-96 bg-[#F45A0A]/30 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#F45A0A] to-[#FF772A] text-white flex items-center justify-center mx-auto mb-6 shadow-xl shadow-orange-500/30">
            <Plane size={30} className="rotate-[-20deg]" />
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
            {isAr ? 'انضم إلى الجيل الجديد من وكالات السفر الذكية' : 'Join the Next Generation of Smart Travel Agencies'}
          </h2>
          <p className="mt-4 text-sm sm:text-base text-slate-300 max-w-xl mx-auto font-medium">
            {isAr
              ? 'ابدأ اليوم مجاناً وخلال دقائق ستكون جميع حجوزاتك وحساباتك متصلة في منظومة واحدة آمنة وسريعة.'
              : 'Deploy Qayd in minutes. Experience unified ticketing, packages, and instant ledger reconciliations.'}
          </p>
          <div className="mt-8 flex items-center justify-center gap-3.5 flex-wrap">
            <Link
              to="/login"
              className="h-13 px-8 rounded-2xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>{isAr ? 'ابدأ الآن مجاناً' : 'Get Started Free'}</span>
              {isAr ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
            </Link>
            <Link
              to="/login"
              className="h-13 px-6 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-bold flex items-center justify-center transition-all"
            >
              {isAr ? 'تسجيل الدخول' : 'Sign In'}
            </Link>
          </div>
        </div>
      </section>

      {/* ── 11. FOOTER ── */}
      <footer className="bg-white border-t border-slate-200 py-12 text-slate-500 text-xs font-medium">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#F45A0A] text-white flex items-center justify-center font-mono font-black">
              Q
            </div>
            <div>
              <span className="font-bold text-slate-900 block">{isAr ? 'منظومة قيد للسياحة والسفر' : 'QAYD Travel & Accounting Platform'}</span>
              <span className="text-[11px] text-slate-400">© 2026 {isAr ? 'جميع الحقوق محفوظة' : 'All rights reserved.'}</span>
            </div>
          </div>

          <div className="flex items-center gap-6 font-bold text-slate-600">
            <Link to="/login" className="hover:text-[#F45A0A] transition-colors">{isAr ? 'تسجيل الدخول' : 'Sign In'}</Link>
            <a href="#flow" className="hover:text-[#F45A0A] transition-colors">{isAr ? 'حركة الأموال' : 'Money Flow'}</a>
            <a href="#checkout" className="hover:text-[#F45A0A] transition-colors">{isAr ? 'بوابة الدفع' : 'Checkout'}</a>
            <a href="#pricing" className="hover:text-[#F45A0A] transition-colors">{isAr ? 'الأسعار' : 'Pricing'}</a>
          </div>
        </div>
      </footer>

    </div>
  );
};
