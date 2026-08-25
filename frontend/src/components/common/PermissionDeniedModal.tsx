import React, { useState } from 'react';
import { Modal, Button, Badge } from '@mantine/core';
import {
  IconLock,
  IconShieldX,
  IconRefresh,
  IconX,
  IconInfoCircle,
} from '@tabler/icons-react';
import { usePermissionAlertStore } from '../../store/usePermissionAlertStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguageStore } from '../../store/useLanguageStore';

export const PermissionDeniedModal: React.FC = () => {
  const { alertData, hidePermissionAlert } = usePermissionAlertStore();
  const { user, refreshPermissions } = useAuthStore();
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshPermissions();
      hidePermissionAlert();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Modal
      opened={alertData.isOpen}
      onClose={hidePermissionAlert}
      centered
      withCloseButton={false}
      radius="24px"
      padding={0}
      size="md"
      dir={direction}
      overlayProps={{
        backgroundOpacity: 0.55,
        blur: 4,
      }}
      styles={{
        content: {
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        },
      }}
    >
      <div className="p-6 text-center space-y-5 select-none font-sans" dir={direction}>
        {/* Top Floating Badge & Close Button */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-black">
            <IconLock size={12} strokeWidth={2.5} />
            <span>{isAr ? 'تقييد الصلاحيات' : 'Permission Restricted'}</span>
          </span>

          <button
            type="button"
            onClick={hidePermissionAlert}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            title={isAr ? 'إغلاق' : 'Close'}
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Shield Icon Badge */}
        <div className="relative mx-auto w-18 h-18 rounded-2xl bg-[#FFF3E8] border-2 border-orange-200/90 flex items-center justify-center text-[#F45A0A] shadow-xs">
          <IconShieldX size={38} strokeWidth={2.2} />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-[#F45A0A] text-white border-2 border-white flex items-center justify-center shadow-xs">
            <IconLock size={13} strokeWidth={2.5} />
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-1.5">
          <h2 className="text-lg md:text-xl font-black text-slate-950 tracking-tight leading-snug">
            {isAr ? 'تنبيه: غير مصرح بتنفيذ هذا الإجراء' : 'Access Denied: Action Restricted'}
          </h2>

          {alertData.actionTitle && (
            <p className="text-xs md:text-sm font-black text-[#F45A0A]">
              [{alertData.actionTitle}]
            </p>
          )}

          <p className="text-xs md:text-[13px] text-slate-600 font-bold leading-relaxed max-w-sm mx-auto pt-1">
            {alertData.description ||
              (isAr
                ? 'حسابك الحالي لا يمتلك الصلاحية الكافية لتنفيذ هذه العملية. يرجى مراجعة إدارة الشركة أو مالك المنصة لمنحك الصلاحية.'
                : 'Your current account does not have sufficient permissions to perform this operation. Please contact your company administrator.')}
          </p>
        </div>

        {/* Account & Permission Details Box */}
        <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 text-xs text-start space-y-2">
          <div className="flex items-center justify-between text-slate-600 font-bold">
            <span>{isAr ? 'الحساب الحالي:' : 'Current User:'}</span>
            <span className="text-slate-950 font-black truncate max-w-[200px]">
              {user?.name || (isAr ? 'مستخدم' : 'User')} ({user?.email || '—'})
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-600 font-bold border-t border-slate-200/70 pt-1.5">
            <span>{isAr ? 'الدور المسند:' : 'Assigned Role:'}</span>
            <Badge color="purple" variant="light" size="xs" className="font-bold">
              {user?.role || (isAr ? 'مستخدم' : 'User')}
            </Badge>
          </div>

          {alertData.permissionCode && (
            <div className="flex items-center justify-between text-slate-600 font-bold border-t border-slate-200/70 pt-1.5">
              <span className="flex items-center gap-1">
                <IconInfoCircle size={13} className="text-slate-400" />
                <span>{isAr ? 'كود الصلاحية المطلوب:' : 'Required Permission:'}</span>
              </span>
              <Badge color="orange" variant="light" size="sm" className="font-mono font-black text-[11px]">
                {alertData.permissionCode}
              </Badge>
            </div>
          )}
        </div>

        {/* Buttons Footer */}
        <div className="flex items-center justify-center gap-2.5 pt-1">
          <Button
            size="sm"
            onClick={hidePermissionAlert}
            className="flex-1 h-10 rounded-xl font-black text-xs bg-[#F45A0A] hover:bg-[#DD4F05] text-white shadow-xs cursor-pointer active:scale-98 transition-all"
          >
            {isAr ? 'فهمت ذلك / إغلاق' : 'Dismiss / Close'}
          </Button>

          <Button
            size="sm"
            variant="default"
            onClick={handleRefresh}
            loading={isRefreshing}
            leftSection={<IconRefresh size={15} className={isRefreshing ? 'animate-spin' : ''} />}
            className="h-10 px-3.5 rounded-xl font-bold text-xs border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {isAr ? 'تحديث الصلاحيات' : 'Refresh'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PermissionDeniedModal;
