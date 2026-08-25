import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { AccountingGrid, AccountingColumnDef } from '../components/common/AccountingGrid';
import { Badge, Paper } from '@mantine/core';
import { IconHistory, IconShieldCheck, IconUserCheck } from '@tabler/icons-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/audit-logs');
      setLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const columnDefs: AccountingColumnDef[] = [
    {
      field: 'createdAt',
      headerText: 'التاريخ والوقت',
      width: 'w-44',
      isPinned: true,
      render: (r) => (
        <span className="font-mono text-slate-700 text-[11px] tabular-nums">
          {new Date(r.createdAt).toLocaleString('ar-SA')}
        </span>
      ),
    },
    {
      field: 'user',
      headerText: 'المستخدم المنفذ',
      width: 'w-44',
      render: (r) => (
        <div className="flex items-center gap-1.5 font-bold text-slate-900">
          <IconUserCheck size={14} className="text-emerald-700" />
          <span>{r.user?.name || 'مدير النظام'}</span>
        </div>
      ),
    },
    {
      field: 'action',
      headerText: 'نوع العملية (Action)',
      width: 'w-40',
      align: 'center',
      render: (r) => (
        <Badge size="xs" color="emerald" variant="light">
          {r.action || 'إضافة / تعديل'}
        </Badge>
      ),
    },
    {
      field: 'entity',
      headerText: 'الكيان المالي',
      width: 'w-36',
      render: (r) => <span className="font-mono text-slate-700 font-bold">{r.entity || 'سند / قيد'}</span>,
    },
    {
      field: 'details',
      headerText: 'التفاصيل والمعلومات',
      isWide: true,
      render: (r) => (
        <span className="font-mono text-[11px] text-slate-600 truncate block max-w-[500px]">
          {typeof r.details === 'string' ? r.details : JSON.stringify(r.details || { note: 'عملية مالية مسجلة' })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3 w-full">
      <Paper p="xs" radius="sm" withBorder className="bg-white flex items-center justify-between no-print shadow-2xs">
        <div className="flex items-center gap-2">
          <IconHistory size={18} className="text-emerald-700" />
          <div>
            <h2 className="text-xs font-extrabold text-slate-900">سجل المراجعة والعمليات (Audit Logs)</h2>
            <p className="text-[11px] text-slate-500">تتبع دقيق وتوثيق محاسبي لجميع التعديلات والعمليات في النظام</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 text-xs text-emerald-800 font-bold">
          <IconShieldCheck size={16} />
          <span>حماية وتوثيق محاسبي كامل</span>
        </div>
      </Paper>

      <AccountingGrid
        gridKey="audit_logs_accounting_grid"
        title="سجل المراجعة والعمليات (Audit Logs Grid)"
        data={logs}
        columnDefs={columnDefs}
        loading={loading}
        onRefresh={fetchLogs}
      />
    </div>
  );
};
