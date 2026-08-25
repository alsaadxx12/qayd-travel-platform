import React from 'react';

interface QuickActionButtonProps {
  title: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  onClick: () => void;
  description?: string;
}

export const QuickActionButton: React.FC<QuickActionButtonProps> = ({
  title,
  icon: Icon,
  onClick,
  description,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full min-h-[52px] h-[52px] bg-white border border-[#E5E7EB] hover:border-orange-300 hover:bg-orange-50/40 rounded-xl px-3.5 flex items-center justify-start gap-3 transition-all duration-150 cursor-pointer shadow-2xs text-right active:scale-[0.99]"
    >
      <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 border border-orange-100 flex items-center justify-center shrink-0 group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-colors duration-150">
        <Icon size={18} />
      </div>

      <div className="flex-1 min-w-0">
        <span className="block text-[13px] font-bold text-slate-800 group-hover:text-orange-950 truncate transition-colors leading-tight">
          {title}
        </span>
        {description && (
          <span className="block text-[11px] text-slate-400 truncate mt-0.5">
            {description}
          </span>
        )}
      </div>
    </button>
  );
};
