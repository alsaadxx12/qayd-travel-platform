import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { IRAQ_ADM0_GEOJSON } from '../../../assets/maps/iraqAdm0Data';
import { IRAQ_ADM1_GEOJSON } from '../../../assets/maps/iraqAdm1Data';
import { IRAQ_BRANCH_CITIES } from '../../../config/iraqBranchLocations';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface Props {
  isSuccess?: boolean;
  lang?: 'ar' | 'en';
  theme?: 'dark' | 'light';
  selectedBranch?: string | null;
  onBranchClick?: (govName: string | null) => void;
  onFocusChange?: (info: {
    name: string; nameAr: string; lines: string[]; yRatio: number;
    isManual?: boolean; govName?: string;
  } | null) => void;
}

type Phase = 'boot' | 'idle' | 'sending' | 'receiving' | 'displaying' | 'transit';
type OpType = 'entry' | 'voucher' | 'balance' | 'report';

/* ═══════════════════════════════════════════════════════════════
   Geometry Helpers
   ═══════════════════════════════════════════════════════════════ */

function createProjection(geojson: any, w: number, h: number, pad: number) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  function walk(c: any) {
    if (typeof c[0] === 'number') {
      minLon = Math.min(minLon, c[0]);
      maxLon = Math.max(maxLon, c[0]);
      minLat = Math.min(minLat, c[1]);
      maxLat = Math.max(maxLat, c[1]);
      return;
    }
    for (const x of c) walk(x);
  }
  for (const f of geojson.features) walk(f.geometry.coordinates);
  const toY = (lat: number) => (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
  const my = toY(maxLat), gW = maxLon - minLon, gH = my - toY(minLat);
  const aW = w - pad * 2, aH = h - pad * 2, s = Math.min(aW / gW, aH / gH);
  const ox = pad + (aW - gW * s) / 2, oy = pad + (aH - gH * s) / 2;
  return (lon: number, lat: number): [number, number] => [ox + (lon - minLon) * s, oy + (my - toY(lat)) * s];
}

function ringToPath(r: number[][], p: Function) {
  if (!r.length) return '';
  const s: string[] = [];
  for (let i = 0; i < r.length; i++) {
    const [x, y] = p(r[i][0], r[i][1]);
    s.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  s.push('Z');
  return s.join(' ');
}

function featureToPath(f: any, p: Function) {
  const g = f.geometry;
  if (g.type === 'Polygon') return g.coordinates.map((r: any) => ringToPath(r, p)).join(' ');
  if (g.type === 'MultiPolygon') return g.coordinates.map((pl: any) => pl.map((r: any) => ringToPath(r, p)).join(' ')).join(' ');
  return '';
}

function hexPath(r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${i === 0 ? 'M' : 'L'}${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
  }).join(' ') + ' Z';
}

function curvePath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const off = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.22, 50);
  const cx = mx + (dy > 0 ? -off : off);
  const cy = my + (dx > 0 ? off : -off);
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

/* ═══════════════════════════════════════════════════════════════
   Data Constants
   ═══════════════════════════════════════════════════════════════ */

const GOV_AR: Record<string, string> = {
  'Al-Anbar': 'الأنبار', 'Al-Basrah': 'البصرة', 'Al-Muthanna': 'المثنى', 'Al-Najaf': 'النجف',
  'Al-Qadissiya': 'القادسية', 'Al-Sulaymaniyah': 'السليمانية', 'Babil': 'بابل', 'Baghdad': 'بغداد',
  'Diyala': 'ديالى', 'Duhok': 'دهوك', 'Erbil': 'أربيل', 'Kerbala': 'كربلاء', 'Kirkuk': 'كركوك',
  'Maysan': 'ميسان', 'Ninewa': 'نينوى', 'Salah Al-Din': 'صلاح الدين', 'Thi Qar': 'ذي قار', 'Wassit': 'واسط',
};

const GOV_TO_CITY: Record<string, string> = {
  'Baghdad': 'Baghdad', 'Kerbala': 'Karbala', 'Al-Najaf': 'Najaf',
  'Al-Basrah': 'Basra', 'Kirkuk': 'Kirkuk', 'Erbil': 'Erbil',
  'Ninewa': 'Mosul', 'Al-Sulaymaniyah': 'Sulaymaniyah',
};

const BRANCH_GOV_SET = new Set(Object.keys(GOV_TO_CITY));

