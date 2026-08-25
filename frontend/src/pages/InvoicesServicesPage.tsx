import React, { useState, useMemo, useEffect } from 'react';
import {
  Paper,
  Button,
  Badge,
  Modal,
  TextInput,
  Textarea,
  Select,
  SegmentedControl,
  Drawer,
} from '@mantine/core';
import {
  IconReceiptTax,
  IconPlus,
  IconDatabaseOff,
} from '@tabler/icons-react';
import { AccountingGrid, AccountingColumnDef } from '../components/common/AccountingGrid';
import { CurrencyRadioSelector } from '../components/common/CurrencyRadioSelector';

export const InvoicesServicesPage: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<string>('invoices');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('ALL');

  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Form State for Invoice Creation
  const [serviceType, setServiceType] = useState<string>('INDIVIDUAL_TICKET');
  const [customerName, setCustomerName] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('');
  const [ticketOrPnr, setTicketOrPnr] = useState<string>('');
  const [passengerName, setPassengerName] = useState<string>('');
  const [salePrice, setSalePrice] = useState<string>('0');
  const [costPrice, setCostPrice] = useState<string>('0');
  const [currency, setCurrency] = useState<string>('IQD');

  // Pure Real Invoices State (Starts clean, no mock dummy records)
  const [invoices, setInvoices] = useState<any[]>([]);

  const handleCreateInvoice = () => {
    if (!customerName || !ticketOrPnr) {
      alert('يرجى كتابة اسم العميل ورقم التذكرة/PNR.');
      return;
    }
    const sale = Number(salePrice) || 0;
    const cost = Number(costPrice) || 0;
    const newInv = {
      id: String(Date.now()),
      invoiceNumber: `INV-2026-${String(invoices.length + 1).padStart(4, '0')}`,
      date: new Date().toISOString().split('T')[0],
      branchName: 'الفرع الرئيسي',
      customerName,
      supplierName: supplierName || 'الخطوط الجوية العراقية',
      serviceTypeLabel: 'تذكرة طيران أفراد',
      pnr: ticketOrPnr,
      passengerName: passengerName || customerName,
      salePrice: sale,
      costPrice: cost,
      profit: sale - cost,
      currency,
      statusLabel: 'مقتطع ومرحل',
      status: 'POSTED',
    };
    setInvoices([newInv, ...invoices]);
    setCreateModalOpen(false);
    setCustomerName('');
    setTicketOrPnr('');
  };

  const invoiceCols: AccountingColumnDef[] = [
    { field: 'invoiceNumber', headerText: 'رقم الفاتورة', width: 'w-36', isPinned: true, render: (r) => <span className="font-mono font-bold text-emerald-800">{r.invoiceNumber}</span> },
    { field: 'date', headerText: 'التاريخ', width: 'w-24', align: 'center' },
    { field: 'branchName', headerText: 'الفرع', width: 'w-36' },
    { field: 'customerName', headerText: 'العميل', width: 'w-44', isPinned: true, render: (r) => <span className="font-bold text-slate-900">{r.customerName}</span> },
    { field: 'supplierName', headerText: 'المورد', width: 'w-36' },
    { field: 'serviceTypeLabel', headerText: 'نوع الخدمة', width: 'w-32' },
    { field: 'pnr', headerText: 'الـ PNR / المعرف', width: 'w-28', render: (r) => <span className="font-mono">{r.pnr}</span> },
    { field: 'passengerName', headerText: 'اسم المسافر', width: 'w-36' },
    { field: 'salePrice', headerText: 'سعر البيع', width: 'w-32', align: 'left', isMonetary: true, render: (r) => <span className="font-bold tabular-nums text-emerald-800">{r.salePrice.toLocaleString()} {r.currency}</span> },
    { field: 'profit', headerText: 'الربح', width: 'w-28', align: 'left', isMonetary: true, render: (r) => <span className="font-bold tabular-nums text-blue-800">{r.profit.toLocaleString()} {r.currency}</span> },
    { field: 'statusLabel', headerText: 'الحالة', width: 'w-28', align: 'center', render: (r) => <Badge size="xs" color="emerald">{r.statusLabel}</Badge> },
  ];

  return (
    <div className="space-y-3 w-full select-none text-xs">
      {/* 1. Header Toolbar */}
      <Paper p="xs" radius="sm" withBorder className="bg-white flex flex-wrap items-center justify-between gap-2 no-print shadow-2xs">
        <div className="flex items-center gap-2">
          <IconReceiptTax size={20} className="text-emerald-700 shrink-0" />
          <div>
            <h1 className="font-extrabold text-xs text-slate-900">فواتير الخدمات السياحية والمبيعات</h1>
            <p className="text-[10px] text-slate-500 font-medium">إصدار ومعالجة فواتير التذاكر، الفيز، الفنادق، المجموعات، والاسترجاعات</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="xs" color="emerald" leftSection={<IconPlus size={14} />} onClick={() => setCreateModalOpen(true)}>
            إصدار فاتورة جديدة
          </Button>
        </div>
      </Paper>

      {/* 2. Invoices List / Clean Empty State */}
      <Paper p="xs" radius="sm" withBorder className="bg-white shadow-2xs space-y-2">
        {invoices.length === 0 ? (
          <div className="py-12 text-center space-y-2 text-slate-500">
            <IconDatabaseOff size={32} className="mx-auto text-slate-400" />
            <p className="font-bold">لا توجد فواتير خدمات مسجلة في الوقت الحالي.</p>
            <p className="text-[11px] text-slate-400">اضغط على «إصدار فاتورة جديدة» لإصدار وتثبيت فاتورة سياحية.</p>
          </div>
        ) : (
          <AccountingGrid gridKey="invoices_services_grid" title="سجل الفواتير والمبيعات" data={invoices} columnDefs={invoiceCols} />
        )}
      </Paper>

      {/* 3. CREATE INVOICE MODAL */}
      <Modal opened={createModalOpen} onClose={() => setCreateModalOpen(false)} title="إصدار فاتورة خدمة سياحية جديدة" size="md">
        <div className="space-y-3 text-xs">
          <TextInput label="اسم العميل *" placeholder="شركة الأفق / علي المحمود" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <TextInput label="رقم الـ PNR / المعرف *" placeholder="PNR-99210" required value={ticketOrPnr} onChange={(e) => setTicketOrPnr(e.target.value)} />
          <TextInput label="شركة الطيران / المورد" placeholder="الخطوط العراقية" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          <CurrencyRadioSelector value={currency} onChange={setCurrency} />
          <div className="grid grid-cols-2 gap-2">
            <TextInput label={`سعر البيع (${currency}) *`} value={salePrice} onChange={(e) => setSalePrice(e.target.value)} type="number" />
            <TextInput label={`التكلفة (${currency}) *`} value={costPrice} onChange={(e) => setCostPrice(e.target.value)} type="number" />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="default" size="xs" onClick={() => setCreateModalOpen(false)}>إلغاء</Button>
            <Button color="emerald" size="xs" onClick={handleCreateInvoice}>إصدار وحفظ الفاتورة</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
