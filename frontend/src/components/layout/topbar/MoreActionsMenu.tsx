import React from 'react';
import { Menu, ActionIcon } from '@mantine/core';
import { IconDotsVertical, IconPrinter, IconArrowsExchange, IconRefresh } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

export const MoreActionsMenu: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Menu shadow="md" width={180} position="bottom-start">
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="md" className="h-[36px] w-[36px]" title="إجراءات إضافية">
          <IconDotsVertical size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown className="text-xs select-none">
        <Menu.Item
          leftSection={<IconArrowsExchange size={14} />}
          onClick={() => navigate('/transfers')}
        >
          تحويل مالي بين الحسابات
        </Menu.Item>
        <Menu.Item
          leftSection={<IconPrinter size={14} />}
          onClick={() => window.print()}
        >
          طباعة الشاشة الحالية
        </Menu.Item>
        <Menu.Item
          leftSection={<IconRefresh size={14} />}
          onClick={() => window.location.reload()}
        >
          تحديث البيانات
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};
