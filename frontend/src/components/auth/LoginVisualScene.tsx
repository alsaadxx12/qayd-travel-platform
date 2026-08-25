import React, { useState, useEffect, useRef } from 'react';
import { IraqBranchNetworkMap } from './maps/IraqBranchNetworkMap';
import { RefreshCw, CheckCircle2, ArrowRight, ArrowLeft, Wifi } from 'lucide-react';

interface LoginVisualSceneProps {
  isSuccess?: boolean;
  lang?: 'ar' | 'en';
  theme?: 'dark' | 'light';
}

/* ═══ Status bar messages ═══ */
const MSGS_AR = [
  { text: 'تتم الآن مزامنة قيود فرع النجف', branch: 'النجف', status: 'sync' as const },
  { text: 'اكتمل تحديث أرصدة فرع البصرة', branch: 'البصرة', status: 'done' as const },
  { text: 'تم استلام سندات فرع أربيل', branch: 'أربيل', status: 'done' as const },
  { text: 'ترحيل القيود اليومية — فرع كربلاء', branch: 'كربلاء', status: 'sync' as const },
  { text: 'مزامنة حجوزات فرع كركوك', branch: 'كركوك', status: 'sync' as const },
  { text: 'جميع الفروع متصلة بالنظام المركزي', branch: '', status: 'done' as const },
  { text: 'تم تحديث كشف حساب فرع الموصل', branch: 'الموصل', status: 'done' as const },
  { text: 'مطابقة ناجحة — فرع السليمانية', branch: 'السليمانية', status: 'done' as const },
];
const MSGS_EN = [
  { text: 'Syncing Najaf branch entries', branch: 'Najaf', status: 'sync' as const },
  { text: 'Basrah branch balances updated', branch: 'Basrah', status: 'done' as const },
  { text: 'Erbil branch vouchers received', branch: 'Erbil', status: 'done' as const },
  { text: 'Daily entries posted — Kerbala', branch: 'Kerbala', status: 'sync' as const },
  { text: 'Kirkuk branch bookings synced', branch: 'Kirkuk', status: 'sync' as const },
  { text: 'All branches connected to central', branch: '', status: 'done' as const },
  { text: 'Mosul branch statement updated', branch: 'Mosul', status: 'done' as const },
  { text: 'Reconciliation complete — Sulaymaniyah', branch: 'Sulaymaniyah', status: 'done' as const },
];

interface FocusInfo { name: string; nameAr: string; lines: string[]; yRatio: number; isManual?: boolean; govName?: string; }

