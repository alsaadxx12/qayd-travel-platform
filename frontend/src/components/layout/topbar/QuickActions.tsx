import React from 'react';
import { Button, Menu, ActionIcon } from '@mantine/core';
import {
  IconPlus,
  IconReceiptTax,
  IconArrowsExchange,
  IconChevronDown,
  IconDotsVertical,
  IconPrinter,
  IconFileSpreadsheet,
  IconArrowBackUp,
  IconCheck,
  IconShare,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { showSuccessNotification, showInfoNotification } from '../../../utils/notifications';

interface QuickActionsProps {
  onNewJournalEntry?: () => void;
  onOpenVoucherModal?: (type: 'RECEIPT' | 'PAYMENT') => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onNewJournalEntry,
  onOpenVoucherModal,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  // Context-Aware Actions matching current route!
  if (path === '/journal-entries') {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="xs"
          color="emerald"
          leftSection={<IconPlus size={14} />}
          onClick={onNewJournalEntry}
          className="h-[34px] font-bold cursor-pointer"
        >
          قيد جديد
        </Button>
        <Button
          size="xs"
          variant="outline"
          color="gray"
          leftSection={<IconCheck size={14} />}
          onClick={() => showSuccessNotification('ترحيل القيود', 'تم ترحيل القيود المحددة بنجاح.')}
          className="h-[34px] font-bold cursor-pointer text-slate-800"
        >
          ترحيل القيود
        </Button>
        <Button
          size="xs"
          variant="subtle"
          color="gray"
          leftSection={<IconPrinter size={14} />}
          onClick={() => window.print()}
          className="h-[34px] cursor-pointer"
        >
          طباعة
        </Button>
      </div>
    );
  }

  if (path === '/vouchers') {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <Menu shadow="md" width={170} position="bottom-start">
          <Menu.Target>
            <Button
              size="xs"
              color="emerald"
              leftSection={<IconReceiptTax size={14} />}
              rightSection={<IconChevronDown size={12} />}
              className="h-[34px] font-bold cursor-pointer"
            >
              سند جديد
            </Button>
          </Menu.Target>
          <Menu.Dropdown className="text-xs">
            <Menu.Item
              leftSection={<IconReceiptTax size={14} className="text-emerald-700" />}
              onClick={() => onOpenVoucherModal && onOpenVoucherModal('RECEIPT')}
            >
              سند قبض (Receipt)
            </Menu.Item>
            <Menu.Item
              leftSection={<IconReceiptTax size={14} className="text-rose-700" />}
              onClick={() => onOpenVoucherModal && onOpenVoucherModal('PAYMENT')}
            >
              سند دفع (Payment)
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        <Button
          size="xs"
          variant="outline"
          color="gray"
          leftSection={<IconArrowBackUp size={14} />}
          onClick={() => showInfoNotification('عكس السند', 'اختر السند الذي ترغب في عكسه من الجدول.')}
          className="h-[34px] font-bold cursor-pointer text-slate-800"
        >
          عكس السند
        </Button>

        <Button
          size="xs"
          variant="subtle"
          color="gray"
          leftSection={<IconPrinter size={14} />}
          onClick={() => window.print()}
          className="h-[34px] cursor-pointer"
        >
          طباعة
        </Button>
      </div>
    );
  }

  if (path === '/reports' || path === '/ledger' || path === '/trial-balance') {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="xs"
          color="emerald"
          leftSection={<IconFileSpreadsheet size={14} />}
          onClick={() => showInfoNotification('تصدير Excel', 'جاري تصدير التقرير المحاسبي إلى ملف Excel.')}
          className="h-[34px] font-bold cursor-pointer"
        >
          تصدير Excel
        </Button>
        <Button
          size="xs"
          variant="outline"
          color="gray"
          leftSection={<IconPrinter size={14} />}
          onClick={() => window.print()}
          className="h-[34px] font-bold cursor-pointer text-slate-800"
        >
          طباعة التقرير
        </Button>
        <Button
          size="xs"
          variant="subtle"
          color="gray"
          leftSection={<IconShare size={14} />}
          onClick={() => showInfoNotification('مشاركة', 'تم نسخ رابط التقرير المحاسبي للحافظة.')}
          className="h-[34px] cursor-pointer"
        >
          مشاركة
        </Button>
      </div>
    );
  }

  // Default Quick Actions for General Views
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {/* Primary Action Button */}
      <Button
        size="xs"
        color="emerald"
        leftSection={<IconPlus size={14} />}
        onClick={onNewJournalEntry}
        className="h-[34px] font-bold cursor-pointer"
      >
        قيد جديد
      </Button>

      {/* Neutral Action: Voucher Dropdown */}
      <Menu shadow="md" width={160} position="bottom-start">
        <Menu.Target>
          <Button
            size="xs"
            variant="outline"
            color="gray"
            leftSection={<IconReceiptTax size={14} />}
            rightSection={<IconChevronDown size={12} />}
            className="h-[34px] font-bold cursor-pointer text-slate-800"
          >
            سند جديد
          </Button>
        </Menu.Target>
        <Menu.Dropdown className="text-xs">
          <Menu.Item
            leftSection={<IconReceiptTax size={14} className="text-emerald-700" />}
            onClick={() => onOpenVoucherModal && onOpenVoucherModal('RECEIPT')}
          >
            سند قبض (Receipt)
          </Menu.Item>
          <Menu.Item
            leftSection={<IconReceiptTax size={14} className="text-rose-700" />}
            onClick={() => onOpenVoucherModal && onOpenVoucherModal('PAYMENT')}
          >
            سند دفع (Payment)
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {/* Neutral Action: Transfers */}
      <Button
        size="xs"
        variant="subtle"
        color="gray"
        leftSection={<IconArrowsExchange size={14} />}
        onClick={() => navigate('/transfers')}
        className="h-[34px] font-bold cursor-pointer text-slate-800 hidden md:flex"
      >
        تحويل مالي
      </Button>
    </div>
  );
};
