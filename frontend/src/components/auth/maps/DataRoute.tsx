import React from 'react';

interface DataRouteProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isActive: boolean;
  color?: string;
}

export const DataRoute: React.FC<DataRouteProps> = ({
  startX,
  startY,
  endX,
  endY,
  isActive,
  color = '#059669',
}) => {
  // Calculate gentle curve midpoint
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2 - 20;

  const pathD = `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;

  return (
    <g className="data-route select-none">
      {/* Background Arc Path */}
      <path
        d={pathD}
        fill="none"
        stroke={isActive ? 'rgba(5, 150, 105, 0.6)' : 'rgba(5, 150, 105, 0.15)'}
        strokeWidth={isActive ? '2.5' : '1.5'}
        strokeDasharray="5 4"
      />

      {/* Active Data Flow Pulse */}
      {isActive && (
        <>
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray="12 12"
            style={{ animation: 'dash-flow 3s linear infinite' }}
          />
          <circle cx={endX} cy={endY} r="8" fill="rgba(52, 211, 153, 0.3)" className="animate-ping" />
        </>
      )}
    </g>
  );
};