/* ═══ Detailed branch data for manual click panel ═══ */
const BRANCH_DETAIL: Record<string, {
  descAr: string; descEn: string;
  entries: string; vouchers: string; balance: string; lastSync: string; statusAr: string; statusEn: string;
  govAr: string; govEn: string; nameAr: string; nameEn: string;
}> = {
  'Baghdad': {
    nameAr: 'بغداد', nameEn: 'Baghdad', govAr: 'بغداد', govEn: 'Baghdad',
    descAr: 'يدير نظام قيد حسابات المركز الرئيسي وقيوده وسنداته وأرصدته، مع مزامنة العمليات والتقارير مع جميع الفروع بصورة مباشرة وآمنة.',
    descEn: 'QAYD manages the headquarters accounts, entries, vouchers, and balances, syncing operations and reports with all branches directly and securely.',
    entries: '24', vouchers: '8', balance: 'IQD 340,000,000', lastSync: 'الآن', statusAr: 'متصل', statusEn: 'Connected',
  },
  'Kerbala': {
    nameAr: 'كربلاء', nameEn: 'Karbala', govAr: 'كربلاء', govEn: 'Kerbala',
    descAr: 'يدير نظام قيد حسابات فرع كربلاء وقيوده وسنداته وأرصدته، مع مزامنة العمليات والتقارير مع الإدارة الرئيسية بصورة مباشرة وآمنة.',
    descEn: 'QAYD manages Karbala branch accounts, entries, vouchers, and balances, syncing operations with HQ directly and securely.',
    entries: '12', vouchers: '4', balance: 'IQD 45,200,000', lastSync: 'الآن', statusAr: 'متصل', statusEn: 'Connected',
  },
  'Al-Najaf': {
    nameAr: 'النجف', nameEn: 'Najaf', govAr: 'النجف', govEn: 'Al-Najaf',
    descAr: 'يدير نظام قيد حسابات فرع النجف وقيوده وسنداته وأرصدته، مع مزامنة العمليات والتقارير مع الإدارة الرئيسية بصورة مباشرة وآمنة.',
    descEn: 'QAYD manages Najaf branch accounts, entries, vouchers, and balances, syncing operations with HQ directly and securely.',
    entries: '6', vouchers: '6', balance: 'IQD 125,000,000', lastSync: 'الآن', statusAr: 'متصل', statusEn: 'Connected',
  },
  'Al-Basrah': {
    nameAr: 'البصرة', nameEn: 'Basra', govAr: 'البصرة', govEn: 'Al-Basrah',
    descAr: 'يدير نظام قيد حسابات فرع البصرة وقيوده وسنداته وأرصدته، مع مزامنة العمليات والتقارير مع الإدارة الرئيسية بصورة مباشرة وآمنة.',
    descEn: 'QAYD manages Basra branch accounts, entries, vouchers, and balances, syncing operations with HQ directly and securely.',
    entries: '9', vouchers: '3', balance: 'IQD 89,500,000', lastSync: 'الآن', statusAr: 'متصل', statusEn: 'Connected',
  },
  'Kirkuk': {
    nameAr: 'كركوك', nameEn: 'Kirkuk', govAr: 'كركوك', govEn: 'Kirkuk',
    descAr: 'يدير نظام قيد حسابات فرع كركوك وقيوده وسنداته وأرصدته، مع مزامنة العمليات والتقارير مع الإدارة الرئيسية بصورة مباشرة وآمنة.',
    descEn: 'QAYD manages Kirkuk branch accounts, entries, vouchers, and balances, syncing operations with HQ directly and securely.',
    entries: '6', vouchers: '6', balance: 'IQD 22,800,000', lastSync: 'الآن', statusAr: 'متصل', statusEn: 'Connected',
  },
  'Erbil': {
    nameAr: 'أربيل', nameEn: 'Erbil', govAr: 'أربيل', govEn: 'Erbil',
    descAr: 'يدير نظام قيد حسابات فرع أربيل وقيوده وسنداته وأرصدته، مع مزامنة العمليات والتقارير مع الإدارة الرئيسية بصورة مباشرة وآمنة.',
    descEn: 'QAYD manages Erbil branch accounts, entries, vouchers, and balances, syncing operations with HQ directly and securely.',
    entries: '18', vouchers: '5', balance: 'IQD 67,400,000', lastSync: 'الآن', statusAr: 'متصل', statusEn: 'Connected',
  },
  'Ninewa': {
    nameAr: 'الموصل', nameEn: 'Mosul', govAr: 'نينوى', govEn: 'Ninewa',
    descAr: 'يدير نظام قيد حسابات فرع الموصل وقيوده وسنداته وأرصدته، مع مزامنة العمليات والتقارير مع الإدارة الرئيسية بصورة مباشرة وآمنة.',
    descEn: 'QAYD manages Mosul branch accounts, entries, vouchers, and balances, syncing operations with HQ directly and securely.',
    entries: '9', vouchers: '2', balance: 'IQD 31,600,000', lastSync: 'الآن', statusAr: 'متصل', statusEn: 'Connected',
  },
  'Al-Sulaymaniyah': {
    nameAr: 'السليمانية', nameEn: 'Sulaymaniyah', govAr: 'السليمانية', govEn: 'Al-Sulaymaniyah',
    descAr: 'يدير نظام قيد حسابات فرع السليمانية وقيوده وسنداته وأرصدته، مع مزامنة العمليات والتقارير مع الإدارة الرئيسية بصورة مباشرة وآمنة.',
    descEn: 'QAYD manages Sulaymaniyah branch accounts, entries, vouchers, and balances, syncing operations with HQ directly and securely.',
    entries: '15', vouchers: '5', balance: 'IQD 28,100,000', lastSync: 'الآن', statusAr: 'متصل', statusEn: 'Connected',
  },
};

