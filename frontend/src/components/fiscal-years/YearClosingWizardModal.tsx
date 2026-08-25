import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Badge,
  Select,
  Textarea,
  TextInput,
  Progress,
  Alert,
  Table,
  Group,
  Stack,
  Divider,
  Loader,
} from '@mantine/core';
import {
  IconLock,
  IconCheck,
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconFileCertificate,
  IconScale,
  IconCoins,
  IconFileSpreadsheet,
  IconCalendar,
  IconAlertCircle,
  IconPrinter,
  IconSearch,
  IconListCheck,
  IconFilter,
} from '@tabler/icons-react';
import {
  fiscalYearsApi,
  FiscalYear,
  PreCheckResult,
  ClosingPreviewResult,
} from '../../api/fiscalYears';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';

interface YearClosingWizardModalProps {
  opened: boolean;
  onClose: () => void;
  fiscalYear: FiscalYear | null;
  onSuccess: () => void;
}

export const YearClosingWizardModal: React.FC<YearClosingWizardModalProps> = ({
  opened,
  onClose,
  fiscalYear,
  onSuccess,
}) => {
  const [activeStep, setActiveStep] = useState(1);
  const [loadingPreCheck, setLoadingPreCheck] = useState(false);
  const [preCheckData, setPreCheckData] = useState<PreCheckResult | null>(null);

  const [targetYearId, setTargetYearId] = useState<string>('');
  const [retainedAccountId, setRetainedAccountId] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ClosingPreviewResult | null>(null);
  const [searchAccountQuery, setSearchAccountQuery] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState<'ALL' | 'ACTIVE' | 'LEAF_ONLY' | 'PARENT_ONLY' | 'CLEARINGS' | 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'>('ALL');

  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    sourceYear: string;
    targetYear: string;
    closingEntryNumber: string;
    openingEntryNumber: string;
    netProfitOrLoss: number;
  } | null>(null);

  // Run Pre-Check when opened
  useEffect(() => {
    if (opened && fiscalYear) {
      setActiveStep(1);
      setExecutionResult(null);
      setClosingNotes('');
      setLoadingPreCheck(true);

      fiscalYearsApi
        .preCheckClosing(fiscalYear.id)
        .then((data) => {
          setPreCheckData(data);
          if (data.availableNextYears && data.availableNextYears.length > 0) {
            setTargetYearId(data.availableNextYears[0].id);
          }
          if (data.equityAccounts && data.equityAccounts.length > 0) {
            // Find retained earnings or first equity account
            const foundRetained =
              data.equityAccounts.find(
                (a) =>
                  a.nameAr.includes('أرباح') ||
                  a.nameAr.includes('محتجزة') ||
                  a.nameAr.includes('نتيجة') ||
                  a.code.startsWith('3')
              ) || data.equityAccounts[0];
            setRetainedAccountId(foundRetained.id);
          }
        })
        .catch((err) => {
          showErrorNotification('خطأ في الفحص المسبق', err.message);
        })
        .finally(() => {
          setLoadingPreCheck(false);
        });
    }
  }, [opened, fiscalYear]);

  // Load Preview when moving to Step 2
  const handleGoToPreview = async () => {
    if (!fiscalYear || !targetYearId || !retainedAccountId) {
      showErrorNotification('تنبيه', 'يرجى تحديد السنة المالية الهدف وحساب الأرباح المحتجزة.');
      return;
    }

    setLoadingPreview(true);
    try {
      const data = await fiscalYearsApi.previewClosing({
        fiscalYearId: fiscalYear.id,
        targetFiscalYearId: targetYearId,
        retainedEarningsAccountId: retainedAccountId,
      });
      setPreviewData(data);
      setActiveStep(2);
    } catch (err: any) {
      showErrorNotification('خطأ في توليد المعاينة', err.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Execute Closing
  const handleExecuteClosing = async () => {
    if (!fiscalYear || !targetYearId || !retainedAccountId) return;

    setExecuting(true);
    try {
      const res = await fiscalYearsApi.executeClosing({
        fiscalYearId: fiscalYear.id,
        targetFiscalYearId: targetYearId,
        retainedEarningsAccountId: retainedAccountId,
        notes: closingNotes,
      });

      setExecutionResult(res);
      setActiveStep(4);
      showSuccessNotification('تم الإقفال والتدوير بنجاح', `تم إقفال السنة المالية (${res.sourceYear}) وتدوير الأرصدة للسنة (${res.targetYear}) بنجاح.`);
      onSuccess();
    } catch (err: any) {
      showErrorNotification('فشل الإقفال السنوي', err.message);
    } finally {
      setExecuting(false);
    }
  };

  if (!fiscalYear) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="1380px"
      centered
      radius="xl"
      padding="lg"
      title={
        <div className="flex items-center gap-2.5 font-black text-sm text-slate-900 font-['IBM_Plex_Sans_Arabic',sans-serif]">
          <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
            <IconScale size={18} />
          </div>
          <div>
            <span>معالج الإقفال والتدوير السنوي (Year-End Closing Wizard)</span>
            <span className="block text-[11px] text-slate-500 font-bold">
              السنة المالية: {fiscalYear.name}
            </span>
          </div>
        </div>
      }
    >
      <div className="space-y-4 font-['IBM_Plex_Sans_Arabic',sans-serif] text-xs" dir="rtl">
        {/* Step Indicator Header */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
          <div className="flex items-center justify-between gap-2 text-center text-xs font-bold text-slate-600">
            <div className={`flex-1 p-1.5 rounded-lg ${activeStep === 1 ? 'bg-orange-500 text-white font-black shadow-xs' : activeStep > 1 ? 'text-emerald-700 font-black' : 'text-slate-400'}`}>
              <span>1. الفحص المسبق</span>
            </div>
            <span>←</span>
            <div className={`flex-1 p-1.5 rounded-lg ${activeStep === 2 ? 'bg-orange-500 text-white font-black shadow-xs' : activeStep > 2 ? 'text-emerald-700 font-black' : 'text-slate-400'}`}>
              <span>2. معاينة الأثر المالي وشجرة الحسابات</span>
            </div>
            <span>←</span>
            <div className={`flex-1 p-1.5 rounded-lg ${activeStep === 3 ? 'bg-orange-500 text-white font-black shadow-xs' : activeStep > 3 ? 'text-emerald-700 font-black' : 'text-slate-400'}`}>
              <span>3. تأكيد الإقفال</span>
            </div>
            <span>←</span>
            <div className={`flex-1 p-1.5 rounded-lg ${activeStep === 4 ? 'bg-emerald-600 text-white font-black shadow-xs' : 'text-slate-400'}`}>
              <span>4. شهادة الإقفال</span>
            </div>
          </div>
        </div>

        {/* ── STEP 1: PRE-CHECK ── */}
        {activeStep === 1 && (
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <span className="font-black text-xs text-slate-800 block">
                نتائج الفحص والتحقق المحاسبي المسبق:
              </span>

              {loadingPreCheck ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2">
                  <Loader size="sm" color="orange" />
                  <span className="text-slate-500 font-bold">جاري فحص ميزان المراجعة والقيود والفترات...</span>
                </div>
              ) : preCheckData ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className={`p-2.5 rounded-lg border ${preCheckData.isBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} text-center`}>
                      <span className="text-[10px] text-slate-500 font-bold block mb-0.5">توازن ميزان المراجعة</span>
                      <span className={`text-xs font-black ${preCheckData.isBalanced ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {preCheckData.isBalanced ? 'متوازن تماماً ✔' : 'غير متوازن ✖'}
                      </span>
                    </div>

                    <div className={`p-2.5 rounded-lg border ${preCheckData.draftEntriesCount === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} text-center`}>
                      <span className="text-[10px] text-slate-500 font-bold block mb-0.5">القيود غير المرحلة (Draft)</span>
                      <span className={`text-xs font-black ${preCheckData.draftEntriesCount === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {preCheckData.draftEntriesCount === 0 ? 'لا توجد (مرحلة بالكامل) ✔' : `${preCheckData.draftEntriesCount} قيد معلق ✖`}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg border bg-blue-50 border-blue-200 text-center">
                      <span className="text-[10px] text-slate-500 font-bold block mb-0.5">الفترات المفتوحة</span>
                      <span className="text-xs font-black text-blue-700">
                        {preCheckData.openPeriodsCount} فترة
                      </span>
                    </div>

                    <div className={`p-2.5 rounded-lg border ${preCheckData.canClose ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} text-center`}>
                      <span className="text-[10px] text-slate-500 font-bold block mb-0.5">إمكانية الإقفال</span>
                      <span className={`text-xs font-black ${preCheckData.canClose ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {preCheckData.canClose ? 'جاهز للإقفال ✔' : 'غير متاح حالياً ✖'}
                      </span>
                    </div>
                  </div>

                  {preCheckData.warnings.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {preCheckData.warnings.map((w, idx) => (
                        <div key={idx} className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold text-[11px] flex items-center gap-2">
                          <IconAlertTriangle size={14} className="text-amber-600 shrink-0" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100">
                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                      السنة المالية المستهدفة لتدوير الأرصدة الافتتاحية *:
                    </label>
                    <Select
                      size="xs"
                      placeholder="اختر السنة الجديدة..."
                      data={preCheckData.availableNextYears.map((y) => ({
                        value: y.id,
                        label: `السنة المالية ${y.name} (تبدأ: ${y.startDate.split('T')[0]})`,
                      }))}
                      value={targetYearId}
                      onChange={(val) => setTargetYearId(val || '')}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button size="xs" variant="default" onClick={onClose}>
                إلغاء
              </Button>
              <Button
                size="xs"
                color="orange"
                disabled={!preCheckData?.canClose || !targetYearId}
                loading={loadingPreview}
                rightSection={<IconArrowLeft size={13} />}
                onClick={handleGoToPreview}
                className="bg-[#F97316] hover:bg-[#EA580C] font-bold"
              >
                متابعة إلى معاينة الأثر المالي
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: PREVIEW WITH PRO TABLE & STAT CARDS ── */}
        {activeStep === 2 && previewData && (() => {
          const accountsList = previewData.allAccounts || [
            ...previewData.openingLinesPreview.map(l => ({
              accountId: l.accountId,
              accountCode: l.accountCode,
              accountName: l.accountName,
              type: l.type,
              typeLabelAr: l.type === 'ASSET' ? 'أصول وموجودات' : l.type === 'LIABILITY' ? 'خصوم والتزامات' : 'حقوق ملكية',
              currency: 'IQD',
              balance: l.closingBalance,
              balanceIQD: l.closingBalance,
              balanceUSD: 0,
              debit: l.debit,
              credit: l.credit,
              isParent: false,
              isExternalClearing: l.accountCode.startsWith('91'),
              action: 'ROLLOVER' as const,
              actionLabelAr: 'تدوير كرصيد افتتاحي للسنة الجديدة',
            })),
            ...previewData.closingLinesPreview.map(l => ({
              accountId: l.accountId,
              accountCode: l.accountCode,
              accountName: l.accountName,
              type: l.type,
              typeLabelAr: l.type === 'REVENUE' ? 'إيرادات' : 'مصروفات وتكاليف',
              currency: 'IQD',
              balance: l.balance,
              balanceIQD: l.balance,
              balanceUSD: 0,
              debit: l.action === 'DEBIT' ? l.amount : 0,
              credit: l.action === 'CREDIT' ? l.amount : 0,
              isParent: false,
              isExternalClearing: false,
              action: 'CLOSE_TO_RETAINED' as const,
              actionLabelAr: 'إقفال وتصفير في الأرباح المحتجزة',
            })),
          ];

          const filteredAccounts = accountsList.filter((acc: any) => {
            const matchesSearch =
              !searchAccountQuery ||
              acc.accountCode.toLowerCase().includes(searchAccountQuery.toLowerCase()) ||
              acc.accountName.toLowerCase().includes(searchAccountQuery.toLowerCase());

            if (!matchesSearch) return false;

            if (accountTypeFilter === 'ALL') return true;
            if (accountTypeFilter === 'ACTIVE') return Math.abs(acc.balance) > 0.001;
            if (accountTypeFilter === 'LEAF_ONLY') return !acc.isParent;
            if (accountTypeFilter === 'PARENT_ONLY') return acc.isParent;
            if (accountTypeFilter === 'CLEARINGS') return acc.isExternalClearing;
            if (accountTypeFilter === 'ASSET') return acc.type === 'ASSET' && !acc.isExternalClearing;
            if (accountTypeFilter === 'LIABILITY') return acc.type === 'LIABILITY';
            if (accountTypeFilter === 'EQUITY') return acc.type === 'EQUITY';
            if (accountTypeFilter === 'REVENUE') return acc.type === 'REVENUE';
            if (accountTypeFilter === 'EXPENSE') return acc.type === 'EXPENSE';
            return true;
          });

          const totalDebits = filteredAccounts.reduce((s, a) => s + (a.debit || (a.balance > 0 ? a.balance : 0)), 0);
          const totalCredits = filteredAccounts.reduce((s, a) => s + (a.credit || (a.balance < 0 ? Math.abs(a.balance) : 0)), 0);

          const totalClearingsCount = accountsList.filter((a: any) => a.isExternalClearing).length;
          const clearingsActive = accountsList.filter((a: any) => a.isExternalClearing && Math.abs(a.balance) > 0.001);
          const totalParentsCount = accountsList.filter((a: any) => a.isParent).length;
          const totalLeafsCount = accountsList.filter((a: any) => !a.isParent).length;

          const netProfitIQD = previewData.netProfitOrLossIQD ?? previewData.netProfitOrLoss;
          const netProfitUSD = previewData.netProfitOrLossUSD ?? 0;

          return (
            <div className="space-y-4">
              {/* ═══════════ DASHBOARD-STYLED STAT CARDS ═══════════ */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* 1. IQD Summary Stat Card */}
                <div className="bg-slate-50/80 rounded-xl border border-[#E5E7EB] p-3.5 transition-all hover:bg-white hover:border-emerald-300 hover:shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0 font-bold">
                      🇮🇶
                    </div>
                    <Badge size="sm" variant="light" color="emerald" className="font-bold font-mono text-[11px]">
                      IQD - دينار عراقي
                    </Badge>
                  </div>

                  <div className="text-[13px] font-bold text-slate-800 mb-1">
                    نتيجة أعمال الدينار ({previewData.sourceYear.name})
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 space-y-1.5 text-[12px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">إجمالي الإيرادات:</span>
                      <span className="font-bold text-emerald-800 font-mono tabular-nums" dir="ltr">
                        {Number(previewData.totalRevenuesIQD ?? previewData.totalRevenues).toLocaleString()} <span className="font-sans text-[10.5px] font-normal">د.ع</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">إجمالي المصروفات:</span>
                      <span className="font-bold text-rose-700 font-mono tabular-nums" dir="ltr">
                        {Number(previewData.totalExpensesIQD ?? previewData.totalExpenses).toLocaleString()} <span className="font-sans text-[10.5px] font-normal">د.ع</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-dashed border-slate-200">
                      <span className="text-slate-700 font-bold">صافي نتيجة العام:</span>
                      <span
                        dir="ltr"
                        className={`font-black font-mono text-sm tabular-nums ${
                          netProfitIQD >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {netProfitIQD >= 0 ? '+ ' : ''}
                        {netProfitIQD.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="font-sans text-[11px] font-normal">د.ع</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. USD Summary Stat Card */}
                <div className="bg-slate-50/80 rounded-xl border border-[#E5E7EB] p-3.5 transition-all hover:bg-white hover:border-blue-300 hover:shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-white border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 font-bold">
                      🇺🇸
                    </div>
                    <Badge size="sm" variant="light" color="blue" className="font-bold font-mono text-[11px]">
                      USD - دولار أمريكي
                    </Badge>
                  </div>

                  <div className="text-[13px] font-bold text-slate-800 mb-1">
                    نتيجة أعمال الدولار ({previewData.sourceYear.name})
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 space-y-1.5 text-[12px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">إجمالي الإيرادات:</span>
                      <span className="font-bold text-emerald-800 font-mono tabular-nums" dir="ltr">
                        ${Number(previewData.totalRevenuesUSD ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">إجمالي المصروفات:</span>
                      <span className="font-bold text-rose-700 font-mono tabular-nums" dir="ltr">
                        ${Number(previewData.totalExpensesUSD ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-dashed border-slate-200">
                      <span className="text-slate-700 font-bold">صافي نتيجة العام:</span>
                      <span
                        dir="ltr"
                        className={`font-black font-mono text-sm tabular-nums ${
                          netProfitUSD >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {netProfitUSD >= 0 ? '+ ' : ''}
                        ${netProfitUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. External Clearances Stat Card */}
                <div className="bg-slate-50/80 rounded-xl border border-[#E5E7EB] p-3.5 transition-all hover:bg-white hover:border-purple-300 hover:shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-white border border-purple-200 flex items-center justify-center text-purple-600 shrink-0 font-bold">
                      🔄
                    </div>
                    <Badge size="sm" variant="light" color="grape" className="font-bold font-mono text-[11px]">
                      {totalClearingsCount} حسابات تصفية
                    </Badge>
                  </div>

                  <div className="text-[13px] font-bold text-slate-800 mb-1">
                    التصفيات والمقاصات الخارجية
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 space-y-1.5 text-[12px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">الحسابات النشطة:</span>
                      <span className="font-bold text-purple-900 font-mono tabular-nums">
                        {clearingsActive.length} حساب نشط
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">نوع التدوير:</span>
                      <span className="font-bold text-slate-700">بورصات، مكاتب، ومقاصات</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-dashed border-slate-200">
                      <span className="text-slate-700 font-bold">حالة التدوير:</span>
                      <span className="font-bold text-emerald-700 flex items-center gap-1 text-[11.5px]">
                        ✔ تدوير كلي متعدد العملات
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══════════ ACCOUNTS TABLE CONTAINER ═══════════ */}
              <div className="border border-[#E5E7EB] rounded-xl bg-white p-3.5 space-y-3 shadow-2xs">
                {/* Search & Header Bar */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                      <IconListCheck size={16} />
                    </div>
                    <div>
                      <span className="font-black text-[13px] text-slate-900 block">
                        جدول ميزان كافة حسابات النظام وأثر التدوير:
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        معروض ({filteredAccounts.length}) من أصل ({accountsList.length}) حساب في شجرة الحسابات
                      </span>
                    </div>
                  </div>

                  <div className="w-72">
                    <TextInput
                      size="xs"
                      placeholder="بحث بكود أو اسم الحساب..."
                      leftSection={<IconSearch size={13} />}
                      value={searchAccountQuery}
                      onChange={(e) => setSearchAccountQuery(e.currentTarget.value)}
                    />
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
                  {[
                    { id: 'ALL', label: `كافة الحسابات (${accountsList.length})` },
                    { id: 'ACTIVE', label: `الأرصدة النشطة فقط (${accountsList.filter((a: any) => Math.abs(a.balance) > 0.001).length})` },
                    { id: 'LEAF_ONLY', label: `الحسابات الفرعية (${totalLeafsCount})` },
                    { id: 'PARENT_ONLY', label: `الحسابات الرئيسية (${totalParentsCount})` },
                    { id: 'CLEARINGS', label: `التصفيات الخارجية (${totalClearingsCount})` },
                    { id: 'ASSET', label: `الأصول (${accountsList.filter((a: any) => a.type === 'ASSET' && !a.isExternalClearing).length})` },
                    { id: 'LIABILITY', label: `الخصوم (${accountsList.filter((a: any) => a.type === 'LIABILITY').length})` },
                    { id: 'EQUITY', label: `حقوق الملكية (${accountsList.filter((a: any) => a.type === 'EQUITY').length})` },
                    { id: 'REVENUE', label: `الإيرادات (${accountsList.filter((a: any) => a.type === 'REVENUE').length})` },
                    { id: 'EXPENSE', label: `المصروفات (${accountsList.filter((a: any) => a.type === 'EXPENSE').length})` },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => setAccountTypeFilter(btn.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                        accountTypeFilter === btn.id
                          ? 'bg-[#F97316] text-white border-orange-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* Styled Professional Accounts Table */}
                <div className="overflow-x-auto overflow-y-auto max-h-[380px] border border-[#E5E7EB] rounded-xl">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-[#E5E7EB] font-bold text-slate-700 h-[38px] sticky top-0 z-20 text-[11.5px]">
                        <th className="py-2.5 px-3 border-l border-[#E5E7EB] w-28">كود الحساب</th>
                        <th className="py-2.5 px-3 border-l border-[#E5E7EB] min-w-[240px]">اسم الحساب</th>
                        <th className="py-2.5 px-3 border-l border-[#E5E7EB] w-36">التصنيف المحاسبي</th>
                        <th className="py-2.5 px-3 border-l border-[#E5E7EB] w-20 text-center">العملة</th>
                        <th className="py-2.5 px-3 border-l border-[#E5E7EB] w-32 text-left">الرصيد الختامي</th>
                        <th className="py-2.5 px-3 border-l border-[#E5E7EB] w-28 text-left">مدين (Debit)</th>
                        <th className="py-2.5 px-3 border-l border-[#E5E7EB] w-28 text-left">دائن (Credit)</th>
                        <th className="py-2.5 px-3 text-center w-52">الأثر المحاسبي للتدوير</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredAccounts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-10 text-slate-400 font-bold">
                            لا توجد حسابات مطابقة للبحث أو التصفية
                          </td>
                        </tr>
                      ) : (
                        filteredAccounts.map((acc: any) => {
                          const isRollover = acc.action === 'ROLLOVER';
                          const isClosePnl = acc.action === 'CLOSE_TO_RETAINED';
                          const isParentAcc = acc.isParent;
                          const hasBalance = Math.abs(acc.balance) > 0.001;
                          const isClearing = acc.isExternalClearing;
                          const isUSD = acc.currency === 'USD';

                          return (
                            <tr
                              key={acc.accountId}
                              className={`h-[38px] transition-colors ${
                                isParentAcc
                                  ? 'bg-slate-100/75 font-black text-slate-950'
                                  : hasBalance
                                  ? 'bg-amber-50/25 hover:bg-amber-50/40'
                                  : 'hover:bg-slate-50/80'
                              }`}
                            >
                              <td className="py-2 px-3 border-l border-[#E5E7EB] font-mono font-bold text-slate-900">
                                {acc.accountCode}
                              </td>

                              <td className="py-2 px-3 border-l border-[#E5E7EB]">
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-bold ${isParentAcc ? 'text-slate-950 font-black' : 'text-slate-800'}`}>
                                    {acc.accountName}
                                  </span>
                                  {isParentAcc && (
                                    <Badge size="xs" color="dark" variant="outline" className="text-[8.5px] font-bold">
                                      رئيسي
                                    </Badge>
                                  )}
                                  {isClearing && (
                                    <Badge size="xs" color="grape" variant="light" className="text-[8.5px] font-bold">
                                      تصفية خارجية
                                    </Badge>
                                  )}
                                </div>
                              </td>

                              <td className="py-2 px-3 border-l border-[#E5E7EB]">
                                <Badge
                                  size="xs"
                                  variant="light"
                                  color={
                                    isClearing
                                      ? 'grape'
                                      : acc.type === 'ASSET'
                                      ? 'blue'
                                      : acc.type === 'LIABILITY'
                                      ? 'red'
                                      : acc.type === 'EQUITY'
                                      ? 'purple'
                                      : acc.type === 'REVENUE'
                                      ? 'emerald'
                                      : 'orange'
                                  }
                                  className="font-bold text-[10px]"
                                >
                                  {acc.typeLabelAr}
                                </Badge>
                              </td>

                              <td className="py-2 px-3 border-l border-[#E5E7EB] text-center">
                                <Badge
                                  size="xs"
                                  variant={isUSD ? 'filled' : 'outline'}
                                  color={isUSD ? 'blue' : 'gray'}
                                  className="font-mono font-bold text-[9px]"
                                >
                                  {acc.currency || 'IQD'}
                                </Badge>
                              </td>

                              <td className="py-2 px-3 border-l border-[#E5E7EB] font-mono font-bold text-left tabular-nums">
                                <span className={acc.balance > 0 ? 'text-emerald-700' : acc.balance < 0 ? 'text-rose-700' : 'text-slate-400'}>
                                  {isUSD ? '$' : ''}
                                  {acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  {!isUSD ? ' د.ع' : ''}
                                </span>
                              </td>

                              <td className="py-2 px-3 border-l border-[#E5E7EB] font-mono font-bold text-left text-slate-700 tabular-nums">
                                {acc.debit > 0 ? acc.debit.toLocaleString() : '—'}
                              </td>

                              <td className="py-2 px-3 border-l border-[#E5E7EB] font-mono font-bold text-left text-slate-700 tabular-nums">
                                {acc.credit > 0 ? acc.credit.toLocaleString() : '—'}
                              </td>

                              <td className="py-2 px-3 text-center">
                                {isParentAcc ? (
                                  <Badge size="xs" color="gray" variant="dot" className="text-[10px] font-bold">
                                    حساب تجميعي
                                  </Badge>
                                ) : isRollover ? (
                                  <Badge size="xs" color={hasBalance ? 'emerald' : 'gray'} variant={hasBalance ? 'filled' : 'outline'} className="text-[10px] font-bold">
                                    {hasBalance ? `تدوير (${acc.balance > 0 ? 'مدين' : 'دائن'})` : 'تدوير (صفر)'}
                                  </Badge>
                                ) : isClosePnl ? (
                                  <Badge size="xs" color="orange" variant="light" className="text-[10px] font-bold">
                                    تصفير وإقفال إلى الأرباح
                                  </Badge>
                                ) : (
                                  <span className="text-slate-400 font-bold text-[10px]">رصيد صفري</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-[#CBD5E1] sticky bottom-0 z-20">
                      <tr className="h-[38px]">
                        <td colSpan={5} className="py-2 px-3 text-left font-black border-l border-[#E5E7EB]">
                          الإجمالي الكلي للحسابات المعروضة ({filteredAccounts.length}):
                        </td>
                        <td className="py-2 px-3 font-mono font-black text-left text-emerald-800 border-l border-[#E5E7EB] tabular-nums">
                          {totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 font-mono font-black text-left text-rose-800 border-l border-[#E5E7EB] tabular-nums">
                          {totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 font-bold text-[11px] text-emerald-700 text-center">
                          ✔ ميزان متوازن وجاهز للتدوير
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Bottom Navigation Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <Button size="xs" variant="default" leftSection={<IconArrowRight size={13} />} onClick={() => setActiveStep(1)}>
                  السابق
                </Button>
                <Button
                  size="xs"
                  color="orange"
                  rightSection={<IconArrowLeft size={13} />}
                  onClick={() => setActiveStep(3)}
                  className="bg-[#F97316] hover:bg-[#EA580C] font-bold"
                >
                  متابعة إلى خطوة التأكيد النهائي
                </Button>
              </div>
            </div>
          );
        })()}

        {/* ── STEP 3: CONFIRMATION ── */}
        {activeStep === 3 && (
          <div className="space-y-3.5">
            <Alert color="orange" title="تأكيد نهائي لعملية الإقفال السنوي والتدوير" icon={<IconAlertCircle size={18} />}>
              <p className="text-xs leading-relaxed">
                عند الضغط على <strong>«تأكيد وتنفيذ الإقفال النهائي»</strong>، سيقوم النظام بتوليد قيد الإقفال الختامي <code>JV-CLOSE-{fiscalYear.name}</code> وقيد تدوير الأرصدة الافتتاحية للسنة المالية الجديدة <code>JV-OPEN-{previewData?.targetYear.name}</code> وإقفال جميع فترات السنة الحالية لمنع أي تعديلات غير مصرح بها.
              </p>
            </Alert>

            <div>
              <label className="block font-bold text-slate-700 mb-1 text-[11px]">ملاحظات وتوثيق سبب الإقفال:</label>
              <Textarea
                size="xs"
                rows={2}
                placeholder="أدخل أي ملاحظات رسمية أو قرار مجلس الإدارة للإقفال السنوي..."
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.currentTarget.value)}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <Button size="xs" variant="default" leftSection={<IconArrowRight size={13} />} onClick={() => setActiveStep(2)}>
                السابق
              </Button>
              <Button
                size="xs"
                color="red"
                loading={executing}
                leftSection={<IconLock size={14} />}
                onClick={handleExecuteClosing}
                className="font-black bg-rose-600 hover:bg-rose-700 shadow-md"
              >
                تأكيد وتنفيذ الإقفال النهائي والتدوير الآن
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: SUCCESS CERTIFICATE ── */}
        {activeStep === 4 && executionResult && (
          <div className="space-y-4 text-center py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-md">
              <IconFileCertificate size={32} />
            </div>

            <div className="space-y-1">
              <h3 className="font-black text-base text-slate-900">تم إقفال وتدوير السنة المالية بنجاح تام!</h3>
              <p className="text-xs text-slate-500 font-bold">
                تم ترحيل وتدوير القيود والحسابات والأرصدة إلى السنة المالية ({executionResult.targetYear}).
              </p>
            </div>

            <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-xl p-3 text-right space-y-1.5 text-xs font-bold">
              <div className="flex justify-between border-b border-slate-200/80 pb-1">
                <span className="text-slate-500">رقم القيد الختامي:</span>
                <span className="font-mono text-slate-900">{executionResult.closingEntryNumber}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-1">
                <span className="text-slate-500">رقم القيد الافتتاحي المدور:</span>
                <span className="font-mono text-slate-900">{executionResult.openingEntryNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">صافي أرباح/خسائر العام:</span>
                <span className="font-mono text-emerald-800">{executionResult.netProfitOrLoss.toLocaleString()} IQD</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <Button size="xs" variant="default" onClick={() => window.print()} leftSection={<IconPrinter size={14} />}>
                طباعة شهادة الإقفال
              </Button>
              <Button size="xs" color="emerald" onClick={onClose} className="font-bold bg-emerald-600 hover:bg-emerald-700">
                إغلاق المعالج
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
