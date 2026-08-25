import React, { useState } from 'react';
import { Paper, Button, Badge, Modal, TextInput } from '@mantine/core';
import { IconRotate, IconPlus } from '@tabler/icons-react';
import { AccountingGrid, AccountingColumnDef } from '../../components/common/AccountingGrid';
import { CurrencyRadioSelector } from '../../components/common/CurrencyRadioSelector';
import { FormattedNumberInput } from '../../components/common/FormattedNumberInput';

export const ReissuesPage: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [currency, setCurrency] = useState('IQD');
  const [ticketNumber, setTicketNumber] = useState('');
  const [passenger, setPassenger] = useState('');
  const [fee, setFee] = useState('0');

  const [reissues, setReissues] = useState<any[]>([]);

  const handleSaveReissue = () => {
    if (!ticketNumber || !passenger) {
      alert('يرجى كتابة رقم التذكرة واسم المسافر.');
      return;
    }
    const newReissue = {
      id: String(Date.now()),
      number: `REI-2026-${String(reissues.length + 1).padStart(3, '0')}`,
      ticketNumber,
      passenger,
      airline: 'طيران الإمارات',
      fee: Number(fee) || 0,
      currency,
      status: 'مكتمـل',
    };
    setReissues([newReissue, ...reissues]);
    setModalOpen(false);
    setTicketNumber('');
    setPassenger('');
  };

  const columnDefs: AccountingColumnDef[] = [
    { field: 'number', headerText: 'رقم التنسيق', width: 'w-28', isPinned: true, render: (r) => <span className="font-bold text-emerald-800 tabular-nums">{r.number}</span> },
    { field: 'ticketNumber', headerText: 'رقم التذكرة الأحدث', width: 'w-36' },
    { field: 'passenger', headerText: 'اسم المسافر', width: 'w-36' },
    { field: 'airline', headerText: 'شركة الطيران', width: 'w-36' },
    { field: 'fee', headerText: 'رسوم التعديل والتغيير', width: 'w-32', isMonetary: true, render: (r) => <span className="font-bold tabular-nums text-emerald-800">{r.fee.toLocaleString()} {r.currency}</span> },
    { field: 'status', headerText: 'الحالة', width: 'w-20', align: 'center', render: (r) => <Badge size="xs" color="emerald">{r.status}</Badge> },
  ];

  return (
    <div className="space-y-3 w-full select-none">
      <Paper p="xs" radius="sm" withBorder className="bg-white space-y-2 no-print shadow-2xs">
        <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
          <div className="flex items-center gap-2">
            <IconRotate size={18} className="text-emerald-700" />
            <h1 className="font-extrabold text-xs text-slate-900">تغيير وإعادة إصدار التذاكر (Reissues)</h1>
          </div>

          <Button size="xs" color="emerald" leftSection={<IconPlus size={14} />} onClick={() => setModalOpen(true)}>
            طلب تغيير جديد
          </Button>
        </div>
      </Paper>

      <AccountingGrid gridKey="reissues_grid" title="سجل طلبات تغيير وتعديل التذاكر" data={reissues} columnDefs={columnDefs} />

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="طلب تغيير وإعادة إصدار تذكرة" size="md">
        <div className="space-y-3 text-xs">
          <TextInput label="رقم التذكرة *" placeholder="TKT-998877" required value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} />
          <TextInput label="اسم المسافر *" placeholder="مثال: علي جاسم" required value={passenger} onChange={(e) => setPassenger(e.target.value)} />
          <CurrencyRadioSelector value={currency} onChange={setCurrency} />
          <FormattedNumberInput label={`رسوم إعادة الإصدار والفرق (${currency}) *`} value={fee} onChange={setFee} />
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="default" size="xs" onClick={() => setModalOpen(false)}>إلغاء</Button>
            <Button color="emerald" size="xs" onClick={handleSaveReissue}>حفظ وإعادة الإصدار</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