export const LoginVisualScene: React.FC<LoginVisualSceneProps> = ({ isSuccess = false, lang = 'ar', theme = 'dark' }) => {
  const isAr = lang === 'ar';
  const isDark = theme === 'dark';
  const msgs = isAr ? MSGS_AR : MSGS_EN;
  const [msgIdx, setMsgIdx] = useState(0);
  const [msgVisible, setMsgVisible] = useState(true);

  // Auto-sequencer panel
  const [panelData, setPanelData] = useState<FocusInfo | null>(null);
  const [contentVisible, setContentVisible] = useState(false);
  const panelRef = useRef<FocusInfo | null>(null);

  // Manual selection
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [manualPanelVisible, setManualPanelVisible] = useState(false);

  // Rotate ticker
  useEffect(() => {
    const iv = setInterval(() => {
      setMsgVisible(false);
      setTimeout(() => { setMsgIdx(i => (i + 1) % msgs.length); setMsgVisible(true); }, 300);
    }, 4000);
    return () => clearInterval(iv);
  }, [msgs.length]);

  const handleFocusChange = (info: FocusInfo | null) => {
    if (selectedBranch) return;
    if (info) {
      if (panelRef.current && panelRef.current.name !== info.name) {
        setContentVisible(false);
        setTimeout(() => {
          panelRef.current = info;
          setPanelData(info);
          setContentVisible(true);
        }, 200);
      } else {
        panelRef.current = info;
        setPanelData(info);
        setContentVisible(true);
      }
    } else {
      setContentVisible(false);
      setTimeout(() => {
        panelRef.current = null;
        setPanelData(null);
      }, 300);
    }
  };

  const handleBranchClick = (govName: string | null) => {
    if (govName && BRANCH_DETAIL[govName]) {
      setSelectedBranch(govName);
      setPanelData(null);
      setContentVisible(false);
      setTimeout(() => setManualPanelVisible(true), 50);
    } else {
      setManualPanelVisible(false);
      setTimeout(() => setSelectedBranch(null), 300);
    }
  };

  const panelSide = isAr ? 'left' : 'right';
  const currentMsg = msgs[msgIdx];
  const branchDetail = selectedBranch ? BRANCH_DETAIL[selectedBranch] : null;
  const BackArrow = isAr ? ArrowLeft : ArrowRight;

  return (
    <div className="relative w-full h-full overflow-hidden select-none" style={{
      background: isDark
        ? 'radial-gradient(ellipse at 55% 45%, rgba(10,30,58,0.7) 0%, #071426 60%, #050e1c 100%)'
        : '#F5F8F7',
      transition: 'background 0.5s ease',
    }}>
      {/* Subtle dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        opacity: isDark ? 0.03 : 0.04,
        backgroundImage: `radial-gradient(circle, ${isDark ? '#F45A0A' : '#ea580c'} 1px, transparent 1px)`,
        backgroundSize: '30px 30px',
      }} />
      {isDark && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 55% 48%, rgba(244,90,10,0.05) 0%, transparent 55%)',
        }} />
      )}

      {/* Map */}
      <div className="absolute inset-0 z-10">
        <IraqBranchNetworkMap
          isSuccess={isSuccess} lang={lang} theme={theme}
          onFocusChange={handleFocusChange}
          selectedBranch={selectedBranch}
          onBranchClick={handleBranchClick}
        />
      </div>

      {/* ═══ AUTO PANEL — when no manual selection ═══ */}
      {panelData && !selectedBranch && (
      <div style={{
        position: 'absolute',
        [panelSide]: '28px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '285px',
        zIndex: 20,
        pointerEvents: 'none',
      }}>
        <div style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(12,30,48,0.95) 0%, rgba(8,24,42,0.92) 100%)'
            : '#FFFFFF',
          border: isDark ? '1px solid rgba(244,90,10,0.18)' : '1px solid #D8E3E0',
          borderRadius: '14px',
          padding: '24px 22px 20px',
          boxShadow: isDark
            ? '0 4px 24px rgba(0,0,0,0.4), 0 0 40px rgba(244,90,10,0.05), inset 0 1px 0 rgba(255,255,255,0.03)'
            : '0 2px 8px rgba(0,0,0,0.06)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
          opacity: contentVisible ? 1 : 0,
          transform: contentVisible ? 'translateY(0)' : 'translateY(-22px)',
        }}>
            {/* Branch name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: '#F45A0A', flexShrink: 0,
                boxShadow: '0 0 8px rgba(244,90,10,0.6)',
              }} />
              <span style={{
                fontSize: '18px', fontWeight: 800,
                color: isDark ? '#fdba74' : '#082032',
                fontFamily: isAr ? "'Noto Kufi Arabic',sans-serif" : "'Inter',sans-serif",
              }}>
                {isAr ? `فرع ${panelData.nameAr}` : `${panelData.name} Branch`}
              </span>
            </div>

            {/* Status line */}
            <div style={{
              fontSize: '13.5px', fontWeight: 600,
              color: isDark ? '#e2e8f0' : '#0F172A',
              fontFamily: isAr ? "'IBM Plex Sans Arabic',sans-serif" : "'Inter',sans-serif",
              marginBottom: '12px',
            }}>
              {panelData.lines[0]}
            </div>

            {/* Detail lines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {panelData.lines.slice(1).map((line, i) => (
                <div key={i} style={{
                  fontSize: '12.5px', fontWeight: 500,
                  color: isDark ? '#94a3b8' : '#0F172A',
                  fontFamily: /^[A-Z\d]/.test(line) || /^IQD|^USD/.test(line)
                    ? "'Inter',sans-serif"
                    : (isAr ? "'IBM Plex Sans Arabic',sans-serif" : "'Inter',sans-serif"),
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.6,
                  paddingInlineStart: '16px',
                  position: 'relative' as const,
                }}>
                  <span style={{
                    position: 'absolute', [isAr ? 'right' : 'left']: '0',
                    color: isDark ? '#334155' : '#94a3b8',
                  }}>·</span>
                  {line}
                </div>
              ))}
            </div>

            {/* Sync footer */}
            <div style={{
              marginTop: '14px', paddingTop: '10px',
              borderTop: isDark ? '1px solid rgba(51,65,85,0.3)' : '1px solid #D8E3E0',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <RefreshCw size={11} style={{ color: '#F45A0A', opacity: 0.8 }} />
              <span style={{
                fontSize: '11px', fontWeight: 500,
                color: isDark ? '#475569' : '#64748B',
                fontFamily: "'Inter',sans-serif",
              }}>
                {isAr ? 'تمت المزامنة' : 'Synced'}
              </span>
            </div>
        </div>
      </div>
      )}

      {/* ═══ MANUAL BRANCH DETAIL PANEL ═══ */}
      {selectedBranch && branchDetail && (
        <div style={{
          position: 'absolute',
          [panelSide]: '0',
          top: 0, bottom: 0,
          width: '340px',
          zIndex: 30,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '24px',
          opacity: manualPanelVisible ? 1 : 0,
          transform: manualPanelVisible
            ? 'translateX(0)'
            : (isAr ? 'translateX(-30px)' : 'translateX(30px)'),
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}>
          <div style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(10,28,48,0.96) 0%, rgba(7,20,38,0.94) 100%)'
              : '#FFFFFF',
            border: isDark ? '1px solid rgba(244,90,10,0.2)' : '1px solid #D8E3E0',
            borderRadius: '16px',
            padding: '28px 24px 24px',
            boxShadow: isDark
              ? '0 8px 32px rgba(0,0,0,0.5), 0 0 60px rgba(244,90,10,0.06), inset 0 1px 0 rgba(255,255,255,0.04)'
              : '0 4px 16px rgba(0,0,0,0.08)',
          }}>
            {/* Back button */}
            <button
              onClick={() => handleBranchClick(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: isDark ? '#94a3b8' : '#64748B',
                fontSize: '12px', fontWeight: 600, padding: '0 0 16px',
                fontFamily: isAr ? "'IBM Plex Sans Arabic',sans-serif" : "'Inter',sans-serif",
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = isDark ? '#e2e8f0' : '#0F172A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#94a3b8' : '#64748B')}
            >
              {!isAr && <ArrowLeft size={14} />}
              {isAr ? 'العودة إلى الخريطة الكاملة' : 'Back to full map'}
              {isAr && <ArrowRight size={14} />}
            </button>

            {/* Branch name + province */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', background: '#F45A0A', flexShrink: 0,
                  boxShadow: '0 0 8px rgba(244,90,10,0.6)',
                }} />
                <span style={{
                  fontSize: '20px', fontWeight: 800,
                  color: isDark ? '#f1f5f9' : '#082032',
                  fontFamily: isAr ? "'Noto Kufi Arabic',sans-serif" : "'Inter',sans-serif",
                }}>
                  {isAr ? `فرع ${branchDetail.nameAr}` : `${branchDetail.nameEn} Branch`}
                </span>
              </div>
              <div style={{
                fontSize: '13px', fontWeight: 500,
                color: isDark ? '#64748b' : '#94a3b8',
                fontFamily: isAr ? "'IBM Plex Sans Arabic',sans-serif" : "'Inter',sans-serif",
                paddingInlineStart: '20px',
              }}>
                {isAr ? `محافظة ${branchDetail.govAr}` : `${branchDetail.govEn} Governorate`}
              </div>
            </div>

            {/* Connection status */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
              background: isDark ? 'rgba(244,90,10,0.08)' : 'rgba(244,90,10,0.06)',
              border: isDark ? '1px solid rgba(244,90,10,0.2)' : '1px solid rgba(244,90,10,0.2)',
            }}>
              <Wifi size={14} style={{ color: '#F45A0A' }} />
              <span style={{
                fontSize: '13px', fontWeight: 600,
                color: isDark ? '#fdba74' : '#ea580c',
                fontFamily: isAr ? "'IBM Plex Sans Arabic',sans-serif" : "'Inter',sans-serif",
              }}>
                {isAr ? 'متصل بالنظام المركزي' : 'Connected to central system'}
              </span>
            </div>

            {/* Description */}
            <p style={{
              fontSize: '12.5px', fontWeight: 400, lineHeight: 1.7, marginBottom: '18px',
              color: isDark ? '#94a3b8' : '#64748B',
              fontFamily: isAr ? "'IBM Plex Sans Arabic',sans-serif" : "'Inter',sans-serif",
            }}>
              {isAr ? branchDetail.descAr : branchDetail.descEn}
            </p>

            {/* Stats grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px',
            }}>
              {[
                { labelAr: 'القيود اليومية', labelEn: 'Daily Entries', value: branchDetail.entries, icon: '≡' },
                { labelAr: 'السندات المالية', labelEn: 'Vouchers', value: branchDetail.vouchers, icon: '◈' },
              ].map((stat, i) => (
                <div key={i} style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: isDark ? 'rgba(15,23,42,0.4)' : 'rgba(248,250,252,1)',
                  border: isDark ? '1px solid rgba(51,65,85,0.2)' : '1px solid #e2e8f0',
                }}>
                  <div style={{
                    fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
                    color: isDark ? '#475569' : '#94a3b8',
                    fontFamily: isAr ? "'IBM Plex Sans Arabic',sans-serif" : "'Inter',sans-serif",
                    marginBottom: '4px',
                  }}>
                    {stat.icon} {isAr ? stat.labelAr : stat.labelEn}
                  </div>
                  <div style={{
                    fontSize: '22px', fontWeight: 800,
                    color: isDark ? '#e2e8f0' : '#0F172A',
                    fontFamily: "'Inter',sans-serif",
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Balance row */}
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: isDark ? 'rgba(244,90,10,0.06)' : 'rgba(244,90,10,0.04)',
              border: isDark ? '1px solid rgba(244,90,10,0.15)' : '1px solid rgba(244,90,10,0.15)',
              marginBottom: '12px',
            }}>
              <div style={{
                fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
                color: isDark ? '#475569' : '#94a3b8',
                fontFamily: isAr ? "'IBM Plex Sans Arabic',sans-serif" : "'Inter',sans-serif",
                marginBottom: '4px',
              }}>
                {isAr ? 'رصيد الفرع' : 'Branch Balance'}
              </div>
              <div style={{
                fontSize: '18px', fontWeight: 800,
                color: isDark ? '#fdba74' : '#ea580c',
                fontFamily: "'Inter',sans-serif",
                fontVariantNumeric: 'tabular-nums',
              }}>
                {branchDetail.balance}
              </div>
            </div>

            {/* Last sync + status */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              paddingTop: '12px',
              borderTop: isDark ? '1px solid rgba(51,65,85,0.25)' : '1px solid #e2e8f0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={12} style={{ color: '#F45A0A', opacity: 0.8 }} />
                <span style={{
                  fontSize: '11px', fontWeight: 500,
                  color: isDark ? '#475569' : '#94a3b8',
                  fontFamily: "'Inter',sans-serif",
                }}>
                  {isAr ? 'آخر مزامنة: الآن' : 'Last sync: now'}
                </span>
              </div>
              <div style={{
                fontSize: '11px', fontWeight: 600,
                color: '#F45A0A',
                fontFamily: "'Inter',sans-serif",
              }}>
                {isAr ? branchDetail.statusAr : branchDetail.statusEn}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STATUS BAR ═══ */}
      <div style={{
        position: 'absolute',
        left: 0, right: 0, bottom: 0,
        height: '40px',
        zIndex: 25,
        background: isDark
          ? 'linear-gradient(to right, rgba(7,20,38,0.95), rgba(11,29,45,0.92), rgba(7,20,38,0.95))'
          : '#FFFFFF',
        borderTop: isDark ? '1px solid rgba(244,90,10,0.15)' : '1px solid #D8E3E0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: '10px',
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: currentMsg.status === 'sync' ? '#ea580c' : '#F45A0A',
          boxShadow: `0 0 8px ${currentMsg.status === 'sync' ? 'rgba(234,88,12,0.5)' : 'rgba(244,90,10,0.6)'}`,
          transition: 'background 0.3s, box-shadow 0.3s',
        }} />
        {currentMsg.status === 'sync' ? (
          <RefreshCw size={12} style={{
            color: isDark ? '#fb923c' : '#ea580c', flexShrink: 0,
            opacity: 0.8,
            animation: 'spin 2s linear infinite',
          }} />
        ) : (
          <CheckCircle2 size={12} style={{
            color: isDark ? '#fdba74' : '#F45A0A', flexShrink: 0,
            opacity: 0.9,
          }} />
        )}
        <span style={{
          fontSize: '13px', fontWeight: 600, letterSpacing: '0.01em',
          color: isDark ? '#94a3b8' : '#0F172A',
          fontFamily: isAr ? "'IBM Plex Sans Arabic',sans-serif" : "'Inter',sans-serif",
          whiteSpace: 'nowrap',
          opacity: msgVisible ? 1 : 0,
          transform: msgVisible ? 'translateY(0)' : 'translateY(4px)',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          flex: 1,
        }}>
          {currentMsg.text}
        </span>
        {currentMsg.status === 'sync' && (
          <div style={{
            width: '60px', height: '3px', borderRadius: '2px', flexShrink: 0,
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '40%', height: '100%', borderRadius: '2px',
              background: isDark
                ? 'linear-gradient(to right, #ea580c, #F45A0A)'
                : 'linear-gradient(to right, #ea580c, #F45A0A)',
              animation: 'progressSlide 1.5s ease-in-out infinite',
            }} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes progressSlide { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
      `}</style>
    </div>
  );
};
