import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  TextInput,
  Button,
  Badge,
  Paper,
  Textarea,
  SegmentedControl,
} from '@mantine/core';
import {
  IconSearch,
  IconPrinter,
  IconHistory,
  IconUser,
  IconClock,
  IconPlus,
  IconCheck,
  IconAlertCircle,
  IconArrowLeft,
  IconReceipt,
  IconShieldCheck,
  IconTrendingUp,
  IconTrendingDown,
  IconLock,
  IconLockOpen,
} from '@tabler/icons-react';
import { showSuccessNotification } from '../../utils/notifications';
import { useAuthStore } from '../../store/useAuthStore';

export interface FieldChange {
  fieldLabel: string;
  oldValue: string | number;
  newValue: string | number;
  category?: 'PRICE' | 'STATUS' | 'PASSENGER' | 'PAYMENT' | 'GENERAL';
}

export interface AuditLogItem {
  id: string;
  action: string;
  actionTitle: string;
  userName: string;
  userRole?: string;
  userEmail?: string;
  timestamp: string;
  ipAddress?: string;
  branchName?: string;
  changes?: FieldChange[];
  notes?: string;
}

interface InvoiceAuditLogModalProps {
  opened: boolean;
  onClose: () => void;
  ticketNumber?: string;
  pnr?: string;
  customerName?: string;
  initialLogs?: AuditLogItem[];
}

// ─── English DateTime Formatter Helper ───
export const formatEnglishDateTime = (val?: any): string => {
  if (!val) {
    const d = new Date();
    return formatEnglishDateTime(d);
  }

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    let hours = val.getHours();
    const minutes = String(val.getMinutes()).padStart(2, '0');
    const seconds = String(val.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const strHours = String(hours).padStart(2, '0');
    return `${year}-${month}-${day} ${strHours}:${minutes}:${seconds} ${ampm}`;
  }

  let str = String(val)
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/م/g, 'PM')
    .replace(/ص/g, 'AM')
    .replace(/،/g, '');

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return formatEnglishDateTime(parsed);
  }

  return str.trim();
};

// Helper to test if old value is meaningful (not 0, empty, or dummy)
const isMeaningfulOldValue = (oldVal: any, newVal: any): boolean => {
  if (oldVal === undefined || oldVal === null) return false;
  const sOld = String(oldVal).trim();
  const sNew = String(newVal).trim();
  if (sOld === sNew) return false;
  if (!sOld || sOld === '0' || sOld === 'IQD 0' || sOld === '0 IQD' || sOld === '$0' || sOld === '0$' || sOld === 'لا يوجد' || sOld === '—' || sOld === 'جديد') return false;
  return true;
};

