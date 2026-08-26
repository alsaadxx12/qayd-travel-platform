import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { CopilotCardShell } from './blockUtils.tsx';

export const ChartBlock: React.FC<{ payload: any }> = ({ payload }) => {
  const option = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      grid: { left: 36, right: 12, top: 24, bottom: 28 },
      xAxis: { type: 'category', data: payload.categories || [], axisLabel: { fontSize: 10 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
      series: (payload.series || []).map((s: any) => ({
        name: s.name,
        type: payload.chartType === 'line' ? 'line' : 'bar',
        data: s.data,
        itemStyle: { color: '#F45A0A' },
      })),
    }),
    [payload],
  );

  return (
    <CopilotCardShell>
      {payload.title && (
        <div className="px-3 py-2 text-[12px] font-bold text-slate-700 border-b border-slate-100">{payload.title}</div>
      )}
      <ReactECharts option={option} style={{ height: 180 }} opts={{ renderer: 'canvas' }} />
    </CopilotCardShell>
  );
};
