import React, { useState } from 'react';
import { SectionCard } from '../common/SectionCard';
import { SectionHeader } from '../common/SectionHeader';
import { QuickActionButton } from './QuickActionButton';
import {
  IconBolt,
  IconBriefcase,
  IconReceiptTax,
  IconUsers,
  IconReportAnalytics,
} from '@tabler/icons-react';

export interface ActionItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  onClick: () => void;
  description?: string;
  permission?: string;
}

export interface ActionCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  items: ActionItem[];
}

interface QuickActionsPanelProps {
  categories: ActionCategory[];
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({ categories }) => {
  const [activeTabId, setActiveTabId] = useState<string>(categories[0]?.id || 'OPERATIONS');

  const currentCategory = categories.find((c) => c.id === activeTabId) || categories[0];

  return (
    <SectionCard className="mb-6">
      <SectionHeader
        title="الإجراءات السريعة"
        description="الوصول الفوري للعمليات وإصدار الفواتير والسندات والتقارير"
        icon={<IconBolt size={18} />}
        action={
          <div className="flex flex-wrap items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 gap-1">
            {categories.map((cat) => {
              const isActive = cat.id === activeTabId;
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveTabId(cat.id)}
                  className={`h-8 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-orange-600 shadow-xs border border-slate-200/80 font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Icon size={14} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        }
      />

      {/* Action Items Grid (Max 6 visible at once for clean, uncrowded layout) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {currentCategory?.items.map((item) => (
          <QuickActionButton
            key={item.id}
            title={item.title}
            icon={item.icon}
            onClick={item.onClick}
            description={item.description}
          />
        ))}
      </div>
    </SectionCard>
  );
};
