import React, { useMemo } from 'react';
import { IRAQ_ADM0_GEOJSON } from '../assets/maps/iraqAdm0Data';
import { IRAQ_ADM1_GEOJSON } from '../assets/maps/iraqAdm1Data';
import { IRAQ_BRANCH_CITIES } from '../config/iraqBranchLocations';

/**
 * MAP VERIFICATION PAGE
 * Renders Iraq map WITHOUT d3-geo geoPath (which has winding order issues).
 * Instead, manually projects each coordinate point through a simple Mercator transform.
 */

const MAP_WIDTH = 600;
const MAP_HEIGHT = 700;
const PADDING = 60;

/**
 * Manual Mercator projection.
 * Converts [longitude, latitude] → [x, y] in pixel space,
 * fitted to the bounding box of Iraq.
 */
function createProjection(geojson: any) {
  // Find bounding box of all coordinates
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  function walkCoords(coords: any) {
    if (typeof coords[0] === 'number') {
      const [lon, lat] = coords;
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      return;
    }
    for (const c of coords) walkCoords(c);
  }

  for (const feature of geojson.features) {
    walkCoords(feature.geometry.coordinates);
  }

  // Mercator: x = lon (degrees), y = Mercator(lat) in degree-equivalent units
  // Multiply by (180/π) to convert from radians to pseudo-degrees for consistent scaling with longitude
  const toMercY = (lat: number) =>
    (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));

  const mercMinY = toMercY(minLat);
  const mercMaxY = toMercY(maxLat);

  const geoWidth = maxLon - minLon;
  const geoHeight = mercMaxY - mercMinY;

  const availWidth = MAP_WIDTH - PADDING * 2;
  const availHeight = MAP_HEIGHT - PADDING * 2;

  // Scale to fit, preserving aspect ratio
  const scale = Math.min(availWidth / geoWidth, availHeight / geoHeight);

  // Center offset
  const projectedWidth = geoWidth * scale;
  const projectedHeight = geoHeight * scale;
  const offsetX = PADDING + (availWidth - projectedWidth) / 2;
  const offsetY = PADDING + (availHeight - projectedHeight) / 2;

  return (lon: number, lat: number): [number, number] => {
    const x = offsetX + (lon - minLon) * scale;
    const mercY = toMercY(lat);
    // Invert Y: higher lat → smaller Y (top of screen)
    const y = offsetY + (mercMaxY - mercY) * scale;
    return [x, y];
  };
}

