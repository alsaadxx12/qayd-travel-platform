import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Badge,
  Modal,
  TextInput,
  Select,
  Checkbox,
  Tooltip,
  Alert,
} from '@mantine/core';
import {
  IconCalendar,
  IconPlus,
  IconLock,
  IconLockOpen,
  IconScale,
  IconHistory,
  IconRefresh,
  IconCheck,
  IconAlertTriangle,
  IconCalculator,
  IconCoins,
  IconTrash,
} from '@tabler/icons-react';
import { fiscalYearsApi, FiscalYear } from '../api/fiscalYears';
import { YearClosingWizardModal } from '../components/fiscal-years/YearClosingWizardModal';
import { ReopenYearModal } from '../components/fiscal-years/ReopenYearModal';
import { BalanceAuditLogModal } from '../components/fiscal-years/BalanceAuditLogModal';
import { ModernDatePicker } from '../components/common/ModernDatePicker';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';

export const FiscalYearsPage: React.FC = () => {
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [activeYear, setActiveYear] = useState<FiscalYear | null>(null);
  const [loading, setLoading] = useState(false);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [closingWizardYear, setClosingWizardYear] = useState<FiscalYear | null>(null);
  const [reopenModalYear, setReopenModalYear] = useState<FiscalYear | null>(null);
  const [auditLogYear, setAuditLogYear] = useState<FiscalYear | null>(null);

  // New Year Form
  const [newName, setNewName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newCurrency, setNewCurrency] = useState('IQD');
  const [newPreviousYearId, setNewPreviousYearId] = useState<string | null>(null);
  const [createMonthlyPeriods, setCreateMonthlyPeriods] = useState(true);
  const [isCurrent, setIsCurrent] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchYears = async () => {
    setLoading(true);
    try {
      const [yearsData, activeData] = await Promise.all([
        fiscalYearsApi.getAll(),
        fiscalYearsApi.getActive(),
      ]);
      if (Array.isArray(yearsData)) {
        setYears(yearsData);
      }
      if (activeData) {
        setActiveYear(activeData);
      }
    } catch (e: any) {
      console.error('Failed to load fiscal years', e);
      showErrorNotification('خطأ', e.message || 'تعذر تحميل السنوات المالية');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYears();
  }, []);

  const handleSetActive = async (year: FiscalYear) => {
    try {
      await fiscalYearsApi.setActive(year.id);
      setActiveYear(year);
      showSuccessNotification('تم التعيين', `تم تعيين السنة المالية (${year.name}) كسنة العمل النشطة.`);
      window.dispatchEvent(new CustomEvent('fiscal-year-updated', { detail: year }));
    } catch (e: any) {
      showErrorNotification('خطأ', e.message);
    }
  };

  const handleCreateYear = async () => {
    if (!newName.trim() || !newStartDate || !newEndDate) {
      showErrorNotification('تنبيه', 'يرجى ملء جميع الحقول الإلزامية للسنة المالية.');
      return;
    }

    setCreating(true);
    try {
      await fiscalYearsApi.create({
        name: newName.trim(),
        startDate: newStartDate,
        endDate: newEndDate,
        baseCurrency: newCurrency,
        previousYearId: newPreviousYearId || undefined,
        createMonthlyPeriods,
        isCurrent,
      });

      showSuccessNotification('تم بنجاح', `تم إنشاء السنة المالية (${newName}) مع الفترات المحاسبية.`);
      setCreateModalOpen(false);
      setNewName('');
      setNewStartDate('');
      setNewEndDate('');
      fetchYears();
      window.dispatchEvent(new CustomEvent('fiscal-year-updated'));
    } catch (e: any) {
      showErrorNotification('خطأ في الإنشاء', e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRecalculate = async (year: FiscalYear) => {
    try {
      const res = await fiscalYearsApi.recalculate(year.id);
      showSuccessNotification('تمت إعادة الاحتساب', res.message);
      fetchYears();
    } catch (e: any) {
      showErrorNotification('خطأ', e.message);
    }
  };

  const handleReclose = async (year: FiscalYear) => {
    const reason = window.prompt(`أدخل سبب إعادة إقفال السنة المالية (${year.name}):`, 'انتهاء التسويات والتدقيق النهائي');
    if (!reason) return;

    try {
      await fiscalYearsApi.reclose(year.id, reason);
      showSuccessNotification('تم الإقفال', `تمت إعادة إقفال السنة المالية (${year.name}) بنجاح.`);
      fetchYears();
      window.dispatchEvent(new CustomEvent('fiscal-year-updated'));
    } catch (e: any) {
      showErrorNotification('خطأ', e.message);
    }
  };

  const handleDeleteYear = async (year: FiscalYear) => {
    const confirmDelete = window.confirm(
      `هل أنت متأكد من حذف السنة المالية (${year.name}) بالكامل؟\n\nتنبيه: سيتم حذف الفترات المحاسبية المرتبطة وسجل التدقيق الخاص بها.`
    );
    if (!confirmDelete) return;

    try {
      const res = await fiscalYearsApi.delete(year.id);
      showSuccessNotification('تم الحذف بنجاح', res.message || `تم حذف السنة المالية (${year.name}).`);
      fetchYears();
      window.dispatchEvent(new CustomEvent('fiscal-year-updated'));
    } catch (e: any) {
      showErrorNotification('فشل الحذف', e.message || 'تعذر حذف السنة المالية');
    }
  };

  return (
    <div className="space-y-4 font-['IBM_Plex_Sans_Arabic',sans-serif] text-xs p-1" dir="rtl">
      {/* Header & Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-xs">
            <IconCalendar size={22} />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 m-0">
              إدارة السنوات والفترات المالية (Fiscal Years Management)
            </h1>
            <p className="text-[11px] text-slate-500 font-bold m-0">
              إنشاء السنوات، ضبط سنة العمل النشطة، معالج الإقفال والتدوير، وإعادة الفتح وسجل الأرصدة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="default"
            onClick={fetchYears}
            loading={loading}
            leftSection={<IconRefresh size={14} />}
            className="font-bold text-xs"
          >
            تحديث
          </Button>

          <Button
            size="xs"
            color="orange"
            onClick={() => {
              const currentYearNum = new Date().getFullYear();
              setNewName(String(currentYearNum + 1));
              setNewStartDate(`${currentYearNum + 1}-01-01`);
              setNewEndDate(`${currentYearNum + 1}-12-31`);
              setCreateModalOpen(true);
            }}
            leftSection={<IconPlus size={14} />}
            className="bg-[#F97316] hover:bg-[#EA580C] font-black text-xs shadow-xs"
          >
            + إنشاء سنة مالية جديدة
          </Button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold block">سنة العمل النشطة للمستخدم</span>
          <strong className="text-sm font-black text-slate-900 block mt-0.5">
            {activeYear ? `السنة المالية ${activeYear.name}` : 'غير محددة'}
          </strong>
          <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
            {activeYear?.status === 'OPEN' ? '✔ مفتوحة ونشطة' : activeYear?.status === 'REOPENED' ? '⚠️ معاد فتحها' : '🔒 مقفلة'}
          </span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold block">إجمالي السنوات المسجلة</span>
          <strong className="text-sm font-black text-slate-900 block mt-0.5 font-mono">
            {years.length} سنوات
          </strong>
          <span className="text-[10px] text-slate-400 font-bold block mt-0.5">في الشركة الحالية</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold block">السنوات المفتوحة</span>
          <strong className="text-sm font-black text-emerald-700 block mt-0.5 font-mono">
            {years.filter((y) => y.status === 'OPEN').length} سنوات
          </strong>
          <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">جاهزة لترحيل القيود</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold block">المعاد فتحها / المقفلة</span>
          <strong className="text-sm font-black text-amber-700 block mt-0.5 font-mono">
            {years.filter((y) => y.status === 'REOPENED').length} معاد فتحها • {years.filter((y) => y.status === 'CLOSED').length} مقفلة
          </strong>
          <span className="text-[10px] text-slate-400 font-bold block mt-0.5">تخضع لسجل التدقيق</span>
        </div>
      </div>

      {/* Years Management Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <Table striped highlightOnHover className="text-xs">
          <Table.Thead className="bg-slate-50 text-slate-700 font-extrabold">
            <Table.Tr>
              <Table.Th>السنة المالية</Table.Th>
              <Table.Th>تاريخ البداية والنهاية</Table.Th>
              <Table.Th>حالة السنة</Table.Th>
              <Table.Th>الفترات المحاسبية</Table.Th>
              <Table.Th>القيود المسجلة</Table.Th>
              <Table.Th className="text-center">إجراءات العمليات المحاسبية</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {years.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-8 text-slate-400 font-bold">
                  لا توجد سنوات مالية مسجلة
                </Table.Td>
              </Table.Tr>
            ) : (
              years.map((y) => {
                const isActive = y.id === activeYear?.id;
                const isReopened = y.status === 'REOPENED';
                const isClosed = y.status === 'CLOSED';

                return (
                  <Table.Tr key={y.id} className={isActive ? 'bg-orange-50/40' : ''}>
                    <Table.Td>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-sm font-black text-slate-900">{y.name}</strong>
                        {y.isCurrent && (
                          <Badge size="xs" color="emerald" variant="filled" className="text-[9px]">
                            السنة الحالية
                          </Badge>
                        )}
                        {isActive && (
                          <Badge size="xs" color="orange" variant="light" className="text-[9px] font-black">
                            سنة عملك النشطة ✔
                          </Badge>
                        )}
                      </div>
                    </Table.Td>

                    <Table.Td className="font-mono text-[11px] text-slate-600">
                      {new Date(y.startDate).toISOString().split('T')[0]} ↔ {new Date(y.endDate).toISOString().split('T')[0]}
                    </Table.Td>

                    <Table.Td>
                      <Badge
                        size="xs"
                        variant="filled"
                        color={
                          y.status === 'OPEN'
                            ? 'emerald'
                            : y.status === 'REOPENED'
                            ? 'orange'
                            : 'gray'
                        }
                        className="font-bold text-[10px]"
                      >
                        {y.status === 'OPEN' ? 'مفتوحة (Open)' : y.status === 'REOPENED' ? 'معاد فتحها (Reopened)' : 'مقفلة (Closed)'}
                      </Badge>
                    </Table.Td>

                    <Table.Td>
                      <span className="font-bold text-slate-700">
                        {y.openPeriods ?? 0} مفتوحة / {y.totalPeriods ?? 12} فترات
                      </span>
                    </Table.Td>

                    <Table.Td className="font-mono font-bold text-slate-800">
                      {y._count?.journalEntries ?? 0} قيد
                    </Table.Td>

                    <Table.Td>
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {/* Set Active Year Button */}
                        {!isActive && (
                          <Button
                            size="xs"
                            variant="light"
                            color="gray"
                            onClick={() => handleSetActive(y)}
                            className="font-bold text-[11px] h-6 px-2"
                            title="العمل ضمن هذه السنة وتعيينها في الجلسة"
                          >
                            تحديد كسنة عمل
                          </Button>
                        )}

                        {/* Year Closing & Rollover Wizard */}
                        {y.status === 'OPEN' && (
                          <Button
                            size="xs"
                            color="orange"
                            variant="light"
                            leftSection={<IconScale size={12} />}
                            onClick={() => setClosingWizardYear(y)}
                            className="font-black text-[11px] h-6 px-2 text-orange-800 bg-orange-50 hover:bg-orange-100 border border-orange-200"
                            title="بدء معالج الإقفال وتدوير الأرصدة للسنة الجديدة"
                          >
                            معالج الإقفال والتدوير
                          </Button>
                        )}

                        {/* Reopen Year Button */}
                        {isClosed && (
                          <Button
                            size="xs"
                            color="amber"
                            variant="light"
                            leftSection={<IconLockOpen size={12} />}
                            onClick={() => setReopenModalYear(y)}
                            className="font-black text-[11px] h-6 px-2 text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                            title="إعادة فتح السنة المالية للتعديل والتسوية"
                          >
                            إعادة فتح السنة
                          </Button>
                        )}

                        {/* Recalculate Cascading Balances */}
                        {isReopened && (
                          <>
                            <Button
                              size="xs"
                              color="indigo"
                              variant="light"
                              leftSection={<IconCalculator size={12} />}
                              onClick={() => handleRecalculate(y)}
                              className="font-black text-[11px] h-6 px-2 text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200"
                              title="إعادة احتساب الأرصدة وتحديث القيود الافتتاحية للسنوات التالية"
                            >
                              إعادة احتساب متسلسلة
                            </Button>

                            <Button
                              size="xs"
                              color="red"
                              variant="light"
                              leftSection={<IconLock size={12} />}
                              onClick={() => handleReclose(y)}
                              className="font-black text-[11px] h-6 px-2 text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200"
                              title="إعادة إقفال السنة بعد الانتهاء من التعديلات"
                            >
                              إعادة إقفال
                            </Button>
                          </>
                        )}

                        {/* Balance Audit Logs */}
                        <Button
                          size="xs"
                          variant="subtle"
                          color="dark"
                          leftSection={<IconHistory size={12} />}
                          onClick={() => setAuditLogYear(y)}
                          className="font-bold text-[11px] h-6 px-1.5"
                          title="عرض سجل تدقيق تغير الأرصدة"
                        >
                          سجل الأرصدة ({y._count?.balanceAuditLogs ?? 0})
                        </Button>

                        {/* Delete Year Button */}
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          leftSection={<IconTrash size={12} />}
                          onClick={() => handleDeleteYear(y)}
                          className="font-bold text-[11px] h-6 px-1.5 text-rose-600 hover:bg-rose-50"
                          title="حذف هذه السنة المالية"
                        >
                          حذف
                        </Button>
                      </div>
                    </Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </div>

      {/* ── CREATE NEW FISCAL YEAR MODAL ── */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={
          <div className="flex items-center gap-2 font-black text-sm text-slate-900 font-['IBM_Plex_Sans_Arabic',sans-serif]">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
              <IconPlus size={18} />
            </div>
            <div>
              <span>إنشاء سنة مالية جديدة (New Fiscal Year)</span>
              <span className="block text-[11px] text-slate-500 font-bold">
                تحديد نطاق التواريخ، توليد الفترات الشهرية، وضبط العملة
              </span>
            </div>
          </div>
        }
        size="lg"
        centered
        radius="lg"
      >
        <div className="space-y-4 text-xs font-['IBM_Plex_Sans_Arabic',sans-serif]" dir="rtl">
          {/* Quick Presets Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-600 block">
              ⚡ خيارات سريعة للتعبئة التلقائية (Quick Presets):
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[2025, 2026, 2027, 2028].map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => {
                    setNewName(String(yr));
                    setNewStartDate(`${yr}-01-01`);
                    setNewEndDate(`${yr}-12-31`);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    newName === String(yr)
                      ? 'bg-orange-500 text-white border-orange-600 shadow-2xs font-black'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-orange-50 hover:border-orange-200'
                  }`}
                >
                  سنة {yr} (كاملة)
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 text-[11px]">اسم / كود السنة المالية *:</label>
            <TextInput
              size="xs"
              placeholder="مثال: 2027"
              value={newName}
              onChange={(e) => setNewName(e.currentTarget.value)}
              className="font-mono font-bold"
            />
          </div>

          {/* Advanced Date Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ModernDatePicker
              label="تاريخ بداية السنة المالية"
              value={newStartDate}
              onChange={setNewStartDate}
              placeholder="اختر تاريخ البداية"
              required
            />

            <ModernDatePicker
              label="تاريخ نهاية السنة المالية"
              value={newEndDate}
              onChange={setNewEndDate}
              placeholder="اختر تاريخ النهاية"
              required
            />
          </div>

          {/* Date Duration Live Indicator */}
          {newStartDate && newEndDate && (
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-2 flex items-center justify-between text-[11px] font-bold text-emerald-900">
              <span>الفترة الزمنية المحددة:</span>
              <span className="font-mono">
                {Math.max(
                  0,
                  Math.round(
                    (new Date(newEndDate).getTime() - new Date(newStartDate).getTime()) /
                      (1000 * 60 * 60 * 24) +
                      1
                  )
                )}{' '}
                يوماً (سنة مالية كاملة ✔)
              </span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1 text-[11px]">السنة السابقة المرتبطة (اختياري للتدوير):</label>
            <Select
              size="xs"
              placeholder="اختر السنة السابقة للربط والتدوير..."
              clearable
              data={years.map((y) => ({ value: y.id, label: `السنة المالية ${y.name}` }))}
              value={newPreviousYearId}
              onChange={setNewPreviousYearId}
            />
          </div>

          {/* Options Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <div
              onClick={() => setCreateMonthlyPeriods((p) => !p)}
              className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-2.5 ${
                createMonthlyPeriods
                  ? 'bg-orange-50/60 border-orange-300'
                  : 'bg-slate-50 border-slate-200 opacity-75'
              }`}
            >
              <Checkbox
                checked={createMonthlyPeriods}
                onChange={(e) => setCreateMonthlyPeriods(e.currentTarget.checked)}
                size="xs"
                color="orange"
              />
              <div>
                <strong className="block text-slate-800 text-[11px]">توليد 12 فترة محاسبية</strong>
                <span className="text-[10px] text-slate-500">إنشاء الفترات الشهرية تلقائياً</span>
              </div>
            </div>

            <div
              onClick={() => setIsCurrent((c) => !c)}
              className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-2.5 ${
                isCurrent
                  ? 'bg-emerald-50/60 border-emerald-300'
                  : 'bg-slate-50 border-slate-200 opacity-75'
              }`}
            >
              <Checkbox
                checked={isCurrent}
                onChange={(e) => setIsCurrent(e.currentTarget.checked)}
                size="xs"
                color="emerald"
              />
              <div>
                <strong className="block text-slate-800 text-[11px]">سنة العمل الافتراضية</strong>
                <span className="text-[10px] text-slate-500">تعيينها كسنة حالية للنظام</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button size="xs" variant="default" onClick={() => setCreateModalOpen(false)} disabled={creating}>
              إلغاء
            </Button>
            <Button
              size="xs"
              color="orange"
              loading={creating}
              onClick={handleCreateYear}
              className="font-black bg-[#F97316] hover:bg-[#EA580C] shadow-xs px-4"
            >
              حفظ وإنشاء السنة المالية
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── CLOSING WIZARD MODAL ── */}
      <YearClosingWizardModal
        opened={!!closingWizardYear}
        onClose={() => setClosingWizardYear(null)}
        fiscalYear={closingWizardYear}
        onSuccess={fetchYears}
      />

      {/* ── REOPEN YEAR MODAL ── */}
      <ReopenYearModal
        opened={!!reopenModalYear}
        onClose={() => setReopenModalYear(null)}
        fiscalYear={reopenModalYear}
        onSuccess={fetchYears}
      />

      {/* ── BALANCE AUDIT LOG MODAL ── */}
      <BalanceAuditLogModal
        opened={!!auditLogYear}
        onClose={() => setAuditLogYear(null)}
        fiscalYear={auditLogYear}
      />
    </div>
  );
};