const OPS: Record<OpType, { icon: string; color: string; labelAr: string; labelEn: string }> = {
  entry:   { icon: '≡', color: '#F45A0A', labelAr: 'ترحيل قيود محاسبية', labelEn: 'Posting GL entries' },
  voucher: { icon: '◈', color: '#ea580c', labelAr: 'مزامنة سندات مالية', labelEn: 'Syncing vouchers' },
  balance: { icon: '₿', color: '#f97316', labelAr: 'تحديث أرصدة الخزائن', labelEn: 'Updating balances' },
  report:  { icon: '◰', color: '#fb923c', labelAr: 'ميزان المراجعة اللحظي', labelEn: 'Financial reports' },
};

const SEGMENTS: { from: string; to: string; op: OpType }[] = [
  { from: 'Baghdad',      to: 'Kerbala',          op: 'entry' },
  { from: 'Kerbala',      to: 'Al-Najaf',         op: 'balance' },
  { from: 'Al-Najaf',     to: 'Al-Basrah',        op: 'voucher' },
  { from: 'Al-Basrah',    to: 'Baghdad',          op: 'report' },
  { from: 'Baghdad',      to: 'Kirkuk',           op: 'entry' },
  { from: 'Kirkuk',       to: 'Erbil',            op: 'voucher' },
  { from: 'Erbil',        to: 'Ninewa',           op: 'balance' },
  { from: 'Erbil',        to: 'Al-Sulaymaniyah',  op: 'entry' },
];

const INFO: Record<string, { ar: string[]; en: string[]; balanceUSD: string }> = {
  'Baghdad':         { ar: ['المركز المالي الرئيسي', '24 قيداً مرحّلاً', '8 سندات مالية', 'IQD 340,000,000', 'آخر تحديث: الآن'], en: ['Main Financial Center', '24 entries posted', '8 vouchers', 'IQD 340,000,000', 'Last update: now'], balanceUSD: '$222,000' },
  'Kerbala':         { ar: ['تمت مزامنة البيانات', '12 قيداً مرحّلاً', '4 سندات مالية', 'IQD 45,200,000', 'آخر تحديث: الآن'], en: ['Data synced successfully', '12 entries posted', '4 vouchers', 'IQD 45,200,000', 'Last update: now'], balanceUSD: '$29,500' },
  'Al-Najaf':        { ar: ['تحديث أرصدة الفرع', 'IQD 125,000,000', 'USD 18,500', '6 سندات صادرة', 'آخر تحديث: الآن'], en: ['Balance updated', 'IQD 125,000,000', 'USD 18,500', '6 vouchers issued', 'Last update: now'], balanceUSD: '$81,600' },
  'Al-Basrah':       { ar: ['تم تحديث الأرصدة', 'IQD 89,500,000', 'USD 12,300', '3 حجوزات معلقة', 'آخر تحديث: الآن'], en: ['Balances updated', 'IQD 89,500,000', 'USD 12,300', '3 pending', 'Last update: now'], balanceUSD: '$58,400' },
  'Kirkuk':          { ar: ['استلام سندات جديدة', '6 سندات صادرة', 'IQD 22,800,000', '3 حجوزات', 'آخر تحديث: الآن'], en: ['Vouchers received', '6 issued', 'IQD 22,800,000', '3 bookings', 'Last update: now'], balanceUSD: '$14,900' },
  'Erbil':           { ar: ['تمت المطابقة بنجاح', '18 قيداً مرحّلاً', 'IQD 67,400,000', 'كشف محدّث', 'آخر تحديث: الآن'], en: ['Reconciled successfully', '18 entries posted', 'IQD 67,400,000', 'Statement updated', 'Last update: now'], balanceUSD: '$44,000' },
  'Ninewa':          { ar: ['مزامنة الحجوزات', '9 حجوزات جديدة', '2 سندات معلقة', 'IQD 31,600,000', 'آخر تحديث: الآن'], en: ['Bookings synced', '9 new bookings', '2 pending vouchers', 'IQD 31,600,000', 'Last update: now'], balanceUSD: '$20,600' },
  'Al-Sulaymaniyah': { ar: ['ترحيل القيود', '15 قيداً مرحّلاً', '5 سندات جديدة', 'IQD 28,100,000', 'آخر تحديث: الآن'], en: ['Entries posted', '15 posted', '5 new vouchers', 'IQD 28,100,000', 'Last update: now'], balanceUSD: '$18,300' },
};

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */

