import React from 'react';
import { IraqiBranchCity } from '../../../config/iraqBranches';

interface BranchNodeProps {
  city: IraqiBranchCity;
  x: number;
  y: number;
  isActive: boolean;
}

export const BranchNode: React.FC<BranchNodeProps> = ({ city, x, y, isActive }) => {
  const isHQ = city.isHeadOffice;

  // Offsets for text labels to prevent overlapping
  let textDx = 14;
  let textDy = 4;
  let textAnchor: 'start' | 'end' | 'middle' = 'start';

  if (city.id === 'karbala' || city.id === 'najaf' || city.id === 'mosul') {
    textDx = -14;
    textAnchor = 'end';
  } else if (city.id === 'erbil' || city.id === 'sulaymaniyah') {
    textDy = -12;
    textDx = 0;
    textAnchor = 'middle';
  }

  return (
    <g transform={`translate(${x}, ${y})`} className="branch-node cursor-pointer select-none">
      {/* 1. Pulse ring */}
      {isHQ ? (
        <>
          <circle r="22" fill="rgba(5, 150, 105, 0.2)" className="animate-ping" />
          <circle r="12" fill="rgba(5, 150, 105, 0.4)" />
          <circle r="7" fill="#059669" />
          <circle r="3" fill="#ffffff" />
        </>
      ) : (
        <>
          {isActive && <circle r="14" fill="rgba(52, 211, 153, 0.25)" className="animate-pulse" />}
          <circle r={isActive ? 6 : 5} fill={isActive ? '#34d399' : '#0284c7'} />
          <circle r="2" fill="#ffffff" />
        </>
      )}

      {/* 2. Text Label */}
      <text
        x={textDx}
        y={textDy}
        textAnchor={textAnchor}
        fill={isHQ ? '#f8fafc' : isActive ? '#34d399' : '#cbd5e1'}
        fontSize={isHQ ? '12' : '10'}
        fontWeight={isHQ ? '900' : 'bold'}
        fontFamily="sans-serif"
        className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
      >
        {city.nameAr}
      </text>
    </g>
  );
};
