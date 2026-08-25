import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, DollarSign, Activity, Network, ShieldCheck } from 'lucide-react';

interface FlightRouteAnimationProps {
  isSuccess?: boolean;
}

export const FlightRouteAnimation: React.FC<FlightRouteAnimationProps> = ({ isSuccess = false }) => {
  const [tabActive, setTabActive] = useState(true);
  const [tickerIndex, setTickerIndex] = useState(0);

  // Rotating 3-item financial ticker items for Iraqi branches
  const tickerItems = [
    { label: 'فرع بغداد — المركز الرئيسي (متصل)', sub: 'إدارة القيود والعمليات المجمعة', icon: Building2, color: 'text-emerald-400' },
    { label: 'فرع البصرة — مزامنة السندات', sub: 'ترحيل سندات المقبوضات والأرصدة', icon: CheckCircle2, color: 'text-teal-400' },
    { label: 'فرع أربيل وكربلاء — القيد الموحد', sub: 'مطابقة الحسابات وتأكيد الحركة', icon: DollarSign, color: 'text-emerald-300' },
  ];

  // Tab active listener to pause animation & save CPU
  useEffect(() => {
    const handleVisibilityChange = () => {
      setTabActive(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Ticker Rotation Timer
  useEffect(() => {
    if (!tabActive) return;
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % tickerItems.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [tabActive, tickerItems.length]);

  const CurrentTickerIcon = tickerItems[tickerIndex].icon;

  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center select-none dir-ltr ${!tabActive ? 'opacity-85' : ''}`}>
      <style>{`
        @keyframes stroke-dash-flow {
          0% { stroke-dashoffset: 240; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1.3); opacity: 0.3; }
          100% { transform: scale(0.9); opacity: 0.8; }
        }
        @keyframes float-pulse {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.03); }
        }
        @media (prefers-reduced-motion: reduce) {
          .anim-network-element { animation: none !important; }
        }
      `}</style>

      {/* AMBIENT RADIAL LIGHTING BEHIND IRAQ MAP */}
      <div
        className="absolute w-[520px] h-[520px] bg-emerald-500/15 rounded-full blur-[100px] pointer-events-none anim-network-element"
        style={{ animation: tabActive ? 'float-pulse 8s ease-in-out infinite' : 'none' }}
      />

      {/* PROMINENT CENTRAL IRAQ MAP & BRANCHES NETWORK SVG CANVAS */}
      <div className="relative w-full max-w-[640px] aspect-[4/3] flex items-center justify-center">
        <svg className="w-full h-full text-emerald-500/20 overflow-visible" viewBox="0 0 800 600" fill="none">
          <defs>
            <linearGradient id="baghdad-hub-glow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.3" />
            </linearGradient>

            <linearGradient id="route-basra" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.4" />
            </linearGradient>

            <linearGradient id="route-erbil" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* Minimalist Stylized Map Silhouette Lines of Iraq */}
          <path
            d="M 280 90 L 420 80 L 520 120 L 580 180 L 590 280 L 560 380 L 580 470 L 520 510 L 400 480 L 320 420 L 220 380 L 160 300 L 180 200 Z"
            fill="rgba(5, 150, 105, 0.04)"
            stroke="rgba(5, 150, 105, 0.25)"
            strokeWidth="2"
            strokeDasharray="6 4"
          />

          {/* Inner Grid Topography Guides */}
          <ellipse cx="400" cy="270" rx="220" ry="160" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
          <ellipse cx="400" cy="270" rx="140" ry="90" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />

          {/* FINANCIAL DATA NETWORK ROUTES (Radiating from Baghdad (400, 270)) */}

          {/* Route 1: Baghdad -> Basra (540, 450) */}
          <path
            d="M 400 270 Q 480 370 540 450"
            stroke="url(#route-basra)"
            strokeWidth="3"
            strokeDasharray="8 6"
            className="anim-network-element"
            style={{ animation: tabActive ? 'stroke-dash-flow 10s linear infinite' : 'none' }}
          />

          {/* Route 2: Baghdad -> Erbil (430, 110) */}
          <path
            d="M 400 270 Q 410 180 430 110"
            stroke="url(#route-erbil)"
            strokeWidth="3"
            strokeDasharray="8 6"
            className="anim-network-element"
            style={{ animation: tabActive ? 'stroke-dash-flow 8s linear infinite' : 'none' }}
          />

          {/* Route 3: Baghdad -> Karbala (360, 310) */}
          <path
            d="M 400 270 L 360 310"
            stroke="rgba(16, 185, 129, 0.6)"
            strokeWidth="2.5"
            strokeDasharray="6 4"
          />

          {/* Route 4: Baghdad -> Najaf (350, 360) */}
          <path
            d="M 400 270 Q 370 320 350 360"
            stroke="rgba(16, 185, 129, 0.5)"
            strokeWidth="2"
            strokeDasharray="5 4"
          />

          {/* Route 5: Baghdad -> Mosul (320, 120) */}
          <path
            d="M 400 270 Q 350 180 320 120"
            stroke="rgba(5, 150, 105, 0.5)"
            strokeWidth="2.5"
            strokeDasharray="6 4"
          />

          {/* Route 6: Baghdad -> Sulaymaniyah (510, 140) */}
          <path
            d="M 400 270 Q 470 190 510 140"
            stroke="rgba(2, 132, 199, 0.5)"
            strokeWidth="2"
            strokeDasharray="5 4"
          />

          {/* Route 7: Baghdad -> Kirkuk (420, 180) */}
          <path
            d="M 400 270 L 420 180"
            stroke="rgba(16, 185, 129, 0.4)"
            strokeWidth="2"
            strokeDasharray="4 4"
          />

          {/* BRANCH CITY NODES */}

          {/* CENTRAL HUB: BAGHDAD (400, 270) */}
          <g transform="translate(400, 270)">
            <circle r="22" fill="rgba(5, 150, 105, 0.2)" className={tabActive ? 'anim-network-element' : ''} style={{ animation: tabActive ? 'pulse-ring 3s ease-in-out infinite' : 'none' }} />
            <circle r="12" fill="rgba(5, 150, 105, 0.4)" />
            <circle r="7" fill="#059669" />
            <circle r="3" fill="#ffffff" />
            <text x="18" y="4" fill="#f8fafc" fontSize="13" fontWeight="900" fontFamily="sans-serif">بغداد (المركز الرئيسي)</text>
          </g>

          {/* BASRA NODE (540, 450) */}
          <g transform="translate(540, 450)">
            <circle r="10" fill="rgba(2, 132, 199, 0.25)" className={tabActive ? 'animate-pulse' : ''} />
            <circle r="5" fill="#38bdf8" />
            <text x="12" y="4" fill="#cbd5e1" fontSize="11" fontWeight="bold">فرع البصرة</text>
          </g>

          {/* ERBIL NODE (430, 110) */}
          <g transform="translate(430, 110)">
            <circle r="10" fill="rgba(52, 211, 153, 0.25)" className={tabActive ? 'animate-pulse' : ''} />
            <circle r="5" fill="#34d399" />
            <text x="12" y="4" fill="#cbd5e1" fontSize="11" fontWeight="bold">فرع أربيل</text>
          </g>

          {/* KARBALA NODE (360, 310) */}
          <g transform="translate(360, 310)">
            <circle r="6" fill="#10b981" />
            <text x="-85" y="4" fill="#cbd5e1" fontSize="11" fontWeight="bold">كربلاء المقدسة</text>
          </g>

          {/* NAJAF NODE (350, 360) */}
          <g transform="translate(350, 360)">
            <circle r="5" fill="#14b8a6" />
            <text x="-70" y="4" fill="#94a3b8" fontSize="10" fontWeight="bold">النجف الأشرف</text>
          </g>

          {/* MOSUL NODE (320, 120) */}
          <g transform="translate(320, 120)">
            <circle r="5" fill="#f59e0b" />
            <text x="-60" y="4" fill="#94a3b8" fontSize="10" fontWeight="bold">الموصل</text>
          </g>

          {/* SULAYMANIYAH NODE (510, 140) */}
          <g transform="translate(510, 140)">
            <circle r="5" fill="#38bdf8" />
            <text x="12" y="4" fill="#94a3b8" fontSize="10" fontWeight="bold">السليمانية</text>
          </g>

          {/* KIRKUK NODE (420, 180) */}
          <g transform="translate(420, 180)">
            <circle r="4" fill="#34d399" />
            <text x="10" y="-8" fill="#64748b" fontSize="9" fontWeight="bold">كركوك</text>
          </g>

          {/* MOVING DATA PULSE DOTS ON ROUTES */}
          <circle cx="450" cy="350" r="3" fill="#10b981" className="animate-ping" />
          <circle cx="415" cy="190" r="3" fill="#34d399" className="animate-ping" />
        </svg>
      </div>

      {/* SINGLE STRUCTURED ROTATING FINANCIAL TICKER BAR */}
      <div className="mt-2 px-5 py-2.5 bg-slate-900/90 backdrop-blur-md border border-emerald-500/30 rounded-2xl shadow-xl flex items-center gap-3 dir-rtl max-w-sm transition-all duration-300">
        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
          <CurrentTickerIcon size={18} />
        </div>
        <div className="space-y-0.5 overflow-hidden">
          <span className={`text-xs font-black block transition-all ${tickerItems[tickerIndex].color}`}>
            {tickerItems[tickerIndex].label}
          </span>
          <span className="text-[10px] text-slate-400 font-medium block truncate">
            {tickerItems[tickerIndex].sub}
          </span>
        </div>
        <div className="mr-auto flex items-center gap-1 shrink-0">
          <Activity size={12} className="text-emerald-400 animate-pulse" />
          <span className="text-[9px] font-mono text-emerald-400 font-bold">مزامنة</span>
        </div>
      </div>
    </div>
  );
};
