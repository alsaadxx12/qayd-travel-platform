import React, { useEffect, useState, useRef } from 'react';
import { X, Download, MonitorSmartphone, CheckCircle2 } from 'lucide-react';
import { useLanguageStore } from '../../store/useLanguageStore';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * PWAInstallPrompt — Shows a bottom-right toast-style install banner
 * when the browser fires the `beforeinstallprompt` event.
 * Dismissed state is persisted in localStorage so it doesn't nag.
 */
export const PWAInstallPrompt: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  // Don't show if already dismissed this session or previously
  const dismissed = useRef(
    typeof window !== 'undefined' && localStorage.getItem('qayd_pwa_dismissed') === '1'
  );

  useEffect(() => {
    // If already installed as PWA, do nothing
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (dismissed.current) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Small delay so the page has settled before showing the prompt
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setInstalling(false);
    if (outcome === 'accepted') {
      setInstalled(true);
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('qayd_pwa_dismissed', '1');
  };

  if (!showBanner) return null;

  return (
    <div
      dir={direction}
      className="fixed bottom-5 right-5 z-[99999] w-[340px] animate-in slide-in-from-bottom-4 fade-in duration-500"
      style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
    >
      {/* Card */}
      <div className="relative bg-white/97 backdrop-blur-2xl border border-slate-200/90 rounded-[22px] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.05),0_8px_20px_-4px_rgba(244,90,10,0.10)] overflow-hidden">
        {/* Decorative gradient bar at top */}
        <div className="h-0.5 w-full bg-gradient-to-r from-[#F45A0A] via-orange-400 to-amber-300" />

        <div className="p-4">
          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-3 left-3 w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={15} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200/80 flex items-center justify-center shadow-2xs shrink-0">
              <MonitorSmartphone size={20} className="text-[#F45A0A]" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 leading-tight">
                {isAr ? 'تثبيت تطبيق قيد' : 'Install QAYD App'}
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                {isAr ? 'اعمل بدون انترنت وبشكل أسرع' : 'Work offline & faster'}
              </p>
            </div>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {[
              { ar: '⚡ أسرع استجابة', en: '⚡ Faster' },
              { ar: '📌 وصول سريع', en: '📌 Quick access' },
              { ar: '🔔 إشعارات فورية', en: '🔔 Notifications' },
            ].map((f) => (
              <span
                key={f.en}
                className="px-2 py-0.5 bg-slate-100/80 text-slate-600 text-[10.5px] font-bold rounded-lg border border-slate-200/60"
              >
                {isAr ? f.ar : f.en}
              </span>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstall}
              disabled={installing || installed}
              className={`flex-1 h-9 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md ${
                installed
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-gradient-to-r from-[#F45A0A] to-[#DD4F05] hover:from-[#FF6519] hover:to-[#E54800] text-white shadow-orange-500/25'
              }`}
            >
              {installed ? (
                <>
                  <CheckCircle2 size={15} />
                  <span>{isAr ? 'تم التثبيت بنجاح!' : 'Installed!'}</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>{installing ? (isAr ? 'جاري التثبيت...' : 'Installing...') : (isAr ? 'تثبيت التطبيق الآن' : 'Install Now')}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="h-9 px-3 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 font-bold text-xs transition-all cursor-pointer border border-slate-200"
            >
              {isAr ? 'لاحقاً' : 'Later'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
