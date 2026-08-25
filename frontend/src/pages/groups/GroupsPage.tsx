import React, { useState } from 'react';
import { Paper, Button, Badge, Modal, TextInput } from '@mantine/core';
import { IconUsersGroup, IconPlus } from '@tabler/icons-react';
import { AccountingGrid, AccountingColumnDef } from '../../components/common/AccountingGrid';
import { CurrencyRadioSelector } from '../../components/common/CurrencyRadioSelector';
import { FormattedNumberInput } from '../../components/common/FormattedNumberInput';
import { getNextSequenceNumber } from '../../utils/sequenceUtils';

export const GroupsPage: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [currency, setCurrency] = useState('IQD');
  const [groupName, setGroupName] = useState('');
  const [passengerCount, setPassengerCount] = useState('20');
  const [salePrice, setSalePrice] = useState('0');
  const [costPrice, setCostPrice] = useState('0');

  const [groups, setGroups] = useState<any[]>([]);

  const handleSaveGroup = () => {
    if (!groupName) {
      alert('يرجى ادخال اسم الكروب / المجموعة.');
      return;
    }
    const sale = Number(salePrice) || 0;
    const cost = Number(costPrice) || 0;
    const newGroup = {
      id: String(Date.now()),
      number: getNextSequenceNumber('groups'),
      groupName,
      count: Number(passengerCount) || 1,
      agency: 'مكتب الرشيد',
      sale,
      cost,
      profit: sale - cost,
      currency,
      status: 'مكتمـل',
    };
    setGroups([newGroup, ...groups]);
    setModalOpen(false);
    setGroupName('');
  };

  const columnDefs: AccountingColumnDef[] = [
    { field: 'number', headerText: 'رمز المجموعة', width: 'w-28', isPinned: true, render: (r) => <span className="font-bold text-emerald-800 tabular-nums">{r.number}</span> },
    { field: 'groupName', headerText: 'اسم الكروب / الوجهة', width: 'w-44' },
    { field: 'count', headerText: 'عدد المسافرين', width: 'w-24', align: 'center', render: (r) => <Badge size="xs" color="gray">{r.count} شخص</Badge> },
    { field: 'agency', headerText: 'الوكيل / المكتب', width: 'w-36' },
    { field: 'sale', headerText: 'إجمالي المبيعات', width: 'w-32', isMonetary: true, render: (r) => <span className="font-bold tabular-nums text-emerald-800">{r.sale.toLocaleString()} {r.currency}</span> },
    { field: 'profit', headerText: 'الربح الإجمالي', width: 'w-28', isMonetary: true, render: (r) => <span className="font-bold tabular-nums text-blue-800">{r.profit.toLocaleString()} {r.currency}</span> },
    { field: 'status', headerText: 'الحالة', width: 'w-20', align: 'center', render: (r) => <Badge size="xs" color="emerald">{r.status}</Badge> },
  ];

  return (
    <div className="space-y-3 w-full select-none">
      <Paper p="xs" radius="sm" withBorder className="bg-white space-y-2 no-print shadow-2xs">
        <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
          <div className="flex items-center gap-2">
            <IconUsersGroup size={18} className="text-emerald-700" />
            <h1 className="font-extrabold text-xs text-slate-900">تذاكر الكروبات والمجموعات السياحية</h1>
          </div>

          <Button size="xs" color="emerald" leftSection={<IconPlus size={14} />} onClick={() => setModalOpen(true)}>
            إصدار تذكرة كروب جديدة
          </Button>
        </div>
      </Paper>

      <AccountingGrid gridKey="groups_grid" title="سجل مجموعات وتذاكر الكروبات السياحية" data={groups} columnDefs={columnDefs} />

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="إصدار تذكرة كروب جديدة" size="md">
        <div className="space-y-3 text-xs">
          <TextInput label="اسم الكروب / الرحلة *" placeholder="مثال: رحلة شرم الشيخ - شباط 2026" required value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          <TextInput label="عدد المقاعد / المسافرين *" value={passengerCount} onChange={(e) => setPassengerCount(e.target.value)} type="number" />
          <CurrencyRadioSelector value={currency} onChange={setCurrency} />
          <div className="grid grid-cols-2 gap-2">
            <FormattedNumberInput label={`إجمالي المبيعات (${currency}) *`} value={salePrice} onChange={setSalePrice} />
            <FormattedNumberInput label={`التكلفة الإجمالية (${currency}) *`} value={costPrice} onChange={setCostPrice} />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="default" size="xs" onClick={() => setModalOpen(false)}>إلغاء</Button>
            <Button color="emerald" size="xs" onClick={handleSaveGroup}>حفظ وإصدار الكروب</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
