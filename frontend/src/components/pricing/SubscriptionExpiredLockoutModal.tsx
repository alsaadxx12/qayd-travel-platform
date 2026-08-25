import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal, Button, Badge } from '@mantine/core';
import { IconLock, IconAlertTriangle, IconReceipt, IconLogout } from '@tabler/icons-react';
import { useAuthStore } from '../../store/useAuthStore';
import { subscriptionsApi, PublicPlan } from '../../api/subscriptions';
import { SubscriptionCheckoutModal } from './SubscriptionCheckoutModal';

export const SubscriptionExpiredLockoutModal: React.FC = () => {
  const { user, logout } = useAuthStore();
  const [checkoutOpened, setCheckoutOpened] = useState(false);
  const [selectedPlanToRenew, setSelectedPlanToRenew] = useState<PublicPlan | null>(null);

  // If no user or tenant is root platform owner, no lockout
  const tenantId = user?.companyId;

  // 1. Fetch Tenant Subscription
  const { data: tenantSub, isLoading } = useQuery({
    queryKey: ['tenant-subscription', tenantId],
    queryFn: () => subscriptionsApi.getTenantSubscription(tenantId || ''),
    enabled: !!tenantId && tenantId !== 'default-company-id',
  });

  // 2. Fetch Public Plans to renew
  const { data: publicPlans = [] } = useQuery({
    queryKey: ['public-plans'],
    queryFn: subscriptionsApi.getPublicPlans,
  });

  if (!tenantSub || isLoading) return null;

  const isSuspended = tenantSub.status === 'SUSPENDED';
  const isCancelled = tenantSub.status === 'CANCELLED';
  const isExpired = tenantSub.currentPeriodEnd
    ? new Date(tenantSub.currentPeriodEnd).getTime() < new Date().getTime()
    : false;

  const isLocked = isSuspended || isCancelled || isExpired;

  if (!isLocked) return null;

  const handleOpenCheckout = () => {
    // Default to PRO or active plan
    const currentCode = tenantSub.planVersion?.plan?.code || 'PRO';
    const plan = publicPlans.find((p) => p.code === currentCode) || publicPlans[0] || null;
    setSelectedPlanToRenew(plan);
    setCheckoutOpened(true);
  };

  return (
    <>
      <Modal
        opened={isLocked}
        onClose={() => {}}
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        centered
        size="md"
        radius="2xl"
        overlayProps={{
          backgroundOpacity: 0.85,
          blur: 10,
        }}
      >
        <div className="text-center p-4 space-y-4 font-sans" dir="rtl">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-md ring-8 ring-red-50">
            <IconLock size={32} />
          </div>

          <div>
            <h3 className="text-lg font-black text-slate-900 leading-tight">
              تم إيقاف حساب المؤسسة لانتهاء الاشتراك
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              عزيزنا المشترك، انتهت فترة صلاحية باقة <strong>{tenantSub.planVersion?.plan?.nameAr}</strong> لمؤسستك، وتم قفل وظائف النظام مؤقتاً لجميع المستخدمين والموظفين.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-right text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">حالة الحساب:</span>
              <Badge color="red" size="xs" variant="filled" className="font-bold">
                {isSuspended ? 'معلق إدارياً' : 'منتهي الصلاحية'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">تاريخ انتهاء الباقة:</span>
              <span className="font-mono font-bold text-slate-800">
                {tenantSub.currentPeriodEnd ? new Date(tenantSub.currentPeriodEnd).toLocaleDateString('ar-IQ') : '—'}
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Button
              fullWidth
              color="orange"
              size="sm"
              leftSection={<IconReceipt size={16} />}
              onClick={handleOpenCheckout}
              className="bg-orange-500 hover:bg-orange-600 font-black rounded-xl h-10 shadow-xs"
            >
              تجديد الباقة وإرسال وصل التحويل فوراً
            </Button>

            <Button
              fullWidth
              variant="default"
              size="xs"
              leftSection={<IconLogout size={14} />}
              onClick={logout}
              className="rounded-xl"
            >
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </Modal>

      {/* Subscription Checkout Modal */}
      <SubscriptionCheckoutModal
        opened={checkoutOpened}
        onClose={() => setCheckoutOpened(false)}
        selectedPlan={selectedPlanToRenew}
      />
    </>
  );
};

export default SubscriptionExpiredLockoutModal;