const W = 700, H = 900, PAD = 12;

export const IraqBranchNetworkMap: React.FC<Props> = ({
  isSuccess = false,
  lang = 'ar',
  onFocusChange,
  theme = 'dark',
  selectedBranch = null,
  onBranchClick,
}) => {
  const isAr = lang === 'ar';
  const isDark = theme === 'dark';

  /* ── State ── */
  const [mounted, setMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [nodesReady, setNodesReady] = useState(false);
  const [linesReady, setLinesReady] = useState(false);
  const [phase, setPhase] = useState<Phase>('boot');
  const [segIdx, setSegIdx] = useState(0);
  const [prevSegIdx, setPrevSegIdx] = useState(-1);
  const [hoveredGov, setHoveredGov] = useState<string | null>(null);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const focusCbRef = useRef(onFocusChange);
  focusCbRef.current = onFocusChange;

  /* ── Reduced motion ── */
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const h = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  /* ── Computed geometry (stable) ── */
  const adm0 = useMemo(() => JSON.parse(JSON.stringify(IRAQ_ADM0_GEOJSON)), []);
  const adm1 = useMemo(() => JSON.parse(JSON.stringify(IRAQ_ADM1_GEOJSON)), []);
  const project = useMemo(() => createProjection(adm0, W, H, PAD), [adm0]);
  const adm0Path = useMemo(() => featureToPath(adm0.features[0], project), [adm0, project]);

  const adm1Data = useMemo(() => adm1.features.map((f: any) => {
    const n = f.properties.adm1_name;
    return {
      d: featureToPath(f, project),
      nameEn: n,
      nameAr: GOV_AR[n] || n,
      isBranch: BRANCH_GOV_SET.has(n),
    };
  }), [adm1, project]);

  const cities = useMemo(() => IRAQ_BRANCH_CITIES.map(c => {
    const [x, y] = project(c.longitude, c.latitude);
    return { ...c, x, y };
  }), [project]);

  const hq = cities.find(c => c.isHeadOffice);
  const branches = useMemo(() => cities.filter(c => !c.isHeadOffice), [cities]);

  const getCityByGov = useCallback((govName: string) => {
    const cityName = GOV_TO_CITY[govName] || govName;
    return cities.find(c => c.nameEn === cityName);
  }, [cities]);

  /* ── Segment paths (stable) ── */
  const segmentPaths = useMemo(() => SEGMENTS.map(seg => {
    const from = getCityByGov(seg.from);
    const to = getCityByGov(seg.to);
    if (!from || !to) return { path: '', fromX: 0, fromY: 0, toX: 0, toY: 0 };
    return {
      path: curvePath(from.x, from.y, to.x, to.y),
      fromX: from.x, fromY: from.y, toX: to.x, toY: to.y,
    };
  }), [getCityByGov]);

  /* ── Boot sequence ── */
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    setTimeout(() => setMapReady(true), 250);
    setTimeout(() => setNodesReady(true), 600);
    setTimeout(() => setLinesReady(true), 900);
  }, []);

  /* ═══ SEQUENCER ═══ */
  useEffect(() => {
    if (isSuccess) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const idx = segIdx % SEGMENTS.length;
    const seg = SEGMENTS[idx];

    switch (phase) {
      case 'boot':
        timers.push(setTimeout(() => setPhase('idle'), 1200));
        break;

      case 'idle':
        if (selectedBranch) break;
        timers.push(setTimeout(() => {
          if (!document.hidden) setPhase('sending');
        }, segIdx === 0 ? 2000 : 600));
        break;

      case 'sending':
        timers.push(setTimeout(() => {
          const city = getCityByGov(seg.to);
          const info = INFO[seg.to];
          if (city && info) {
            focusCbRef.current?.({
              name: city.nameEn,
              nameAr: city.nameAr,
              lines: isAr ? info.ar : info.en,
              yRatio: city.y / H,
            });
          }
        }, 350));
        timers.push(setTimeout(() => setPhase('receiving'), 1800));
        break;

      case 'receiving':
        timers.push(setTimeout(() => setPhase('displaying'), 800));
        break;

      case 'displaying':
        timers.push(setTimeout(() => setPhase('transit'), 2400));
        break;

      case 'transit':
        timers.push(setTimeout(() => {
          setPrevSegIdx(segIdx);
          setSegIdx(i => i + 1);
          setPhase('idle');
        }, 700));
        break;
    }

    return () => timers.forEach(clearTimeout);
  }, [phase, segIdx, isSuccess, isAr, getCityByGov, selectedBranch]);

  useEffect(() => {
    if (!selectedBranch && phase === 'idle') {
      const t = setTimeout(() => {
        if (!document.hidden) setPhase('sending');
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [selectedBranch, phase]);

  /* ═══ DERIVED VALUES ═══ */
  const idx = segIdx % SEGMENTS.length;
  const activeSeg = SEGMENTS[idx];
  const activeOp = OPS[activeSeg.op];
  const activeSegPath = segmentPaths[idx];
  const isActive = phase === 'sending' || phase === 'receiving' || phase === 'displaying';
  const destCity = isActive ? getCityByGov(activeSeg.to) : null;
  const srcCity = isActive ? getCityByGov(activeSeg.from) : null;

  /* ── Camera Transformation ── */
  const BASE_SCALE = 1.04;
  const ZOOM_SCALE = 1.35;
  const camTransform = (() => {
    if (selectedBranch) {
      const city = getCityByGov(selectedBranch);
      if (city) {
        const tx = W * 0.48 - city.x * ZOOM_SCALE;
        const ty = H * 0.44 - city.y * ZOOM_SCALE;
        return `translate(${tx.toFixed(0)}, ${ty.toFixed(0)}) scale(${ZOOM_SCALE})`;
      }
    }
    return `translate(-50, -6) scale(${BASE_SCALE})`;
  })();
  const camScale = selectedBranch ? ZOOM_SCALE : BASE_SCALE;
  const inverseZoom = BASE_SCALE / camScale;

  /* ── Ultra-crisp FinTech Color Palette ── */
  const C = {
    fill:        isDark ? 'rgba(10,30,52,0.85)' : 'rgba(255, 255, 255, 0.95)',
    fillOuter:   isDark ? 'rgba(7, 20, 38, 0.5)' : 'rgba(248, 250, 252, 0.8)',
    border:      '#F45A0A',
    borderGlow:  isDark ? 'rgba(244,90,10,0.35)' : 'rgba(244,90,10,0.2)',
    provStroke:  isDark ? 'rgba(244,90,10,0.22)' : 'rgba(244,90,10,0.18)',
    provActive:  '#F45A0A',
    provFill:    isDark ? 'rgba(244,90,10,0.2)' : 'rgba(244,90,10,0.08)',
    provHover:   isDark ? 'rgba(244,90,10,0.14)' : 'rgba(244,90,10,0.05)',
    routeBase:   isDark ? 'rgba(244,90,10,0.18)' : 'rgba(244,90,10,0.22)',
    node:        '#F45A0A',
    nodeRing:    isDark ? 'rgba(244,90,10,0.45)' : 'rgba(244,90,10,0.35)',
    hq:          '#F45A0A',
    label:       isDark ? '#f8fafc' : '#0f172a',
    labelActive: '#F45A0A',
    hqLabel:     isDark ? '#ffffff' : '#0f172a',
    shadow:      isDark ? 'drop-shadow(0 2px 5px rgba(0,0,0,0.9))' : 'drop-shadow(0 1px 3px rgba(0,0,0,0.12))',
    gridDot:     isDark ? 'rgba(244,90,10,0.08)' : 'rgba(244,90,10,0.07)',
    bgdGlow:     '#F45A0A',
    bg:          isDark ? '#071426' : '#FFFFFF',
  };

  /* ═══ RENDER ═══ */
  return (
    <div style={{ width: '100%', height: '100%', opacity: mounted ? 1 : 0, transition: 'opacity 0.6s', overflow: 'hidden', position: 'relative' }}>
      {/* ── SVG Canvas ── */}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
        <defs>
          {/* ── Filters ── */}
          <filter id="borderGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
          <filter id="routeGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="nodeGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b" />
            <feFlood floodColor={C.node} floodOpacity="0.4" result="c" />
            <feComposite in="c" in2="b" operator="in" result="g" />
            <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="hqGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
            <feFlood floodColor={C.hq} floodOpacity="0.45" result="c" />
            <feComposite in="c" in2="b" operator="in" result="g" />
            <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="pktGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* ── Patterns & Gradients ── */}
          <pattern id="mapGrid" patternUnits="userSpaceOnUse" width="22" height="22">
            <circle cx="11" cy="11" r="0.6" fill={C.gridDot} />
          </pattern>
          <radialGradient id="bgdGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.bgdGlow} stopOpacity="0.12" />
            <stop offset="100%" stopColor={C.bgdGlow} stopOpacity="0" />
          </radialGradient>

          {/* ── Active route gradient ── */}
          {activeSegPath && (
            <linearGradient id="activeGrad" gradientUnits="userSpaceOnUse"
              x1={activeSegPath.fromX} y1={activeSegPath.fromY}
              x2={activeSegPath.toX} y2={activeSegPath.toY}>
              <stop offset="0%" stopColor="#ea580c" />
              <stop offset="50%" stopColor="#F45A0A" />
              <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>
          )}

          {/* ── Ambient Matrix Glow ── */}
          <radialGradient id="ambientGlow1" cx="35%" cy="40%" r="30%">
            <stop offset="0%" stopColor="#F45A0A" stopOpacity={isDark ? '0.06' : '0.04'} />
            <stop offset="100%" stopColor="#F45A0A" stopOpacity="0" />
          </radialGradient>

          <clipPath id="iraqClip"><path d={adm0Path} /></clipPath>
        </defs>

        {/* ═══ CAMERA GROUP ═══ */}
        <g style={{ transform: camTransform, transition: reduceMotion ? 'none' : 'transform 0.9s cubic-bezier(0.25,0.46,0.45,0.94)', transformOrigin: '0 0' }}>

          {/* ── Layer 1: Country Fill + Grid Matrix Texture ── */}
          <g style={{ opacity: mapReady ? 1 : 0, transition: 'opacity 0.8s' }}>
            {/* Subtle Drop Shadow under Iraq territory */}
            <path d={adm0Path} fill={isDark ? 'rgba(0,0,0,0.5)' : 'rgba(244,90,10,0.06)'} transform="translate(0, 5)" filter="url(#borderGlow)" />

            <g clipPath="url(#iraqClip)">
              <path d={adm0Path} fill={C.fill} />
              <rect x="0" y="0" width={W} height={H} fill="url(#mapGrid)" />
              <rect x="0" y="0" width={W} height={H} fill="url(#ambientGlow1)" />
            </g>

            {/* ── Layer 2: Baghdad Radial Glow ── */}
            {hq && <circle cx={hq.x} cy={hq.y} r="130" fill="url(#bgdGlow)" />}

            {/* ── Layer 3: Province Boundaries & Interactive Hover Polygons ── */}
            {adm1Data.map((g: any, i: number) => {
              const isDestProv = isActive && g.nameEn === activeSeg.to;
              const isSelectedProv = selectedBranch === g.nameEn;
              const isHovered = hoveredGov === g.nameEn;
              const isHighlight = isSelectedProv || isDestProv || isHovered;
              const prov_op = isHighlight ? 0.95 : (isActive ? 0.45 : 0.7);
              const sw = isHighlight ? 2.4 : 0.8;
              const stroke = isHighlight ? C.provActive : C.provStroke;
              const fill = isHighlight ? (isSelectedProv ? C.provFill : C.provHover) : 'none';

              return (
                <path
                  key={i}
                  d={g.d}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={sw}
                  strokeLinejoin="round"
                  style={{
                    opacity: prov_op,
                    transition: 'all 0.4s ease',
                    cursor: g.isBranch ? 'pointer' : 'default',
                  }}
                  onMouseEnter={() => setHoveredGov(g.nameEn)}
                  onMouseLeave={() => setHoveredGov(null)}
                  onClick={(e) => {
                    if (g.isBranch) {
                      e.stopPropagation();
                      onBranchClick?.(selectedBranch === g.nameEn ? null : g.nameEn);
                    }
                  }}
                />
              );
            })}

            {/* ── Layer 4: High-Precision Country Dual Border ── */}
            <path d={adm0Path} fill="none" stroke={C.borderGlow} strokeWidth="6" filter="url(#borderGlow)" />
            <path d={adm0Path} fill="none" stroke={C.border} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          {/* ── Layer 5: Base Routes & Ambient Telemetry Beams ── */}
          <g style={{ opacity: linesReady ? 1 : 0, transition: 'opacity 0.6s ease 0.2s' }}>
            {segmentPaths.map((sp, i) => {
              const isThisActive = isActive && i === idx;
              return (
                <g key={`route-${i}`}>
                  {/* Subtle wide glow track */}
                  <path
                    d={sp.path}
                    fill="none"
                    stroke={C.routeBase}
                    strokeWidth={isThisActive ? 0 : 2}
                    strokeLinecap="round"
                    opacity={isThisActive ? 0 : (isActive ? 0.4 : 0.85)}
                    style={{ transition: 'opacity 0.8s, stroke-width 0.6s' }}
                  />

                  {/* Ambient data packets floating continuously */}
                  {!isThisActive && !reduceMotion && (
                    <>
                      <circle r="2.8" fill="#F45A0A" opacity="0">
                        <animateMotion dur={`${3.5 + i * 0.6}s`} path={sp.path} repeatCount="indefinite" begin={`${i * 0.7}s`} />
                        <animate attributeName="opacity" values="0;0.6;0.4;0" dur={`${3.5 + i * 0.6}s`} repeatCount="indefinite" begin={`${i * 0.7}s`} />
                      </circle>
                      <circle r="1.4" fill="#ffffff" opacity="0">
                        <animateMotion dur={`${3.5 + i * 0.6}s`} path={sp.path} repeatCount="indefinite" begin={`${i * 0.7}s`} />
                        <animate attributeName="opacity" values="0;0.9;0.7;0" dur={`${3.5 + i * 0.6}s`} repeatCount="indefinite" begin={`${i * 0.7}s`} />
                      </circle>
                    </>
                  )}
                </g>
              );
            })}
          </g>

          {/* ── Layer 6: Active Transmission Route (Luminous Beam) ── */}
          {isActive && activeSegPath?.path && (
            <g style={{ opacity: (phase as any) === 'transit' ? 0 : 1, transition: 'opacity 0.6s ease' }}>
              {/* Wide ambient laser halo */}
              <path
                d={activeSegPath.path}
                fill="none"
                stroke="url(#activeGrad)"
                strokeWidth="14"
                strokeLinecap="round"
                opacity={isDark ? '0.18' : '0.12'}
                filter="url(#routeGlow)"
              />
              {/* Mid beam */}
              <path
                d={activeSegPath.path}
                fill="none"
                stroke="url(#activeGrad)"
                strokeWidth="7"
                strokeLinecap="round"
                opacity={isDark ? '0.45' : '0.3'}
              />
              {/* Core fiber optic ray */}
              <path
                d={activeSegPath.path}
                fill="none"
                stroke="url(#activeGrad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                style={{ opacity: 1 }}
              />
            </g>
          )}

          {/* ── Layer 7: High-Speed Financial Data Packets ── */}
          {phase === 'sending' && activeSegPath?.path && !reduceMotion && (
            <g key={`pkt-${segIdx}`}>
              {/* Large glow aura */}
              <circle r="12" fill={activeOp.color} opacity="0" filter="url(#pktGlow)">
                <animateMotion dur="1.8s" path={activeSegPath.path} fill="freeze" />
                <animate attributeName="opacity" values="0;0.2;0.12;0" dur="1.8s" fill="freeze" />
              </circle>
              {/* Main energetic packet */}
              <circle r="5.5" fill={activeOp.color} opacity="0">
                <animateMotion dur="1.8s" path={activeSegPath.path} fill="freeze" />
                <animate attributeName="opacity" values="0;1;0.9;0.8" dur="1.8s" fill="freeze" />
              </circle>
              {/* Ultra-bright white core */}
              <circle r="2.5" fill="#ffffff" opacity="0">
                <animateMotion dur="1.8s" path={activeSegPath.path} fill="freeze" />
                <animate attributeName="opacity" values="0;1;0.95;0.7" dur="1.8s" fill="freeze" />
              </circle>
              {/* Trailing photon packet */}
              <circle r="3.5" fill={activeOp.color} opacity="0">
                <animateMotion dur="1.8s" path={activeSegPath.path} fill="freeze" begin="0.15s" />
                <animate attributeName="opacity" values="0;0.7;0.5;0" dur="1.65s" fill="freeze" begin="0.15s" />
              </circle>
            </g>
          )}

          {/* ── Source Node Pulse on Transmission ── */}
          {phase === 'sending' && srcCity && !reduceMotion && (
            <g key={`src-flash-${segIdx}`}>
              <circle cx={srcCity.x} cy={srcCity.y} r="6" fill={activeOp.color} opacity="0">
                <animate attributeName="opacity" values="0;0.7;0.3;0" dur="0.8s" fill="freeze" />
                <animate attributeName="r" values="6;22;26" dur="0.8s" fill="freeze" />
              </circle>
            </g>
          )}

          {/* ── Layer 8: Regional Branch Nodes ── */}
          {branches.map((city, ci) => {
            const govName = Object.entries(GOV_TO_CITY).find(([, v]) => v === city.nameEn)?.[0] || city.nameEn;
            const isDestNode = isActive && activeSeg.to === govName;
            const isSrcNode = isActive && activeSeg.from === govName;
            const isSelected = selectedBranch === govName;
            const isHovered = hoveredGov === govName;
            const isHighlight = isSelected || isDestNode || isHovered;
            const nodeOp = isHighlight ? 1 : (isActive ? 0.6 : 0.95);
            const statusColor = isHighlight ? '#F45A0A' : C.node;
            const dur = `${3 + ci * 0.4}s`;
            const activeScale = isHighlight ? 1.2 : 1;
            const nodeScale = activeScale * inverseZoom;

            return (
              <g
                key={city.id}
                style={{
                  opacity: nodesReady ? nodeOp : 0,
                  transition: 'opacity 0.6s ease',
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onBranchClick?.(govName === selectedBranch ? null : govName);
                }}
                onMouseEnter={() => setHoveredGov(govName)}
                onMouseLeave={() => setHoveredGov(null)}
              >
                <g
                  transform={`translate(${city.x},${city.y})`}
                  style={{
                    transform: `translate(${city.x}px,${city.y}px) scale(${nodeScale})`,
                    transformOrigin: `${city.x}px ${city.y}px`,
                    transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                >
                  {/* Outer breathing radar ring */}
                  <circle r="12" fill="none" stroke={C.nodeRing} strokeWidth="1.2">
                    {!reduceMotion && (
                      <>
                        <animate attributeName="r" values="10;14;10" dur={dur} repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.8;0.3;0.8" dur={dur} repeatCount="indefinite" />
                      </>
                    )}
                  </circle>

                  {/* Inner fill aura */}
                  <circle r="7" fill="rgba(244,90,10,0.12)" />

                  {/* Active Dest Ripple Rings */}
                  {isDestNode && (phase === 'receiving' || phase === 'displaying') && !reduceMotion && (
                    <>
                      <circle r="9" fill="none" stroke="#F45A0A" strokeWidth="2">
                        <animate attributeName="r" values="8;26;8" dur="1.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.8;0.05;0.8" dur="1.8s" repeatCount="indefinite" />
                      </circle>
                    </>
                  )}

                  {/* Core Node Circle */}
                  <circle r="4.5" fill={statusColor} filter="url(#nodeGlow)" />
                  {/* Bright Core Pin */}
                  <circle r="1.8" fill="#ffffff" />
                  
                  {/* Status Indicator Dot */}
                  <circle cx="8" cy="-8" r="2.8" fill="#F45A0A" stroke={C.bg} strokeWidth="1.5" />
                </g>

                {/* Floating Clean Typography with subtle halo */}
                <g transform={`translate(${city.x}, ${city.y + 16})`}>
                  <text
                    x="0"
                    y="0"
                    textAnchor="middle"
                    fill={isHighlight ? '#F45A0A' : (isDark ? '#f8fafc' : '#0f172a')}
                    stroke={isDark ? 'rgba(7,20,38,0.9)' : 'rgba(255,255,255,0.95)'}
                    strokeWidth="2.5"
                    style={{ paintOrder: 'stroke fill' }}
                    fontSize={isHighlight ? '11.5' : '10'}
                    fontWeight="800"
                    fontFamily={isAr ? "'IBM Plex Sans Arabic', 'Tajawal', sans-serif" : "'Inter', sans-serif"}
                  >
                    {isAr ? city.nameAr : city.nameEn}
                  </text>
                </g>
              </g>
            );
          })}

          {/* ── Layer 9: Baghdad Headquarters Core Hub (Hexagonal Apex) ── */}
          {hq && (
            <g
              style={{
                opacity: nodesReady ? 1 : 0,
                transition: 'opacity 0.6s ease 0.4s',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onBranchClick?.(selectedBranch === 'Baghdad' ? null : 'Baghdad');
              }}
              onMouseEnter={() => setHoveredGov('Baghdad')}
              onMouseLeave={() => setHoveredGov(null)}
            >
              <g
                transform={`translate(${hq.x},${hq.y})`}
                style={{
                  transform: `translate(${hq.x}px,${hq.y}px) scale(${inverseZoom})`,
                  transformOrigin: `${hq.x}px ${hq.y}px`,
                  transition: 'transform 0.5s ease',
                }}
              >
                {/* Outer Breathing Hexagon */}
                <path d={hexPath(20)} fill="none" stroke="#F45A0A" strokeWidth="1.5">
                  {!reduceMotion && (
                    <animate attributeName="opacity" values="0.9;0.3;0.9" dur="3.5s" repeatCount="indefinite" />
                  )}
                </path>
                {/* Middle Hexagon */}
                <path d={hexPath(15)} fill="none" stroke="#F45A0A" strokeWidth="0.8" opacity="0.5" />
                {/* Inner Hexagon Fill */}
                <path d={hexPath(11)} fill="rgba(244,90,10,0.18)" stroke="#F45A0A" strokeWidth="1" />
                {/* Core HQ Circle */}
                <circle r="6.5" fill="#F45A0A" filter="url(#hqGlow)" />
                {/* Core White Star Pin */}
                <circle r="2.5" fill="#ffffff" />

                {/* Concentric Double Radar Pulses radiating from HQ */}
                {!reduceMotion && (
                  <>
                    <circle r="16" fill="none" stroke="#F45A0A" strokeWidth="1.2" opacity="0.4">
                      <animate attributeName="r" values="14;28;14" dur="3.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.5;0.05;0.5" dur="3.5s" repeatCount="indefinite" />
                    </circle>
                    <circle r="12" fill="none" stroke="#F45A0A" strokeWidth="0.8" opacity="0.3">
                      <animate attributeName="r" values="11;22;11" dur="3.5s" repeatCount="indefinite" begin="0.6s" />
                      <animate attributeName="opacity" values="0.4;0.03;0.4" dur="3.5s" repeatCount="indefinite" begin="0.6s" />
                    </circle>
                  </>
                )}
              </g>

              {/* Baghdad Grand Central Halo Typography */}
              <g transform={`translate(${hq.x}, ${hq.y + 22})`}>
                <text
                  x="0"
                  y="0"
                  textAnchor="middle"
                  fill={isDark ? '#ffffff' : '#0f172a'}
                  stroke={isDark ? 'rgba(7,20,38,0.95)' : 'rgba(255,255,255,0.95)'}
                  strokeWidth="3"
                  style={{ paintOrder: 'stroke fill' }}
                  fontSize="13"
                  fontWeight="900"
                  fontFamily={isAr ? "'IBM Plex Sans Arabic', 'Tajawal', sans-serif" : "'Inter', sans-serif"}
                >
                  {isAr ? 'بغداد' : 'Baghdad'}
                </text>
                <text
                  x="0"
                  y="11"
                  textAnchor="middle"
                  fill="#F45A0A"
                  stroke={isDark ? 'rgba(7,20,38,0.95)' : 'rgba(255,255,255,0.95)'}
                  strokeWidth="2"
                  style={{ paintOrder: 'stroke fill' }}
                  fontSize="8"
                  fontWeight="800"
                  fontFamily="'Inter', sans-serif"
                  letterSpacing="0.8"
                >
                  {isAr ? 'المركز المالي الرئيسي (HQ)' : 'FINANCIAL HQ'}
                </text>
              </g>
            </g>
          )}

          {/* ── Layer 10: Receive Ripple & Confirmation Pulse ── */}
          {phase === 'receiving' && destCity && !reduceMotion && (
            <g key={`recv-${segIdx}`}>
              <circle cx={destCity.x} cy={destCity.y} r="8" fill="none" stroke="#F45A0A" strokeWidth="2.5">
                <animate attributeName="r" from="8" to="36" dur="0.9s" fill="freeze" />
                <animate attributeName="opacity" from="0.8" to="0" dur="0.9s" fill="freeze" />
              </circle>
              <circle cx={destCity.x} cy={destCity.y} r="6" fill="#F45A0A" opacity="0">
                <animate attributeName="opacity" values="0;0.9;0" dur="0.6s" fill="freeze" begin="0.1s" />
                <animate attributeName="r" values="6;12;6" dur="0.6s" fill="freeze" begin="0.1s" />
              </circle>
            </g>
          )}

        </g>
      </svg>
    </div>
  );
};

export default IraqBranchNetworkMap;
