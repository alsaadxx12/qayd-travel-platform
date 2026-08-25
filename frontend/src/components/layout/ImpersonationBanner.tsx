import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Badge } from '@mantine/core';
import { IconEyeCheck, IconLogout, IconShieldCheck } from '@tabler/icons-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useQueryClient } from '@tanstack/react-query';

export const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, user, impersonatedTenant, stopImpersonation } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!isImpersonating || !user) return null;

  const handleExitImpersonation = () => {
    stopImpersonation();
    queryClient.clear(); // Reset all query caches to reload admin data
    navigate('/saas-admin');
  };

  const isWildcard = user.permissions?.includes('*');

  return (
    <div
      dir="rtl"
      className="bg-gradient-to-r from-orange-600 via-[#F45A0A] to-amber-600 text-white px-4 py-2 text-xs font-black shadow-md border-b border-orange-700/50 flex items-center justify-between flex-wrap gap-2.5 relative z-50 animate-in slide-in-from-top duration-300"
    >
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
          <IconEyeCheck size={16} strokeWidth={2.5} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-black text-xs">
            وضع فحص الصلاحيات المباشر: أنت تتصفح النظام الآن بصفة مالك الشركة:
          </span>
          <span className="bg-white/20 px-2 py-0.5 rounded-md text-white font-black tracking-wide border border-white/30">
            {impersonatedTenant?.name || user.companyName}
          </span>
          <span className="text-orange-100 font-medium">
            (الحساب: {user.name} - {user.email})
          </span>
        </div>

        <div className="flex items-center gap-1.5 mr-2">
          {isWildcard ? (
            <Badge size="xs" variant="filled" color="teal" className="font-bold">
              صلاحيات شاملة (*)
            </Badge>
          ) : (
            <Badge size="xs" variant="filled" color="dark" className="font-mono font-bold tabular-nums">
              {user.permissions?.length || 0} صلاحية نشطة
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="xs"
          variant="white"
          color="orange"
          onClick={handleExitImpersonation}
          leftSection={<IconLogout size={14} />}
          className="h-7 px-3.5 rounded-xl font-black text-xs text-[#F45A0A] hover:bg-orange-50 shadow-xs transition-all"
        >
          إنهاء المحاكاة والعودة للوحة المنصة
        </Button>
      </div>
    </div>
  );
};

export default ImpersonationBanner;
