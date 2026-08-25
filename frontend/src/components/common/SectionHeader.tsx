import React from 'react';

interface SectionHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  icon,
  action,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3.5 border-b border-[#E5E7EB] gap-2 mb-4 select-none">
      <div className="flex items-center gap-2.5 text-right">
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 border border-orange-100 flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-[17px] font-black text-slate-900 leading-tight">
            {title}
          </h2>
          {description && (
            <p className="text-[12px] text-slate-500 font-medium mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>

      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
};
