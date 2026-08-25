import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useWorkspaceStore, WorkspaceTab } from '../../store/useWorkspaceStore';
import { useNavigate } from 'react-router-dom';
import {
  IconLayoutDashboard,
  IconReceiptTax,
  IconBook,
  IconListTree,
  IconWallet,
  IconUsers,
  IconReportAnalytics,
  IconHistory,
  IconX,
  IconChevronRight,
  IconChevronLeft,
  IconPin,
  IconPinnedOff,
  IconRotate,
  IconDots,
  IconPlane,
  IconId,
  IconUsersGroup,
  IconBuildingSkyscraper,
  IconArrowBackUp,
  IconFileText,
  IconBuildingStore,
  IconSettings,
  IconShieldCheck,
  IconScale,
} from '@tabler/icons-react';
import { Menu, ActionIcon } from '@mantine/core';

const iconMap: { [key: string]: any } = {
  dashboard: IconLayoutDashboard,
  vouchers: IconReceiptTax,
  'journal-entries': IconBook,
  accounts: IconListTree,
  'cashboxes-banks': IconWallet,
  'external-clearings': IconScale,
  partners: IconUsers,
  reports: IconReportAnalytics,
  'financial-reports': IconReportAnalytics,
  'audit-logs': IconHistory,
  tickets: IconPlane,
  visas: IconId,
  groups: IconUsersGroup,
  hotels: IconBuildingSkyscraper,
  refunds: IconArrowBackUp,
  reissues: IconRotate,
  'branches-structure': IconBuildingStore,
  'permission-groups': IconShieldCheck,
  'system-settings': IconSettings,
};

