import React from 'react';
import { Button } from '@mantine/core';
import { IconRefresh, IconClock } from '@tabler/icons-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  lastUpdated?: string;
  onRefresh?: () => void;
  loading?: boolean;
  actionButtonText?: string;
  extraActions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  lastUpdated,
  onRefresh,
  loading = false,
  actionButtonText = 'تحديث البيانات',
  extraActions,
}) => {
  return (
    <header className="bg-white border border-[#E5E7EB] rounded-[14px] p-5 shadow-xs mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 select-none">
      <div className="space-y-1 text-right">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-[13px] text-slate-500 font-medium leading-normal">
            {description}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {lastUpdated && (
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] text-slate-600 font-medium">
            <IconClock size={15} className="text-slate-400 shrink-0" />
            <span>آخر تحديث:</span>
            <span className="font-mono font-bold text-slate-800" dir="ltr">
              {lastUpdated}
            </span>
          </div>
        )}

        {extraActions}

        {onRefresh && (
          <Button
            color="orange"
            leftSection={
              <IconRefresh
                size={16}
                className={loading ? 'animate-spin' : ''}
              />
            }
            onClick={onRefresh}
            loading={loading}
            className="h-9 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow-2xs transition-all px-4"
          >
            {actionButtonText}
          </Button>
        )}
      </div>
    </header>
  );
};