/** Convert a polygon ring (array of [lon, lat]) to an SVG path "d" string */
function ringToPath(ring: number[][], project: (lon: number, lat: number) => [number, number]): string {
  if (ring.length === 0) return '';
  const parts: string[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = project(ring[i][0], ring[i][1]);
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/** Convert a GeoJSON feature to SVG path "d" string */
function featureToPath(feature: any, project: (lon: number, lat: number) => [number, number]): string {
  const geom = feature.geometry;
  if (geom.type === 'Polygon') {
    return geom.coordinates.map((ring: number[][]) => ringToPath(ring, project)).join(' ');
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates
      .map((polygon: number[][][]) => polygon.map((ring: number[][]) => ringToPath(ring, project)).join(' '))
      .join(' ');
  }
  return '';
}

/** Compute centroid of a polygon ring */
function ringCentroid(ring: number[][], project: (lon: number, lat: number) => [number, number]): [number, number] {
  let sx = 0, sy = 0;
  const n = ring.length - 1; // last point = first point in GeoJSON
  for (let i = 0; i < n; i++) {
    const [x, y] = project(ring[i][0], ring[i][1]);
    sx += x;
    sy += y;
  }
  return [sx / n, sy / n];
}

export const MapTestPage: React.FC = () => {
  const adm0 = useMemo(() => JSON.parse(JSON.stringify(IRAQ_ADM0_GEOJSON)), []);
  const adm1 = useMemo(() => JSON.parse(JSON.stringify(IRAQ_ADM1_GEOJSON)), []);

  // Create manual Mercator projection fitted to Iraq bounds
  const project = useMemo(() => createProjection(adm0), [adm0]);

  // ADM0 path
  const adm0Path = useMemo(() => featureToPath(adm0.features[0], project), [adm0, project]);

  // ADM1 paths + centroids
  const adm1Data = useMemo(() => {
    return adm1.features.map((feature: any) => ({
      d: featureToPath(feature, project),
      name: feature.properties.adm1_name,
      centroid: ringCentroid(feature.geometry.coordinates[0], project),
    }));
  }, [adm1, project]);

  // Project branch cities
  const projectedCities = useMemo(() => {
    return IRAQ_BRANCH_CITIES.map((city) => {
      const [x, y] = project(city.longitude, city.latitude);
      return { ...city, x, y };
    });
  }, [project]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#0a1628',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px',
        color: 'white',
        fontFamily: 'system-ui, sans-serif',
        direction: 'rtl',
        overflow: 'hidden',
      }}
    >
      {/* HEADER */}
      <div style={{ textAlign: 'center', marginBottom: '12px', flexShrink: 0 }}>
        <h1 style={{ fontSize: '20px', fontWeight: 900, margin: 0 }}>
          🇮🇶 صفحة اختبار خريطة العراق — GeoJSON من OCHA / HDX COD-AB
        </h1>
        <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', margin: '4px 0 0' }}>
          Source: data.humdata.org/dataset/cod-ab-irq | CRS: WGS84 / EPSG:4326 | ADM0 + ADM1 (18 محافظة) + 8 نقاط فرع
        </p>
      </div>

      {/* MAP SVG */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <svg
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          style={{
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            background: '#071426',
            maxHeight: 'calc(100vh - 120px)',
          }}
        >
          {/* ADM0: National territory fill */}
          <path d={adm0Path} fill="rgba(5, 150, 105, 0.08)" stroke="none" />

          {/* ADM1: Governorate borders */}
          {adm1Data.map((item: any, idx: number) => (
            <path
              key={`adm1-${idx}`}
              d={item.d}
              fill="none"
              stroke="rgba(16, 185, 129, 0.25)"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
          ))}

          {/* ADM0: National border outline */}
          <path
            d={adm0Path}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Governorate name labels */}
          {adm1Data.map((item: any, idx: number) => (
            <text
              key={`label-${idx}`}
              x={item.centroid[0]}
              y={item.centroid[1]}
              textAnchor="middle"
              fill="rgba(148, 163, 184, 0.55)"
              fontSize="8"
              fontWeight="700"
              fontFamily="sans-serif"
            >
              {item.name}
            </text>
          ))}

          {/* Branch City Points */}
          {projectedCities.map((city) => {
            const isHQ = city.isHeadOffice;
            let labelDx = isHQ ? 16 : 10;
            let anchor = 'start';
            if (city.id === 'karbala' || city.id === 'mosul') {
              labelDx = isHQ ? -16 : -10;
              anchor = 'end';
            }
            return (
              <g key={city.id} transform={`translate(${city.x.toFixed(1)}, ${city.y.toFixed(1)})`}>
                <circle r={isHQ ? 12 : 7} fill={isHQ ? 'rgba(5, 150, 105, 0.25)' : 'rgba(56, 189, 248, 0.15)'} />
                <circle r={isHQ ? 5 : 3} fill={isHQ ? '#059669' : '#38bdf8'} />
                <circle r={isHQ ? 2 : 1.5} fill="#fff" />
                <text
                  x={labelDx}
                  y={3}
                  textAnchor={anchor as any}
                  fill={isHQ ? '#34d399' : '#cbd5e1'}
                  fontSize={isHQ ? '12' : '10'}
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))' }}
                >
                  {city.nameAr}
                </text>
                <text
                  x={labelDx}
                  y={isHQ ? 17 : 15}
                  textAnchor={anchor as any}
                  fill="#64748b"
                  fontSize="7"
                  fontFamily="monospace"
                >
                  {city.longitude.toFixed(4)}°E, {city.latitude.toFixed(4)}°N
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* VERIFICATION INFO */}
      <div style={{ marginTop: '8px', fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', textAlign: 'center', flexShrink: 0 }}>
        <p style={{ margin: '2px 0' }}>✅ ADM0: حدود العراق الخارجية (1 feature) | ✅ ADM1: 18 محافظة | ✅ 8 نقاط فرع بإحداثيات [lon, lat]</p>
        <p style={{ margin: '2px 0' }}>تحقق: بغداد (وسط) | البصرة (جنوب شرق) | أربيل (شمال) | الموصل (شمال غرب) | النجف وكربلاء (جنوب بغداد) | كركوك والسليمانية (شمال)</p>
      </div>
    </div>
  );
};
