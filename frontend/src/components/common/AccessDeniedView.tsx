import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Badge } from '@mantine/core';
import {
  IconLock,
  IconShieldX,
  IconArrowRight,
  IconRefresh,
  IconHeadphones,
  IconLayoutDashboard,
} from '@tabler/icons-react';
import { useAuthStore } from '../../store/useAuthStore';

interface AccessDeniedViewProps {
  permissionCode?: string;
  moduleTitle?: string;
  onRefresh?: () => void;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  permissionCode,
  moduleTitle,
  onRefresh,
}) => {
  const navigate = useNavigate();
  const { user, refreshPermissions } = useAuthStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshPermissions();
      if (onRefresh) onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="max-w-[580px] w-full bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-10 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Icon Shield */}
        <div className="relative mx-auto w-20 h-20 rounded-3xl bg-[#FFF3E8] border-2 border-orange-200 flex items-center justify-center text-[#F45A0A] shadow-xs">
          <IconShieldX size={44} strokeWidth={2} />
          <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl bg-[#F45A0A] text-white border-2 border-white flex items-center justify-center shadow-xs">
            <IconLock size={15} strokeWidth={2.5} />
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black">
            <IconLock size={13} />
            <span>تم تقييد الوصول لهذه الصفحة</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
            {moduleTitle ? `لا تملك صلاحية الوصول إلى "${moduleTitle}"` : 'لا تملك الصلاحية للوصول إلى هذه الشاشة'}
          </h2>

          <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed max-w-[440px] mx-auto">
            تم تقييد هذه الشاشة أو إلغاء تفعيلها لحسابك من قبل مالك المنصة أو إدارة شركتك. إذا كنت تعتقد أن هذا خطأ، يرجى طلب منحك الصلاحية من المسؤول.
          </p>
        </div>

        {/* Meta Info Box */}
        <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-xs text-right space-y-2">
          <div className="flex items-center justify-between text-slate-600 font-bold">
            <span>الحساب الحالي:</span>
            <span className="text-slate-900 font-black">{user?.name || 'مستخدم'} ({user?.email || '—'})</span>
          </div>
          {permissionCode && (
            <div className="flex items-center justify-between text-slate-600 font-bold border-t border-slate-200/60 pt-1.5">
              <span>الصلاحية المطلوبة:</span>
              <Badge color="orange" variant="light" size="sm" className="font-mono font-black text-[11px] tracking-wide">
                {permissionCode}
              </Badge>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <Button
            size="sm"
            onClick={() => navigate('/dashboard')}
            leftSection={<IconLayoutDashboard size={16} />}
            className="w-full sm:w-auto h-11 px-5 rounded-2xl font-black text-xs bg-[#F45A0A] hover:bg-[#DD4F05] text-white shadow-xs transition-all"
          >
            العودة للوحة التحكم
          </Button>

          <Button
            size="sm"
            variant="default"
            onClick={handleRefresh}
            loading={isRefreshing}
            leftSection={<IconRefresh size={16} className={isRefreshing ? 'animate-spin' : ''} />}
            className="w-full sm:w-auto h-11 px-4 rounded-2xl font-black text-xs border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            تحديث الصلاحيات
          </Button>

          <Button
            size="sm"
            variant="subtle"
            color="gray"
            onClick={() => navigate('/feedback-tickets')}
            leftSection={<IconHeadphones size={16} />}
            className="w-full sm:w-auto h-11 px-3 rounded-2xl font-bold text-xs text-slate-600 hover:bg-slate-100"
          >
            طلب مساعدة
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AccessDeniedView;
