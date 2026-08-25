import React, { useState } from 'react';
import { Modal, Button, Textarea, Alert, Badge } from '@mantine/core';
import { IconLockOpen, IconAlertTriangle, IconHistory, IconCheck } from '@tabler/icons-react';
import { fiscalYearsApi, FiscalYear } from '../../api/fiscalYears';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';

interface ReopenYearModalProps {
  opened: boolean;
  onClose: () => void;
  fiscalYear: FiscalYear | null;
  onSuccess: () => void;
}

export const ReopenYearModal: React.FC<ReopenYearModalProps> = ({
  opened,
  onClose,
  fiscalYear,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReopen = async () => {
    if (!fiscalYear) return;
    if (!reason.trim()) {
      showErrorNotification('تنبيه إلزامي', 'يرجى كتابة سبب رسمي واضح لإعادة فتح السنة المالية.');
      return;
    }

    setLoading(true);
    try {
      await fiscalYearsApi.reopen(fiscalYear.id, reason.trim());
      showSuccessNotification(
        'تم إعادة فتح السنة المالية',
        `تم تحويل السنة المالية (${fiscalYear.name}) إلى حالة (معاد فتحها) وأخذ لقطة تدقيق للأرصدة بنجاح.`
      );
      setReason('');
      onSuccess();
      onClose();
    } catch (err: any) {
      showErrorNotification('فشل إعادة فتح السنة', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!fiscalYear) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="540px"
      centered
      radius="lg"
      title={
        <div className="flex items-center gap-2 font-black text-sm text-slate-900 font-['IBM_Plex_Sans_Arabic',sans-serif]">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
            <IconLockOpen size={18} />
          </div>
          <span>إعادة فتح السنة المالية ({fiscalYear.name})</span>
        </div>
      }
    >
      <div className="space-y-3.5 text-xs font-['IBM_Plex_Sans_Arabic',sans-serif]" dir="rtl">
        <Alert color="orange" title="تنبيه الأثر المحاسبي" icon={<IconAlertTriangle size={17} />}>
          <p className="text-xs leading-relaxed">
            سيتم أخذ <strong>لقطة تدقيق للأرصدة (Balance Snapshot)</strong> وحفظها بسجل التغييرات. أي حركة أو تعديل يتم داخل هذه السنة سيتطلب <strong>إعادة احتساب متسلسلة</strong> لتحديث القيد الافتتاحي للسنوات التالية.
          </p>
        </Alert>

        <div>
          <label className="block font-bold text-slate-700 mb-1 text-[11px]">
            السبب الإلزامي لطلب إعادة الفتح والتعديل *:
          </label>
          <Textarea
            size="xs"
            rows={3}
            placeholder="مثال: تسوية فروقات تدقيق الحسابات الختامية بموجب تقرير المدقق الخارجي رقم 402..."
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            required
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <Button size="xs" variant="default" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button
            size="xs"
            color="orange"
            loading={loading}
            leftSection={<IconLockOpen size={14} />}
            onClick={handleReopen}
            className="font-bold bg-[#F97316] hover:bg-[#EA580C] shadow-2xs"
          >
            تأكيد وإعادة فتح السنة الآن
          </Button>
        </div>
      </div>
    </Modal>
  );
};
