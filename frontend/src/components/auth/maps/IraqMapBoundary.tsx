import React from 'react';
import { GeoPath } from 'd3-geo';

interface IraqMapBoundaryProps {
  pathGenerator: GeoPath<any, any>;
  adm0Data: any;
  adm1Data: any;
}

export const IraqMapBoundary: React.FC<IraqMapBoundaryProps> = ({
  pathGenerator,
  adm0Data,
  adm1Data,
}) => {
  return (
    <g className="iraq-map-boundary select-none">
      {/* 1. ADM1 Governorates Internal Boundaries */}
      {adm1Data && adm1Data.features && (
        <g className="adm1-governorates">
          {adm1Data.features.map((feature: any, idx: number) => {
            const pathData = pathGenerator(feature);
            if (!pathData) return null;
            return (
              <path
                key={`adm1-${idx}`}
                d={pathData}
                fill="none"
                stroke="rgba(16, 185, 129, 0.08)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            );
          })}
        </g>
      )}

      {/* 2. ADM0 National Boundary Silhouette Fill & Emerald Outline */}
      {adm0Data && adm0Data.features && (
        <g className="adm0-national">
          {adm0Data.features.map((feature: any, idx: number) => {
            const pathData = pathGenerator(feature);
            if (!pathData) return null;
            return (
              <path
                key={`adm0-${idx}`}
                d={pathData}
                fill="rgba(5, 150, 105, 0.04)"
                stroke="#059669"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-[0_0_12px_rgba(5,150,105,0.25)]"
              />
            );
          })}
        </g>
      )}
    </g>
  );
};