export const InvoiceAuditLogModal: React.FC<InvoiceAuditLogModalProps> = ({
  opened,
  onClose,
  ticketNumber = '',
  pnr = '—',
  customerName = 'عميل نقدي',
  initialLogs,
}) => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [newNote, setNewNote] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);

  // Load REAL audit logs from localStorage or initialLogs
  useEffect(() => {
    if (!opened) return;
    if (initialLogs && initialLogs.length > 0) {
      setLogs(initialLogs);
      return;
    }

    if (ticketNumber) {
      try {
        const auditKey = `system_audit_logs_${ticketNumber}`;
        const stored: AuditLogItem[] = JSON.parse(localStorage.getItem(auditKey) || '[]');
        setLogs(stored);
      } catch (e) {
        setLogs([]);
      }
    } else {
      setLogs([]);
    }
  }, [opened, ticketNumber, initialLogs]);

  // Filter logs by search query and category
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterCategory === 'FINANCIAL' && log.action !== 'PRICE_CHANGE' && !log.changes?.some(c => c.category === 'PRICE')) return false;
      if (filterCategory === 'AUDIT' && log.action !== 'STATUS_CHANGE' && !log.changes?.some(c => c.category === 'STATUS')) return false;
      if (filterCategory === 'NOTES' && log.action !== 'NOTES_ADDED' && !log.notes) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        log.actionTitle.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        (log.notes && log.notes.toLowerCase().includes(q)) ||
        (log.changes && log.changes.some(
          (c) =>
            c.fieldLabel.toLowerCase().includes(q) ||
            String(c.oldValue).toLowerCase().includes(q) ||
            String(c.newValue).toLowerCase().includes(q)
        ))
      );
    });
  }, [logs, searchQuery, filterCategory]);

  const { user } = useAuthStore();

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const now = new Date();
    const englishTimestamp = formatEnglishDateTime(now);

    const newEntry: AuditLogItem = {
      id: `log-${Date.now()}`,
      action: 'NOTES_ADDED',
      actionTitle: 'إضافة ملاحظة توثيقية إدارية',
      userName: user?.name || 'علي جعفر محمود',
      userRole: user?.role || 'موظف حجز وتدقيق',
      timestamp: englishTimestamp,
      notes: newNote,
    };
    const updated = [newEntry, ...logs];
    setLogs(updated);

    if (ticketNumber) {
      try {
        localStorage.setItem(`system_audit_logs_${ticketNumber}`, JSON.stringify(updated));
      } catch (e) {}
    }

    setNewNote('');
    setShowAddNote(false);
    showSuccessNotification('تم الحفظ', 'تم إضافة الملاحظة الإدارية بنجاح إلى سجل التعديلات.');
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <Badge color="emerald" variant="filled" size="xs">إنشاء فاتورة</Badge>;
      case 'STATUS_CHANGE':
        return <Badge color="violet" variant="filled" size="xs" leftSection={<IconLock size={10} />}>تدقيق وقفل</Badge>;
      case 'PRICE_CHANGE':
        return <Badge color="amber" variant="filled" size="xs">تعديل سعر</Badge>;
      case 'UPDATE':
        return <Badge color="blue" variant="filled" size="xs">تعديل بيانات</Badge>;
      case 'NOTES_ADDED':
        return <Badge color="gray" variant="filled" size="xs">ملاحظة إدارية</Badge>;
      default:
        return <Badge color="indigo" variant="filled" size="xs">تعديل محاسبي</Badge>;
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5 dir-rtl">
          <div className="bg-orange-50 text-orange-600 p-1.5 rounded-lg border border-orange-200 shrink-0 shadow-2xs">
            <IconHistory size={18} />
          </div>
          <div>
            <h2 className="font-black text-sm text-slate-900 leading-tight">سجل التعديلات والعمليات</h2>
            <span className="text-[10px] text-slate-400 font-medium">سجل التدقيق الرقمي الموثق للفاتورة</span>
          </div>
        </div>
      }
      size="920px"
      padding="md"
      radius="lg"
      overlayProps={{ opacity: 0.45, blur: 3 }}
    >
      <div className="space-y-3 select-none text-xs dir-rtl">
        {/* ── 1. Top Header Info Bar ── */}
        <Paper p="xs" radius="md" withBorder className="bg-slate-50/90 text-slate-900 border-slate-200 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                <span className="text-slate-500 text-[11px] font-bold">الفاتورة:</span>
                <span className="font-mono font-black text-orange-700">
                  {ticketNumber || '—'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                <span className="text-slate-500 text-[11px] font-bold">PNR:</span>
                <span className="font-mono font-black text-slate-900">
                  {pnr || '—'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                <span className="text-slate-500 text-[11px] font-bold">العميل:</span>
                <span className="font-black text-slate-800">{customerName || 'عميل نقدي'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="xs"
                variant="filled"
                color="orange"
                leftSection={<IconPrinter size={14} />}
                onClick={() => window.print()}
                className="font-black bg-orange-600 hover:bg-orange-700 text-white shadow-2xs"
              >
                طباعة كشف التدقيق
              </Button>
              <Button
                size="xs"
                variant="light"
                color="orange"
                leftSection={<IconPlus size={14} />}
                onClick={() => setShowAddNote(!showAddNote)}
                className="font-black"
              >
                ملاحظة توثيقية
              </Button>
            </div>
          </div>
        </Paper>

        {/* ── 2. Add Note Section ── */}
        {showAddNote && (
          <Paper p="sm" radius="md" withBorder className="bg-orange-50/70 border-orange-200 space-y-2">
            <h4 className="font-black text-orange-950 text-xs flex items-center gap-1.5">
              <IconPlus size={14} className="text-orange-600" /> إضافة ملاحظة توثيقية لسجل الفاتورة
            </h4>
            <Textarea
              placeholder="اكتب ملاحظة أو توثيق محاسبي حول التعديل أو الفاتورة..."
              rows={2}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="bg-white"
            />
            <div className="flex justify-end gap-2">
              <Button size="xs" variant="default" onClick={() => setShowAddNote(false)} className="font-bold">
                إلغاء
              </Button>
              <Button size="xs" color="orange" onClick={handleAddNote} className="font-black bg-orange-600 hover:bg-orange-700 text-white">
                حفظ الملاحظة
              </Button>
            </div>
          </Paper>
        )}

        {/* ── 3. Filters & Search Bar ── */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <SegmentedControl
            size="xs"
            value={filterCategory}
            onChange={(v) => setFilterCategory(String(v))}
            data={[
              { label: `جميع الحركات (${logs.length})`, value: 'ALL' },
              { label: 'مالية 💰', value: 'FINANCIAL' },
              { label: 'تدقيق وقفل 🔒', value: 'AUDIT' },
              { label: 'ملاحظات 📝', value: 'NOTES' },
            ]}
            color="orange"
            className="shadow-2xs bg-slate-100 font-extrabold"
          />

          {logs.length > 0 && (
            <TextInput
              placeholder="بحث في السجل..."
              size="xs"
              leftSection={<IconSearch size={14} className="text-slate-400" />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56"
            />
          )}
        </div>

        {/* ── 4. Detailed History Timeline View ── */}
        <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <Paper p="xl" radius="md" withBorder className="bg-slate-50 border-slate-200 text-center py-10">
              <div className="w-12 h-12 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center mx-auto mb-2 text-orange-600 shadow-2xs">
                <IconShieldCheck size={24} />
              </div>
              <p className="font-black text-slate-800 text-xs">الفاتورة بحالتها الأصلية</p>
              <p className="text-[11px] text-slate-500 font-bold mt-1">لم يتم إجراء أي تعديلات أو تغييرات محاسبية على هذه الفاتورة بعد.</p>
            </Paper>
          ) : filteredLogs.length === 0 ? (
            <Paper p="lg" radius="md" withBorder className="bg-slate-50 border-slate-200 text-center py-8">
              <IconAlertCircle size={28} className="mx-auto text-slate-400 mb-2" />
              <p className="font-bold text-slate-700 text-xs">لا توجد حركات مطابقة لبحثك.</p>
            </Paper>
          ) : (
            filteredLogs.map((log, index) => {
              const versionLabel = `v1.${logs.length - index}`;
              const formattedTime = formatEnglishDateTime(log.timestamp);

              return (
                <Paper
                  key={log.id}
                  p="sm"
                  radius="md"
                  withBorder
                  className="bg-white border-slate-200 hover:border-slate-300 transition-colors shadow-2xs space-y-2.5"
                >
                  {/* Log Header Row */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-black bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                        {versionLabel}
                      </span>
                      {getActionBadge(log.action)}
                      <span className="font-black text-slate-900 text-xs">{log.actionTitle}</span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px]">
                      <div className="flex items-center gap-1 font-mono font-bold text-slate-700 dir-ltr">
                        <IconClock size={13} className="text-orange-600 shrink-0" />
                        <span>{formattedTime}</span>
                      </div>

                      <div className="flex items-center gap-1 font-bold text-slate-800">
                        <IconUser size={13} className="text-slate-400 shrink-0" />
                        <span>{log.userName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notes if available */}
                  {log.notes && (
                    <div className="bg-amber-50/80 border border-amber-200 rounded p-2 text-[11px] text-amber-900 font-medium flex items-start gap-1.5">
                      <IconAlertCircle size={14} className="text-amber-700 shrink-0 mt-0.5" />
                      <div>{log.notes}</div>
                    </div>
                  )}

                  {/* Detailed Field Comparison Table */}
                  {log.changes && log.changes.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-[11px] text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                            <th className="py-1 px-3 border-l border-slate-200">الحقل المعدّل</th>
                            <th className="py-1 px-3">بيانات الحقل والتعديل</th>
                          </tr>
                        </thead>
                        <tbody>
                          {log.changes.map((change, cIdx) => {
                            const hasOld = isMeaningfulOldValue(change.oldValue, change.newValue);
                            return (
                              <tr key={cIdx} className="border-b last:border-0 bg-white hover:bg-slate-50/50">
                                <td className="py-1.5 px-3 border-l border-slate-200 font-black text-slate-800 w-44">
                                  {change.fieldLabel}
                                </td>
                                <td className="py-1.5 px-3">
                                  {hasOld ? (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[10px] text-slate-400 font-medium">القيمة السابقة:</span>
                                      <span className="inline-block bg-rose-50 text-rose-800 font-mono px-2 py-0.5 rounded border border-rose-200 font-bold line-through">
                                        {String(change.oldValue)}
                                      </span>
                                      <span className="text-slate-400 font-bold">←</span>
                                      <span className="text-[10px] text-slate-400 font-medium">القيمة الجديدة:</span>
                                      <span className="inline-block bg-orange-50 text-orange-950 font-mono px-2 py-0.5 rounded border border-orange-300 font-black">
                                        {String(change.newValue)}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-slate-400 font-medium">القيمة المعتمدة:</span>
                                      <span className="inline-block bg-orange-50 text-orange-950 font-mono px-2.5 py-0.5 rounded border border-orange-200 font-black">
                                        {String(change.newValue)}
                                      </span>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Paper>
              );
            })
          )}
        </div>

        {/* ── 5. Enterprise Modal Footer ── */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 mt-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 text-slate-700 font-bold">
            <IconShieldCheck size={15} className="text-orange-600" />
            <span>نظام التدقيق الرقمي موثق ومطابق للمعايير المحاسبية</span>
          </div>
          <Button size="xs" variant="default" onClick={onClose} leftSection={<IconArrowLeft size={14} />} className="font-bold">
            إغلاق
          </Button>
        </div>
      </div>
    </Modal>
  );
};
