import React, { useState, useMemo } from 'react';
import { Menu, ActionIcon, Tooltip, Loader } from '@mantine/core';
import {
  IconBell,
  IconCheck,
  IconChecks,
  IconLifebuoy,
  IconTicket,
  IconFileText,
  IconSparkles,
  IconAlertTriangle,
  IconInfoCircle,
  IconAdjustmentsHorizontal,
  IconCircleCheck,
  IconTrash,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { notificationsApi, AppNotification } from '../../../api/notifications';
import { useLanguageStore } from '../../../store/useLanguageStore';

export const NotificationCenter: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD'>('ALL');

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['my-notifications'],
    queryFn: notificationsApi.getMyNotifications,
    refetchInterval: 2 * 60 * 1000, // 2 minutes — notifications are not urgent enough for 30s polling on a slow API
    staleTime: 60 * 1000,
  });

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'UNREAD') {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, activeTab]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
    },
  });

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return isAr ? 'الآن' : 'Just now';
      if (diffMins < 60) return isAr ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`;
      if (diffHours < 24) return isAr ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
      if (diffDays === 1) return isAr ? 'أمس' : 'Yesterday';
      return isAr ? `منذ ${diffDays} يوم` : `${diffDays} days ago`;
    } catch {
      return '';
    }
  };

  const getNotificationIcon = (n: AppNotification) => {
    switch (n.type) {
      case 'FEEDBACK_RESOLVED':
        return <IconLifebuoy size={20} strokeWidth={1.8} />;
      case 'TICKET':
        return <IconTicket size={20} strokeWidth={1.8} />;
      case 'ACCOUNTING':
        return <IconFileText size={20} strokeWidth={1.8} />;
      case 'SUBSCRIPTION':
        return <IconSparkles size={20} strokeWidth={1.8} />;
      case 'ALERT':
        return <IconAlertTriangle size={20} strokeWidth={1.8} />;
      default:
        if (n.severity === 'SUCCESS') return <IconCircleCheck size={20} strokeWidth={1.8} />;
        if (n.severity === 'WARNING') return <IconAlertTriangle size={20} strokeWidth={1.8} />;
        return <IconLifebuoy size={20} strokeWidth={1.8} />;
    }
  };

  return (
    <Menu shadow="xl" width={390} position="bottom-end" radius="20px" offset={10}>
      <Menu.Target>
        <div className="relative inline-block">
          <Tooltip label={isAr ? 'مركز الإشعارات والتنبيهات' : 'Notifications & Alerts'} position="bottom" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="md"
              className="h-[38px] w-[38px] rounded-xl hover:bg-slate-100/90 transition-colors cursor-pointer"
            >
              <IconBell size={19} className={unreadCount > 0 ? 'text-[#F45A0A]' : 'text-slate-600'} />
            </ActionIcon>
          </Tooltip>

          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#F45A0A] text-white font-bold text-[10px] rounded-full flex items-center justify-center shadow-xs ring-2 ring-white animate-pulse pointer-events-none font-mono">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </Menu.Target>

      <Menu.Dropdown
        className="text-xs select-none p-0 overflow-hidden rounded-3xl shadow-2xl border border-slate-200/90 font-sans bg-white"
        dir={direction}
      >
        {/* ── 1. HEADER (Title & Mark all read) ── */}
        <div className="p-4 pb-3 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-[16px] text-slate-900 tracking-tight">
              {isAr ? 'الإشعارات' : 'Notifications'}
            </h3>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-xs font-bold text-[#F45A0A] hover:text-[#DD4F05] flex items-center gap-1 cursor-pointer transition-colors hover:underline disabled:opacity-50"
              >
                <IconChecks size={15} strokeWidth={2.5} />
                <span>{isAr ? 'تحديد الكل كمقروء' : 'Mark all read'}</span>
              </button>
            )}
          </div>

          {/* ── 2. FILTER PILLS (All & Unread) ── */}
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-1 rounded-full font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isAr ? 'الكل' : 'All'}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('UNREAD')}
              className={`px-3.5 py-1 rounded-full font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'UNREAD'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{isAr ? 'غير مقروءة' : 'Unread'}</span>
              {unreadCount > 0 && (
                <span className="bg-[#F45A0A] text-white text-[10px] font-mono font-black px-1.5 py-0.5 rounded-full leading-none">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── 3. NOTIFICATION ITEMS LIST ── */}
        <div className="max-h-[380px] overflow-y-auto p-3 space-y-2.5 bg-slate-50/40 divide-y-0">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <Loader size="sm" color="orange" />
              <span className="text-xs font-semibold">{isAr ? 'جارٍ تحميل الإشعارات...' : 'Loading notifications...'}</span>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <IconCheck size={22} strokeWidth={2.5} />
              </div>
              <p className="font-bold text-xs text-slate-700">
                {activeTab === 'UNREAD'
                  ? (isAr ? 'لا توجد إشعارات غير مقروءة' : 'No unread notifications')
                  : (isAr ? 'لا توجد إشعارات حالياً' : 'No notifications yet')}
              </p>
              <p className="text-[11px] text-slate-400">
                {isAr ? 'ستظهر هنا التنبيهات ورسائل الدعم والعمليات' : 'Important updates and activity will appear here'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (!item.isRead) markReadMutation.mutate(item.id);
                  if (item.link) navigate(item.link);
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 relative group ${
                  !item.isRead
                    ? 'bg-[#FFFBF9] border-[#FED7AA]/70 hover:bg-[#FFF7ED] hover:border-[#F45A0A]/40 shadow-2xs'
                    : 'bg-white border-slate-100 hover:bg-slate-50/90'
                }`}
              >
                {/* Circular Orange Lifebuoy / Category Icon */}
                <div className="w-11 h-11 rounded-full bg-[#FFF1EB] text-[#F45A0A] border border-[#FED7AA] flex items-center justify-center shrink-0 shadow-2xs">
                  {getNotificationIcon(item)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className={`text-xs leading-tight truncate ${!item.isRead ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                      {item.title}
                    </h4>

                    {/* Unread Orange Dot */}
                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-[#F45A0A] shrink-0" />
                    )}
                  </div>

                  <p className="text-[11.5px] text-slate-500 leading-relaxed line-clamp-2 mt-1">
                    {item.message}
                  </p>

                  <span className="text-[10.5px] text-slate-400 font-medium mt-1.5 block">
                    {formatTime(item.createdAt)}
                  </span>
                </div>

                {/* Action on hover */}
                <div className="absolute top-2.5 end-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Tooltip label={isAr ? 'حذف' : 'Delete'} withArrow>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(item.id);
                      }}
                      aria-label={isAr ? 'حذف الإشعار' : 'Delete notification'}
                      className="w-6 h-6 rounded-lg bg-white/80 border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
                    >
                      <IconTrash size={13} />
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── 4. FOOTER (Notification Settings) ── */}
        <div className="p-3 bg-white border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="w-full py-1 text-slate-600 hover:text-slate-900 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <IconAdjustmentsHorizontal size={15} className="text-slate-400" />
            <span>{isAr ? 'إعدادات الإشعارات' : 'Notification settings'}</span>
          </button>
        </div>
      </Menu.Dropdown>
    </Menu>
  );
};

export default NotificationCenter;
