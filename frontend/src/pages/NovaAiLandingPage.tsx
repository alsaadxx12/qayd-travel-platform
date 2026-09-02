import React, { useState } from 'react';
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
} from 'lucide-react';

export const NovaAiLandingPage: React.FC = () => {
  const [isAr, setIsAr] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pricingCycle, setPricingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'vouchers' | 'tickets' | 'groups'>('dashboard');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const direction = isAr ? 'rtl' : 'ltr';

  const toggleLanguage = () => setIsAr((prev) => !prev);

  return (
    <div
      className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-[#FFF3E8] selection:text-[#F45A0A]"
      dir={direction}
      style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* ── 1. TOP ANNOUNCEMENT BAR ── */}
      <div className="bg-gradient-to-r from-[#F45A0A] via-[#FF6F22] to-[#DD4F05] text-white text-[12.5px] font-bold py-2 px-4 text-center shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 flex-wrap">
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px] font-mono">
            {isAr ? 'تحديث 2026' : 'New Update'}
          </span>
          <span>
            {isAr
              ? 'الجيل الأحدث من منظومة قيد المحاسبية لوكالات السفر: ترحيل تلقائي، كشوفات QR، وباقات الكروبات المتكاملة.'
              : 'The Next-Gen Accounting & Travel ERP: Instant Postings, QR Statements & Tour Group Packages.'}
          </span>
          <Link
            to="/login"
            className="underline underline-offset-4 hover:text-orange-100 transition-colors cursor-pointer mr-2"
          >
            {isAr ? 'جرّب المنظومة مجاناً ←' : 'Try it Free →'}
          </Link>
        </div>
      </div>

      {/* ── 2. MAIN NAVBAR ── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#F45A0A] to-[#DD4F05] text-white flex items-center justify-center shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
                <Plane size={22} strokeWidth={2.5} className="rotate-[-20deg]" />
              </div>
              <div className="text-start">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-xl text-slate-900 tracking-tight font-mono">
                    QAYD
                  </span>
                  <span className="font-black text-xl text-[#F45A0A]">
                    قَيْد
                  </span>
                </div>
                <p className="text-[10.5px] font-bold text-slate-500 -mt-0.5">
                  {isAr ? 'منظومة إدارة السفر والمحاسبة الذكية' : 'Travel & Accounting Platform'}
                </p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-[13.5px] font-bold text-slate-700">
            <a href="#features" className="hover:text-[#F45A0A] transition-colors">
              {isAr ? 'المميزات' : 'Features'}
            </a>
            <a href="#preview" className="hover:text-[#F45A0A] transition-colors">
              {isAr ? 'واجهة النظام' : 'System Preview'}
            </a>
            <a href="#solutions" className="hover:text-[#F45A0A] transition-colors">
              {isAr ? 'الحلول المحاسبية' : 'Solutions'}
            </a>
            <a href="#pricing" className="hover:text-[#F45A0A] transition-colors">
              {isAr ? 'الأسعار' : 'Pricing'}
            </a>
            <a href="#faq" className="hover:text-[#F45A0A] transition-colors">
              {isAr ? 'الأسئلة الشائعة' : 'FAQ'}
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <Globe size={14} />
              <span>{isAr ? 'English' : 'عربي'}</span>
            </button>

            {/* Login Link */}
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors"
            >
              {isAr ? 'تسجيل الدخول' : 'Sign In'}
            </Link>

            {/* CTA Button */}
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F45A0A] to-[#DD4F05] text-white text-xs font-black shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>{isAr ? 'ابدأ الآن مجاناً' : 'Get Started'}</span>
              {isAr ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
            </Link>

            {/* Mobile Hamburger Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="md:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-6 py-4 space-y-3">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-bold text-slate-700 py-1.5"
            >
              {isAr ? 'المميزات' : 'Features'}
            </a>
            <a
              href="#preview"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-bold text-slate-700 py-1.5"
            >
              {isAr ? 'واجهة النظام' : 'System Preview'}
            </a>
            <a
              href="#solutions"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-bold text-slate-700 py-1.5"
            >
              {isAr ? 'الحلول المحاسبية' : 'Solutions'}
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-bold text-slate-700 py-1.5"
            >
              {isAr ? 'الأسعار' : 'Pricing'}
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-bold text-slate-700 py-1.5"
            >
              {isAr ? 'الأسئلة الشائعة' : 'FAQ'}
            </a>
            <div className="pt-2 border-t border-slate-100">
              <Link
                to="/login"
                className="block text-center w-full py-2.5 rounded-xl bg-[#F45A0A] text-white font-bold text-xs"
              >
                {isAr ? 'تسجيل الدخول' : 'Sign In'}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── 3. HERO SECTION ── */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
        {/* Subtle Background Glows */}
        <div className="absolute top-0 right-1/2 translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-[#FFF3E8] to-transparent rounded-full blur-3xl -z-10 pointer-events-none opacity-80" />
        <div className="absolute top-1/3 right-10 w-96 h-96 bg-orange-100/40 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFF3E8] border border-[#FED7AA] text-[#F45A0A] text-xs font-bold shadow-2xs mb-6 animate-pulse">
            <Sparkles size={15} />
            <span>
              {isAr
                ? 'المنظومة المحاسبية والسياحية رقم 1 لشركات السفر'
                : 'No. 1 Accounting & Travel ERP for Travel Agencies'}
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="max-w-4xl mx-auto text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.18] sm:leading-[1.15]">
            {isAr ? (
              <>
                إدارة حجوزات السفر وحسابات الوكالة{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F45A0A] to-[#DD4F05]">
                  بذكاء ودقة فائقة
                </span>
              </>
            ) : (
              <>
                Manage Travel Bookings & Agency Accounts with{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F45A0A] to-[#DD4F05]">
                  Peak Intelligence & Precision
                </span>
              </>
            )}
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl mx-auto mt-6 text-sm sm:text-base md:text-lg text-slate-600 leading-relaxed font-medium">
            {isAr
              ? 'منصة سحابية متطورة توحد حجوزات الطيران، باقات الكروبات السياحية، الفنادق، وسندات القبض والصرف في شجرة حسابات لحظية سريعة بدقة لا تتجاوز ثانيتين.'
              : 'A modern cloud platform combining airline ticketing, group tours, hotels, and accounting vouchers into real-time ledger audits in under 2 seconds.'}
          </p>

          {/* CTA Buttons Row */}
          <div className="mt-8 sm:mt-10 flex items-center justify-center gap-3.5 flex-wrap">
            <Link
              to="/login"
              className="h-13 px-8 rounded-2xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>{isAr ? 'ابدأ تجربتك المجانية الآن' : 'Start Your Free Trial'}</span>
              {isAr ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
            </Link>

            <a
              href="#preview"
              className="h-13 px-7 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold flex items-center justify-center gap-2 shadow-2xs transition-all hover:border-slate-300 cursor-pointer"
            >
              <span>{isAr ? 'استكشف واجهة المنظومة' : 'Explore Platform Demo'}</span>
              <ChevronDown size={16} className="text-slate-500" />
            </a>
          </div>

          {/* Key Metrics Strip */}
          <div className="mt-14 max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 pt-10 border-t border-slate-200/70">
            <div className="p-3 text-center">
              <span className="block font-mono font-black text-2xl sm:text-3xl text-slate-900" dir="ltr">
                +500
              </span>
              <span className="text-xs font-bold text-slate-500 mt-0.5 block">
                {isAr ? 'شركة ووكالة معتمدة' : 'Trusted Travel Agencies'}
              </span>
            </div>

            <div className="p-3 text-center">
              <span className="block font-mono font-black text-2xl sm:text-3xl text-[#059669]" dir="ltr">
                99.9%
              </span>
              <span className="text-xs font-bold text-slate-500 mt-0.5 block">
                {isAr ? 'استقرار سحابي وأمان عالي' : 'Cloud Uptime & Security'}
              </span>
            </div>

            <div className="p-3 text-center">
              <span className="block font-mono font-black text-2xl sm:text-3xl text-[#F45A0A]" dir="ltr">
                &lt; 2s
              </span>
              <span className="text-xs font-bold text-slate-500 mt-0.5 block">
                {isAr ? 'سرعة فتح السندات والتقارير' : 'Report Load Speed'}
              </span>
            </div>

            <div className="p-3 text-center">
              <span className="block font-mono font-black text-2xl sm:text-3xl text-slate-900" dir="ltr">
                100%
              </span>
              <span className="text-xs font-bold text-slate-500 mt-0.5 block">
                {isAr ? 'مطابقة محاسبية معتمدة' : 'Accounting Compliance'}
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* ── 4. INTERACTIVE PRODUCT PREVIEW SHOWCASE ── */}
      <section id="preview" className="py-12 bg-white border-y border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-xs font-black uppercase tracking-wider text-[#F45A0A] font-mono block mb-2">
              {isAr ? 'واجهة استخدام فائقة السرعة والسهولة' : 'Lightning-Fast Intuitive UI'}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {isAr ? 'كل ما تحتاجه لإدارة شركتك في نافذة واحدة' : 'Everything Your Travel Agency Needs in One Workspace'}
            </h2>
            <p className="mt-3 text-sm text-slate-600 font-medium">
              {isAr
                ? 'صممت قيد بالتعاون مع كبرى شركات السياحة والسفر لتوفير أسرع تجربة عمل يومية وتفادي الأخطاء المالية.'
                : 'Engineered alongside top travel leaders for frictionless daily workflows and zero accounting errors.'}
            </p>
          </div>

          {/* Interactive Showcase Tabs */}
          <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'dashboard'
                  ? 'bg-[#F45A0A] text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <TrendingUp size={15} />
              <span>{isAr ? 'لوحة القيادة والمؤشرات' : 'Dashboard Analytics'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('vouchers')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'vouchers'
                  ? 'bg-[#F45A0A] text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <CreditCard size={15} />
              <span>{isAr ? 'سندات القبض والصرف' : 'Vouchers & Cashboxes'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tickets')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'tickets'
                  ? 'bg-[#F45A0A] text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Plane size={15} />
              <span>{isAr ? 'حجز وإصدار التذاكر' : 'Airline Ticketing'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('groups')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'groups'
                  ? 'bg-[#F45A0A] text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Users size={15} />
              <span>{isAr ? 'الكروبات والباقات السياحية' : 'Tour Groups & Packages'}</span>
            </button>
          </div>

          {/* Interactive Window Mockup Frame */}
          <div className="relative rounded-2xl sm:rounded-3xl border border-slate-300/80 bg-slate-900 shadow-2xl p-2 sm:p-4 overflow-hidden">
            {/* Window Top Controls */}
            <div className="flex items-center justify-between pb-3 px-2 border-b border-slate-800 text-slate-400 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                https://app.qayd-travel.com/{activeTab}
              </span>
              <div className="w-12" />
            </div>

            {/* Inner Dashboard Canvas */}
            <div className="bg-[#F8FAFC] rounded-xl p-4 sm:p-6 min-h-[380px] sm:min-h-[460px] text-slate-800">
              
              {/* TAB 1: DASHBOARD CONTENT */}
              {activeTab === 'dashboard' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-200">
                    <div>
                      <h3 className="font-black text-lg text-slate-900">
                        {isAr ? 'لوحة المراقبة المالية اللحظية' : 'Real-Time Financial Overview'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {isAr ? 'بيانات حية ومباشرة من شجرة الحسابات والصناديق' : 'Live accounts balance and daily agency turnover'}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      {isAr ? 'متصل ومرحل لحظياً' : 'Live Sync Active'}
                    </span>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'إجمالي المبيعات' : 'Total Revenue'}</span>
                      <span className="font-mono font-black text-xl text-slate-900 block mt-1" dir="ltr">$142,850.00</span>
                      <span className="text-[10px] text-emerald-600 font-bold mt-1 block">↑ +14.2% {isAr ? 'هذا الشهر' : 'this month'}</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'صافي أرباح الوكالة' : 'Net Profits'}</span>
                      <span className="font-mono font-black text-xl text-[#059669] block mt-1" dir="ltr">+$18,420.50</span>
                      <span className="text-[10px] text-emerald-600 font-bold mt-1 block">↑ +8.5% {isAr ? 'نمو الأرباح' : 'profit margin'}</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'رصيد القاصة الرئيسية' : 'Main Cashbox'}</span>
                      <span className="font-mono font-black text-xl text-[#F45A0A] block mt-1" dir="ltr">$52,140.00</span>
                      <span className="text-[10px] text-slate-500 font-bold mt-1 block">{isAr ? 'صندوق النقد اليومي' : 'Daily Cash Desk'}</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'التذاكر المصدرة' : 'Issued Tickets'}</span>
                      <span className="font-mono font-black text-xl text-slate-900 block mt-1" dir="ltr">1,248</span>
                      <span className="text-[10px] text-slate-500 font-bold mt-1 block">{isAr ? '98.5% نسبة النجاح' : 'Success rate'}</span>
                    </div>
                  </div>

                  {/* Mock Table */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
                      {isAr ? 'أحدث المعاملات والسندات المكتملة' : 'Recent Completed Transactions'}
                    </div>
                    <div className="divide-y divide-slate-100 text-xs font-medium">
                      <div className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                            RV
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{isAr ? 'سند قبض — شركة الأفق للسياحة' : 'Receipt Voucher — Horizon Tours'}</span>
                            <span className="text-[10.5px] text-slate-500">RV-2026-00482 • {isAr ? 'القاصة الرئيسية' : 'Main Box'}</span>
                          </div>
                        </div>
                        <span className="font-mono font-black text-emerald-700 text-sm" dir="ltr">+$4,200.00</span>
                      </div>
                      <div className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center font-bold">
                            TK
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">BGW-IST (Turkish Airlines) — أحمد الكرخي</span>
                            <span className="text-[10.5px] text-slate-500">TK-98214 • {isAr ? 'ربح التذكرة' : 'Profit'}: +$35.00</span>
                          </div>
                        </div>
                        <span className="font-mono font-black text-slate-900 text-sm" dir="ltr">$485.00</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: VOUCHERS CONTENT */}
              {activeTab === 'vouchers' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <h3 className="font-black text-lg text-slate-900">{isAr ? 'سندات القبض والدفع الفورية' : 'Instant Receipts & Payments'}</h3>
                      <p className="text-xs text-slate-500">{isAr ? 'ترحيل مباشر إلى شجرة الحسابات مع معاينة فورية لطباعة A4 والحراري' : 'Direct ledger posting with A4 & thermal print'}</p>
                    </div>
                    <button className="px-3 py-1.5 rounded-lg bg-[#F45A0A] text-white font-bold text-xs">
                      {isAr ? '+ سند قبض جديد' : '+ New Receipt'}
                    </button>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 font-bold block">{isAr ? 'رقم السند' : 'Voucher No'}</span>
                        <span className="font-mono font-bold text-slate-900" dir="ltr">RV-2026-0914</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block">{isAr ? 'تاريخ المعاملة' : 'Date'}</span>
                        <span className="font-mono font-bold text-slate-900" dir="ltr">2026-09-02</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block">{isAr ? 'حساب العميل' : 'Customer Account'}</span>
                        <span className="font-bold text-slate-900">{isAr ? 'وكالة البسمة للسفر' : 'Basma Travel'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block">{isAr ? 'المبلغ المستلم' : 'Amount Received'}</span>
                        <span className="font-mono font-black text-[#059669] text-base" dir="ltr">$6,500.00</span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 size={16} />
                      <span>{isAr ? 'تم ترحيل السند وتحديث رصيد العميل ورصيد القاصة تلقائياً بنجاح.' : 'Voucher posted; client & cashbox balances synced instantly.'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TICKETS CONTENT */}
              {activeTab === 'tickets' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <h3 className="font-black text-lg text-slate-900">{isAr ? 'إصدار وحجز التذاكر' : 'Airline Ticketing Desk'}</h3>
                      <p className="text-xs text-slate-500">{isAr ? 'إدخال فوري لتذاكر الطيران مع حساب أرباح المقعد وسعر الشراء والبيع' : 'Live flight ticketing with automated seat margins'}</p>
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-600">GDS / NDC Integrated</span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="border border-slate-200 p-3 rounded-xl bg-slate-50/50">
                      <span className="text-[11px] text-slate-500 font-bold block">{isAr ? 'مسار الرحلة' : 'Route'}</span>
                      <span className="font-mono font-black text-base text-slate-900 block mt-1">BGW → DXB → KUL</span>
                      <span className="text-[11px] text-slate-500">{isAr ? 'الخطوط الجوية القطرية' : 'Qatar Airways'}</span>
                    </div>
                    <div className="border border-slate-200 p-3 rounded-xl bg-slate-50/50">
                      <span className="text-[11px] text-slate-500 font-bold block">{isAr ? 'كلفة الشراء / البيع' : 'Cost / Sale'}</span>
                      <div className="flex items-center gap-2 mt-1 font-mono">
                        <span className="text-xs text-slate-500" dir="ltr">Buy: $620</span>
                        <span className="font-bold text-slate-900" dir="ltr">Sale: $680</span>
                      </div>
                      <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">{isAr ? 'الربح' : 'Profit'}: +$60.00</span>
                    </div>
                    <div className="border border-slate-200 p-3 rounded-xl bg-slate-50/50">
                      <span className="text-[11px] text-slate-500 font-bold block">{isAr ? 'حالة الترحيل' : 'Status'}</span>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                        {isAr ? 'تم الترحيل والمطابقة' : 'POSTED & AUDITED'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: GROUPS CONTENT */}
              {activeTab === 'groups' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <h3 className="font-black text-lg text-slate-900">{isAr ? 'تصميم وإدارة الكروبات السياحية' : 'Custom Tour Groups Management'}</h3>
                      <p className="text-xs text-slate-500">{isAr ? 'قوالب الأسعار، تكاليف الطيران والفنادق، وتوزيع المقاعد على الركاب' : 'Pricing templates, component buy/sell, and passenger seat assignments'}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-orange-50 text-[#F45A0A] font-bold text-xs border border-orange-200">
                      {isAr ? 'كروب: BGW-TBS 2026' : 'Group: BGW-TBS 2026'}
                    </span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 font-bold block">{isAr ? 'عدد المقاعد' : 'Total Seats'}</span>
                        <span className="font-mono font-bold text-slate-900" dir="ltr">45 {isAr ? 'مقعد' : 'seats'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block">{isAr ? 'المقاعد المباعة' : 'Sold Seats'}</span>
                        <span className="font-mono font-bold text-emerald-700" dir="ltr">42 / 45</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block">{isAr ? 'كلفة المقعد' : 'Seat Cost'}</span>
                        <span className="font-mono font-bold text-slate-900" dir="ltr">$580.00</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block">{isAr ? 'صافي أرباح الكروب' : 'Net Tour Profit'}</span>
                        <span className="font-mono font-black text-[#059669] text-base" dir="ltr">+$6,720.00</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </section>

      {/* ── 5. CORE SOLUTIONS & FEATURES (6 CARDS) ── */}
      <section id="features" className="py-16 md:py-24 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-wider text-[#F45A0A] font-mono block mb-2">
              {isAr ? 'حلول صُممت خصيصاً لوكالات السفر' : 'Engineered Exclusively for Travel Agencies'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {isAr ? 'كل ما تحتاجه للتحكم المالي والإداري الكامل' : 'Complete Financial & Operational Control'}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 font-medium">
              {isAr
                ? 'استبدل الجداول المعقدة والبرامج البطيئة بمنظومة ذكية واحدة تتولى المحاسبة والحجوزات بدقة تامة.'
                : 'Replace fragmented spreadsheets with a unified system handling travel bookings and accounting in real time.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-[#F45A0A]/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText size={24} />
              </div>
              <h3 className="font-black text-lg text-slate-900 mb-2">
                {isAr ? 'محاسبة سياحية متخصصة' : 'Specialized Travel Accounting'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                {isAr
                  ? 'ترحيل القيود المحاسبية آلياً مع كل تذكرة وفيزا وفندق، مع شجرة حسابات متوافقة مع المتطلبات المالية العراقية والإقليمية.'
                  : 'Automatic journal entries with every ticket, visa, or hotel. Complete chart of accounts tailored for travel ERP.'}
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-[#F45A0A]/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plane size={24} />
              </div>
              <h3 className="font-black text-lg text-slate-900 mb-2">
                {isAr ? 'إدارة التذاكر والفيزا والفنادق' : 'Tickets, Visas & Hotels Desk'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                {isAr
                  ? 'إصدار واستيراد نصوص الحجز بسرعة، حساب عمولة الوكيل، وأرشفة إلكترونية فورية لكل معاملة مع المستندات المرفقة.'
                  : 'Fast reservation text import, automated agency commission tracking, and instant document attachments.'}
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-[#F45A0A]/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users size={24} />
              </div>
              <h3 className="font-black text-lg text-slate-900 mb-2">
                {isAr ? 'الكروبات والباقات السياحية' : 'Group Tours & Packages'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                {isAr
                  ? 'تصميم باقات الرحلات السياحية، قوالب الأسعار، احتساب تكاليف المقاعد والمصادر، وإدارة أسماء المسافرين والأرباح بدقة.'
                  : 'Design trip packages, manage seat allocations, calculate passenger costs, and audit net tour profits.'}
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-[#F45A0A]/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <QrCode size={24} />
              </div>
              <h3 className="font-black text-lg text-slate-900 mb-2">
                {isAr ? 'بوابة كشف الحساب التفاعلي (QR)' : 'Interactive QR Statement Portal'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                {isAr
                  ? 'شارك كشف حساب لحظي مع العملاء والشركات عبر رابط أو رمز QR بدون حاجة لتسجيل دخول، محدث دائماً بأحدث الحركات.'
                  : 'Share live, self-updating statement links or QR codes with customers without requiring logins.'}
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-[#F45A0A]/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Printer size={24} />
              </div>
              <h3 className="font-black text-lg text-slate-900 mb-2">
                {isAr ? 'طباعة حرارية و A4 احترافية' : 'Thermal & A4 Formats'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                {isAr
                  ? 'قوالب سندات وفواتير مخصصة بشعار شركتك، تدعم طابعات الباركود والطابعات الحرارية والـ A4 ومشاركة PDF عبر واتساب.'
                  : 'Custom branded vouchers and invoices for thermal receipts, A4 printers, and one-click WhatsApp PDF sharing.'}
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-[#F45A0A]/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheck size={24} />
              </div>
              <h3 className="font-black text-lg text-slate-900 mb-2">
                {isAr ? 'فروع متعددة وصناديق مستقلة' : 'Multi-Branch & Cash Desks'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                {isAr
                  ? 'إدارة فروع متعددة وصلاحيات موظفين محددة، مع قاصات وصناديق منفصلة ومطابقة يومية دقيقة لا تدع مجالاً للعجز المالي.'
                  : 'Manage multiple branches and cashier desks with granular employee roles and daily closing reconciliations.'}
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── 6. PRICING PLANS ── */}
      <section id="pricing" className="py-16 md:py-24 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-xs font-black uppercase tracking-wider text-[#F45A0A] font-mono block mb-2">
              {isAr ? 'باقات مرنة ومناسبة لكافة أحجام الشركات' : 'Flexible Transparent Plans'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {isAr ? 'استثمر في راحة بالك ونمو أرباحك' : 'Invest in Growth and Financial Peace of Mind'}
            </h2>
            <p className="mt-3 text-sm text-slate-600 font-medium">
              {isAr ? 'اختر الخطة المناسبة لشركتك مع تجربة مجانية ودعم فني مخصص على مدار الساعة.' : 'Choose the ideal plan for your agency with 24/7 dedicated support.'}
            </p>

            {/* Monthly / Yearly Switcher */}
            <div className="mt-6 inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPricingCycle('monthly')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  pricingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                {isAr ? 'اشتراك شهري' : 'Monthly'}
              </button>
              <button
                type="button"
                onClick={() => setPricingCycle('yearly')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  pricingCycle === 'yearly' ? 'bg-[#F45A0A] text-white shadow-2xs' : 'text-slate-600'
                }`}
              >
                <span>{isAr ? 'اشتراك سنوي' : 'Annual'}</span>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-mono font-bold">
                  {isAr ? 'خصم 20%' : 'Save 20%'}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            
            {/* Plan 1: Starter */}
            <div className="bg-[#F8FAFC] rounded-2xl p-7 border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <span className="font-bold text-slate-600 text-xs block mb-1">
                  {isAr ? 'المكاتب والشركات الناشئة' : 'Starter Agency'}
                </span>
                <h3 className="font-black text-2xl text-slate-900 mb-3">{isAr ? 'الباقة الأساسية' : 'Basic'}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="font-mono font-black text-3xl text-slate-900" dir="ltr">
                    {pricingCycle === 'monthly' ? '$39' : '$31'}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">{isAr ? '/ شهرياً' : '/ month'}</span>
                </div>
                <ul className="space-y-3 text-xs font-bold text-slate-700 mb-8">
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-[#059669]" />
                    <span>{isAr ? 'حتى 3 مستخدمين للنظام' : 'Up to 3 Users'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-[#059669]" />
                    <span>{isAr ? 'إدارة التذاكر وسندات القبض والصرف' : 'Tickets & Vouchers'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-[#059669]" />
                    <span>{isAr ? 'شجرة الحسابات وكشوفات الحساب' : 'Chart of Accounts & Statements'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-[#059669]" />
                    <span>{isAr ? 'طباعة حرارية و A4' : 'A4 & Thermal Printing'}</span>
                  </li>
                </ul>
              </div>
              <Link
                to="/login"
                className="w-full py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-bold text-xs text-slate-900 text-center transition-colors block"
              >
                {isAr ? 'ابدأ بالباقة الأساسية' : 'Choose Basic'}
              </Link>
            </div>

            {/* Plan 2: Pro (Featured) */}
            <div className="bg-white rounded-2xl p-7 border-2 border-[#F45A0A] shadow-xl relative flex flex-col justify-between">
              <div className="absolute -top-3.5 right-1/2 translate-x-1/2 bg-[#F45A0A] text-white text-[11px] font-black px-3.5 py-0.5 rounded-full uppercase tracking-wider">
                {isAr ? 'الأكثر طلباً للشركات' : 'Most Popular'}
              </div>
              <div>
                <span className="font-bold text-[#F45A0A] text-xs block mb-1">
                  {isAr ? 'للشركات المتوسطة والمتطورة' : 'Growing Travel Agencies'}
                </span>
                <h3 className="font-black text-2xl text-slate-900 mb-3">{isAr ? 'الباقة المتقدمة (Pro)' : 'Professional'}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="font-mono font-black text-4xl text-[#F45A0A]" dir="ltr">
                    {pricingCycle === 'monthly' ? '$79' : '$63'}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">{isAr ? '/ شهرياً' : '/ month'}</span>
                </div>
                <ul className="space-y-3 text-xs font-bold text-slate-700 mb-8">
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-[#059669]" />
                    <span>{isAr ? 'مستخدمين غير محدودين' : 'Unlimited Staff Users'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-[#059669]" />
                    <span>{isAr ? 'منظومة الكروبات والباقات السياحية' : 'Tour Groups & Packages Desk'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-[#059669]" />
                    <span>{isAr ? 'بوابة كشف الحساب التفاعلي عبر QR' : 'Interactive QR Statement Portal'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-[#059669]" />
                    <span>{isAr ? 'دعم الفروع المتعددة والقاصات المستقلة' : 'Multi-Branch & Cashbox Desks'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-[#059669]" />
                    <span>{isAr ? 'دعم فني مخصص ذو أولوية 24/7' : '24/7 Priority Support'}</span>
                  </li>
                </ul>
              </div>
              <Link
                to="/login"
                className="w-full py-3.5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] font-black text-xs text-white text-center shadow-md shadow-orange-500/25 transition-all block"
              >
                {isAr ? 'ابدأ التجربة المجانية للباقة المتقدمة' : 'Start Professional Trial'}
              </Link>
            </div>

            {/* Plan 3: Enterprise */}
            <div className="bg-[#F8FAFC] rounded-2xl p-7 border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <span className="font-bold text-slate-600 text-xs block mb-1">
                  {isAr ? 'للشركات الكبرى وسلاسل الفروع' : 'Large Agencies & Networks'}
                </span>
                <h3 className="font-black text-2xl text-slate-900 mb-3">{isAr ? 'باقة المؤسسات (Enterprise)' : 'Enterprise'}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="font-mono font-black text-3xl text-slate-900" dir="ltr">
                    {pricingCycle === 'monthly' ? '$149' : '$119'}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">{isAr ? '/ شهرياً' : '/ month'}</span>
                </div>
                <ul className="space-y-3 text-xs font-bold text-slate-700 mb-8">
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-[#059669]" />
                    <span>{isAr ? 'كل مميزات الباقة المتقدمة' : 'All Pro Features'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-[#059669]" />
                    <span>{isAr ? 'فروع وشبكات غير محدودة' : 'Unlimited Branches & Desks'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-[#059669]" />
                    <span>{isAr ? 'ربط API مباشر مع مزودي الخدمة' : 'Custom API Integrations'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-[#059669]" />
                    <span>{isAr ? 'نسخ احتياطي فوري وسيرفرات مخصصة' : 'Dedicated Cloud Backups'}</span>
                  </li>
                </ul>
              </div>
              <Link
                to="/login"
                className="w-full py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-bold text-xs text-slate-900 text-center transition-colors block"
              >
                {isAr ? 'تواصل مع فريق المبيعات' : 'Contact Enterprise Team'}
              </Link>
            </div>

          </div>

        </div>
      </section>

      {/* ── 7. FREQUENTLY ASKED QUESTIONS (FAQ) ── */}
      <section id="faq" className="py-16 md:py-24 bg-[#F8FAFC] border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-12">
            <span className="text-xs font-black uppercase tracking-wider text-[#F45A0A] font-mono block mb-2">
              {isAr ? 'إجابات واضحة لجميع استفساراتك' : 'Frequently Asked Questions'}
            </span>
            <h2 className="text-3xl font-black text-slate-900">
              {isAr ? 'الأسئلة الأكثر شيوعاً حول منظومة قيد' : 'Everything You Need to Know'}
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                qAr: 'هل يحتاج النظام إلى تثبيت أو أجهزة خاصة؟',
                qEn: 'Does the platform require local software installation?',
                aAr: 'كلا، قيد منظومة سحابية 100% تعمل على جميع المتصفحات والأجهزة (كمبيوتر، لابتوب، آيباد، وهواتف ذكية) دون الحاجة لشراء سيرفرات أو تثبيت برامج.',
                aEn: 'No, Qayd is 100% cloud-based and accessible from any browser, laptop, tablet, or phone without hardware servers.',
              },
              {
                qAr: 'هل يدعم النظام التعامل المزدوج بالدولار والدينار العراقي؟',
                qEn: 'Does it support multi-currency (USD & IQD) with floating rates?',
                aAr: 'نعم بكل تأكيد، النظام يدعم العملات المتعددة وفروقات أسعار الصرف بدقة محاسبية متناهية ويحدد الرصيد تلقائياً لكل عملة.',
                aEn: 'Yes, full multi-currency support with dynamic FX conversion rates and separate balances for USD and IQD.',
              },
              {
                qAr: 'كيف يستفيد العميل من بوابة كشف الحساب التفاعلي (QR)؟',
                qEn: 'How does the customer interactive QR statement portal work?',
                aAr: 'يستطيع أي عميل أو شركة مسح رمز QR الموجود على السند لفتح كشف حسابه المحدث لحظياً بدون الحاجة لتسجيل دخول، مما يقلل من مكالمات الاستفسار عن الأرصدة بنسبة 90%.',
                aEn: 'Clients simply scan the QR on receipts to view their real-time statement without credentials, drastically cutting support inquiries.',
              },
              {
                qAr: 'هل بيانات الشركة والحسابات آمنة ومشفرة؟',
                qEn: 'How secure is our financial and passenger data?',
                aAr: 'تُحفظ البيانات على بنية تحتية سحابية مشفرة بمعايير عالمية مع نسخ احتياطي تلقائي مستمر ونظام تدقيق يسجل هوية الموظف ووقت كل تعديل.',
                aEn: 'Enterprise cloud encryption, continuous automated backups, and complete user audit trails ensure maximum security.',
              },
            ].map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-start font-black text-sm sm:text-base text-slate-900 flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <span>{isAr ? faq.qAr : faq.qEn}</span>
                    <ChevronDown
                      size={18}
                      className={`text-slate-500 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#F45A0A]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium border-t border-slate-100">
                      {isAr ? faq.aAr : faq.aEn}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ── 8. BOTTOM CALL TO ACTION (BANNER) ── */}
      <section className="py-16 bg-gradient-to-br from-[#FFF3E8] via-white to-orange-50/60 border-t border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 rounded-3xl bg-[#F45A0A] text-white flex items-center justify-center mx-auto mb-6 shadow-xl shadow-orange-500/25">
            <Plane size={30} className="rotate-[-20deg]" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            {isAr ? 'جاهز لنقل وكالتك إلى المستوى التالي من الكفاءة؟' : 'Ready to Elevate Your Agency to Next-Level Efficiency?'}
          </h2>
          <p className="mt-4 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto font-medium">
            {isAr
              ? 'انضم اليوم إلى مئات الوكالات وشركات السفر الرائدة التي تدير أعمالها وحساباتها بكل ثقة عبر منظومة قيد.'
              : 'Join hundreds of leading travel agencies managing their day-to-day accounts and bookings with Qayd.'}
          </p>
          <div className="mt-8 flex items-center justify-center gap-3.5 flex-wrap">
            <Link
              to="/login"
              className="h-13 px-8 rounded-2xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>{isAr ? 'ابدأ الآن مجاناً' : 'Get Started for Free'}</span>
              {isAr ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
            </Link>
            <Link
              to="/login"
              className="h-13 px-6 rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-bold flex items-center justify-center"
            >
              {isAr ? 'تسجيل الدخول' : 'Sign In'}
            </Link>
          </div>
        </div>
      </section>

      {/* ── 9. FOOTER ── */}
      <footer className="bg-white border-t border-slate-200 py-12 text-slate-500 text-xs font-medium">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#F45A0A] text-white flex items-center justify-center font-black">
              Q
            </div>
            <div>
              <span className="font-bold text-slate-900 block">{isAr ? 'منظومة قيد للسياحة والسفر' : 'QAYD Travel & Accounting Platform'}</span>
              <span className="text-[11px] text-slate-400">© 2026 {isAr ? 'جميع الحقوق محفوظة' : 'All rights reserved.'}</span>
            </div>
          </div>

          <div className="flex items-center gap-6 font-bold text-slate-600">
            <Link to="/login" className="hover:text-[#F45A0A] transition-colors">{isAr ? 'تسجيل الدخول' : 'Sign In'}</Link>
            <a href="#features" className="hover:text-[#F45A0A] transition-colors">{isAr ? 'المميزات' : 'Features'}</a>
            <a href="#pricing" className="hover:text-[#F45A0A] transition-colors">{isAr ? 'الأسعار' : 'Pricing'}</a>
            <a href="#faq" className="hover:text-[#F45A0A] transition-colors">{isAr ? 'الأسئلة الشائعة' : 'FAQ'}</a>
          </div>
        </div>
      </footer>

    </div>
  );
};