export const AccountingWorkspaceTabs: React.FC = () => {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabs,
    togglePinTab,
    setTabs,
  } = useWorkspaceStore();

  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Context Menu State
  const [contextTab, setContextTab] = useState<WorkspaceTab | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  // Drag & Drop State
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  // Auto-scroll active tab into view instantly (no animation delay)
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
    }
  }, [activeTabId]);

  // Keyboard Shortcuts (Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+W)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabId !== 'dashboard') {
          closeTab(activeTabId);
        }
      } else if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        const currentIdx = tabs.findIndex((t) => t.id === activeTabId);
        if (e.shiftKey) {
          const prevIdx = (currentIdx - 1 + tabs.length) % tabs.length;
          const prevTab = tabs[prevIdx];
          setActiveTabId(prevTab.id);
          navigate(prevTab.path);
        } else {
          const nextIdx = (currentIdx + 1) % tabs.length;
          const nextTab = tabs[nextIdx];
          setActiveTabId(nextTab.id);
          navigate(nextTab.path);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, tabs, closeTab, setActiveTabId, navigate]);

  const handleTabClick = (tab: WorkspaceTab) => {
    setActiveTabId(tab.id);
    navigate(tab.path);
  };

  const handleScroll = (dir: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = dir === 'left' ? -220 : 220;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'auto' });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, tab: WorkspaceTab) => {
    e.preventDefault();
    setContextTab(tab);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  // Drag and Drop handlers
  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    const reordered = [...tabs];
    const [moved] = reordered.splice(draggedIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    setTabs(reordered);
    setDraggedIdx(targetIdx);
  };

  const MAX_VISIBLE_TABS = 7;
  const visibleTabs = useMemo(() => {
    if (tabs.length <= MAX_VISIBLE_TABS) return tabs;
    
    // Ensure activeTab is always among visible tabs
    const activeIdx = tabs.findIndex((t) => t.id === activeTabId);
    if (activeIdx < MAX_VISIBLE_TABS) {
      return tabs.slice(0, MAX_VISIBLE_TABS);
    }
    
    // If active tab is past MAX_VISIBLE_TABS, include dashboard, first pinned, and activeTab
    const result = [tabs[0]]; // dashboard
    const remainingSlots = MAX_VISIBLE_TABS - 2;
    result.push(...tabs.slice(1, 1 + remainingSlots));
    if (!result.some((t) => t.id === activeTabId)) {
      result.push(tabs[activeIdx]);
    }
    return result;
  }, [tabs, activeTabId]);

  const hiddenTabs = useMemo(() => {
    if (tabs.length <= MAX_VISIBLE_TABS) return [];
    const visibleIds = new Set(visibleTabs.map((t) => t.id));
    return tabs.filter((t) => !visibleIds.has(t.id));
  }, [tabs, visibleTabs]);

  return (
    <div className="h-[42px] bg-[#f8fafc] border-b border-slate-200 px-2 flex items-center no-print shrink-0 select-none text-xs">
      {/* Scroll Right Button */}
      <button
        onClick={() => handleScroll('right')}
        className="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 bg-white hover:bg-slate-100 hover:text-slate-900 border border-slate-200 shrink-0 cursor-pointer shadow-2xs"
        title="تمرير لليمين"
      >
        <IconChevronRight size={15} strokeWidth={2.2} />
      </button>

      {/* Tabs Container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex items-end gap-1 overflow-x-auto no-scrollbar mx-1.5 h-full pt-1"
      >
        {visibleTabs.map((tab, idx) => {
          const isActive = activeTabId === tab.id;
          const Icon = iconMap[tab.id] || IconFileText;
          const isDashboard = tab.id === 'dashboard';

          return (
            <button
              key={tab.id}
              ref={isActive ? activeTabRef : null}
              draggable={!isDashboard}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onClick={() => handleTabClick(tab)}
              onContextMenu={(e) => handleContextMenu(e, tab)}
              className={`group relative px-3 flex items-center gap-2 cursor-pointer shrink-0 max-w-[210px] transition-all duration-150 ${
                isActive
                  ? 'h-[35px] bg-white text-orange-950 font-extrabold text-xs border-t-2 border-x border-slate-300 border-t-orange-600 rounded-t-lg shadow-xs z-10'
                  : 'h-[31px] bg-slate-100/90 text-slate-700 font-bold text-xs hover:bg-slate-200/80 hover:text-slate-950 border border-slate-200 rounded-t-md mb-0.5'
              }`}
            >
              {/* Pin Icon */}
              {tab.isPinned && <IconPin size={12} className={isActive ? 'text-orange-700 shrink-0' : 'text-slate-400 shrink-0'} />}

              {/* Tab Icon */}
              <div className={`flex items-center justify-center p-1 rounded-md shrink-0 ${isActive ? 'bg-orange-50 text-orange-700 border border-orange-200/60' : 'text-slate-500 group-hover:text-orange-700'}`}>
                <Icon size={14} />
              </div>

              {/* Tab Title */}
              <span className={`truncate leading-none ${isActive ? 'text-orange-950 font-black text-[12px]' : 'text-slate-700 font-bold text-[12px]'}`}>
                {tab.title}
              </span>

              {/* Unsaved changes dot */}
              {tab.hasUnsavedChanges && (
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="تغييرات غير محفوظة" />
              )}

              {/* Close button (only appears on hover) */}
              {tab.closable !== false && !tab.isPinned && !isDashboard && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 cursor-pointer opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-opacity duration-150"
                  title="إغلاق (Ctrl+W)"
                >
                  <IconX size={10} strokeWidth={2.5} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Overflow "More" Dropdown Menu when tabs exceed limit */}
      {hiddenTabs.length > 0 && (
        <Menu shadow="md" width={220} position="bottom-end">
          <Menu.Target>
            <button
              className="h-7 px-2 rounded-md flex items-center gap-1.5 text-xs font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 shrink-0 cursor-pointer shadow-2xs mr-1"
              title="المزيد من التبويبات"
            >
              <span>المزيد</span>
              <span className="bg-orange-600 text-white text-[10px] font-mono px-1 rounded-full">
                +{hiddenTabs.length}
              </span>
            </button>
          </Menu.Target>
          <Menu.Dropdown className="text-xs max-h-72 overflow-y-auto">
            <Menu.Label className="font-bold">تبويبات إضافية ({hiddenTabs.length})</Menu.Label>
            {hiddenTabs.map((t) => {
              const Icon = iconMap[t.id] || IconFileText;
              return (
                <Menu.Item
                  key={t.id}
                  leftSection={<Icon size={14} className={t.id === activeTabId ? 'text-orange-600' : 'text-slate-400'} />}
                  onClick={() => handleTabClick(t)}
                  className={t.id === activeTabId ? 'font-bold bg-orange-50/60' : ''}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="truncate">{t.title}</span>
                    {t.closable !== false && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(t.id);
                        }}
                        className="text-slate-400 hover:text-red-600 p-0.5 rounded"
                      >
                        <IconX size={11} />
                      </span>
                    )}
                  </div>
                </Menu.Item>
              );
            })}
          </Menu.Dropdown>
        </Menu>
      )}

      {/* Scroll Left Button */}
      <button
        onClick={() => handleScroll('left')}
        className="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 bg-white hover:bg-slate-100 hover:text-slate-900 border border-slate-200 shrink-0 cursor-pointer shadow-2xs"
        title="تمرير لليسار"
      >
        <IconChevronLeft size={15} strokeWidth={2.2} />
      </button>

      {/* Quick All Tabs Dropdown Menu */}
      <Menu shadow="md" width={220} position="bottom-end">
        <Menu.Target>
          <button
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 bg-white hover:bg-slate-100 hover:text-slate-900 border border-slate-200 shrink-0 cursor-pointer shadow-2xs mr-1"
            title="جميع التبويبات المفتوحة"
          >
            <IconDots size={15} strokeWidth={2.2} />
          </button>
        </Menu.Target>
        <Menu.Dropdown className="text-xs max-h-72 overflow-y-auto">
          <Menu.Label className="font-bold">التبويبات المفتوحة ({tabs.length})</Menu.Label>
          {tabs.map((t) => {
            const Icon = iconMap[t.id] || IconFileText;
            return (
              <Menu.Item
                key={t.id}
                leftSection={<Icon size={14} className={t.id === activeTabId ? 'text-orange-600' : 'text-slate-400'} />}
                onClick={() => handleTabClick(t)}
                className={t.id === activeTabId ? 'font-bold bg-orange-50/60' : ''}
              >
                <span className="truncate">{t.title}</span>
              </Menu.Item>
            );
          })}
          {tabs.length > 1 && (
            <>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<IconX size={14} />}
                onClick={() => closeAllTabs()}
                className="font-bold"
              >
                إغلاق جميع التبويبات
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>

      {/* Right-Click Context Menu */}
      {contextMenuPos && contextTab && (
        <Menu
          opened={true}
          onClose={() => {
            setContextMenuPos(null);
            setContextTab(null);
          }}
          shadow="md"
          width={200}
        >
          <Menu.Target>
            <div
              style={{
                position: 'fixed',
                top: contextMenuPos.y,
                left: contextMenuPos.x,
                width: 1,
                height: 1,
              }}
            />
          </Menu.Target>
          <Menu.Dropdown className="text-xs">
            <Menu.Label className="font-bold">{contextTab.title}</Menu.Label>
            <Menu.Item
              leftSection={<IconX size={14} />}
              disabled={contextTab.id === 'dashboard' || contextTab.isPinned}
              onClick={() => {
                closeTab(contextTab.id);
                setContextMenuPos(null);
              }}
            >
              إغلاق التبويب
            </Menu.Item>
            <Menu.Item
              leftSection={<IconX size={14} />}
              onClick={() => {
                closeOtherTabs(contextTab.id);
                setContextMenuPos(null);
              }}
            >
              إغلاق التبويبات الأخرى
            </Menu.Item>
            <Menu.Item
              leftSection={<IconX size={14} />}
              onClick={() => {
                closeTabsToRight(contextTab.id);
                setContextMenuPos(null);
              }}
            >
              إغلاق التبويبات إلى اليمين
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<IconX size={14} />}
              onClick={() => {
                closeAllTabs();
                setContextMenuPos(null);
              }}
            >
              إغلاق جميع التبويبات
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              leftSection={contextTab.isPinned ? <IconPinnedOff size={14} /> : <IconPin size={14} />}
              onClick={() => {
                togglePinTab(contextTab.id);
                setContextMenuPos(null);
              }}
            >
              {contextTab.isPinned ? 'إلغاء تثبيت التبويب' : 'تثبيت التبويب'}
            </Menu.Item>
            <Menu.Item
              leftSection={<IconRotate size={14} />}
              onClick={() => {
                window.location.reload();
                setContextMenuPos(null);
              }}
            >
              إعادة تحميل الشاشة
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </div>
  );
};
