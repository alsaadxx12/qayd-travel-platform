import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAccountStatement, getDebtsReport } from '../api/reports';
import { apiRequest } from '../api/client';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useAuthStore } from '../store/useAuthStore';
import { AccountingGrid, AccountingColumnDef } from '../components/common/AccountingGrid';
import { AccountingDateRangePicker } from '../components/common/date/AccountingDateRangePicker';
import { AnimatedNumber } from '../components/common/AnimatedNumber';
import { DebtAmountTraceModal } from '../components/reports/DebtAmountTraceModal';
import { Paper, TextInput, Button, Badge, Switch, Modal, Radio, Group, Stack, Divider, Progress, Textarea, Menu, Loader } from '@mantine/core';
import {
  IconSearch,
  IconFileText,
  IconFileSpreadsheet,
  IconUser,
  IconPrinter,
  IconMail,
  IconDotsVertical,
  IconChevronDown,
  IconRoute,
  IconFileTypePdf,
  IconDownload,
  IconArchive,
  IconFileZip,
  IconFiles,
  IconX,
  IconCheck,
  IconAlertCircle,
  IconAlertTriangle,
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { PrintableAccountStatementSheet, StatementMovementItem } from '../components/reports/AccountStatementPrintModal';
import { fetchPrintTemplate } from '../api/printTemplates';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';
import { useAiPageContext } from '../hooks/useAiPageContext';

interface AccountDebtRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string | null;
  category?: string;
  type: string;
  debitUSD: number;
  creditUSD: number;
  endingBalanceUSD: number;
  debitIQD: number;
  creditIQD: number;
  endingBalanceIQD: number;
  totalDebit: number;
  totalCredit: number;
  endingBalance: number;
  debtType: 'receivable' | 'payable' | 'zero';
  debtLabel: string;
  accountCurrency: 'USD' | 'IQD';
}

export const DebtsReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { openTab } = useWorkspaceStore();
  const user = useAuthStore((s) => s.user);

  const { data: debtsReport, isLoading: loading, isError, refetch } = useQuery({
    queryKey: ['debts-report'],
    queryFn: getDebtsReport,
    staleTime: 30_000,
  });

  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter buttons mode: 'receivables' (ديون لنا) | 'payables' (ديون علينا) | 'all' (الكل)
  const [filterMode, setFilterMode] = useState<'receivables' | 'payables' | 'all'>('all');
  const [hideZeroBalances, setHideZeroBalances] = useState(true);

  // Page-level Currency display switches (default: both ON)
  const [pageShowUSD, setPageShowUSD] = useState(true);
  const [pageShowIQD, setPageShowIQD] = useState(true);

  // ── State for Bulk Batch Statement Export Modal ──
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchTarget, setBatchTarget] = useState<'ALL' | 'RECEIVABLES' | 'PAYABLES' | 'CUSTOM'>('ALL');
  const [customSelectedAccIds, setCustomSelectedAccIds] = useState<string[]>([]);
  const [includeOpening, setIncludeOpening] = useState(true);
  const [includePrevious, setIncludePrevious] = useState(true);
  const [hideZeroMovements, setHideZeroMovements] = useState(true);
  const [skipZeroBalanceAccounts, setSkipZeroBalanceAccounts] = useState(true);
  const [includeUSD, setIncludeUSD] = useState(true);
  const [includeIQD, setIncludeIQD] = useState(true);
  
  const [batchStartDate, setBatchStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [batchEndDate, setBatchEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatusText, setExportStatusText] = useState('');

  // ── State for Email Statement Modal ──
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedEmailAccountIds, setSelectedEmailAccountIds] = useState<string[]>([]);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('كشف حساب تفصيلي — نظام المحاسبة والذمم');
  const [emailBody, setEmailBody] = useState('مرحباً، تجدون برفقه كشف الحساب التفصيلي للذمم المالية للفترة المحددة.');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isExportChoiceModalOpen, setIsExportChoiceModalOpen] = useState(false);
  const [isTrackingEmailSending, setIsTrackingEmailSending] = useState(false);
  const [emailSendStatus, setEmailSendStatus] = useState<'sending' | 'completed' | 'failed'>('sending');
  const [emailStats, setEmailStats] = useState<{ sent: number; pending: number; failed: number; skipped: number; total: number }>({
    sent: 0,
    pending: 0,
    failed: 0,
    skipped: 0,
    total: 0,
  });

  const [printConfig, setPrintConfig] = useState<any>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [batchRenderState, setBatchRenderState] = useState<{
    accountName: string;
    accountCode: string;
    accountId: string;
    startDate: string;
    endDate: string;
    rows: StatementMovementItem[];
    totals: { totalDebit: number; totalCredit: number; finalBalance: number; openingBalance?: number; previousBalance?: number };
  } | null>(null);

  useEffect(() => {
    fetchPrintTemplate('statement')
      .then((res) => {
        if (res?.config) {
          setPrintConfig(res.config);
        }
      })
      .catch(() => {});
  }, []);

  const [debtContextMenu, setDebtContextMenu] = useState<{
    x: number;
    y: number;
    row: AccountDebtRow;
  } | null>(null);
  const [traceAccount, setTraceAccount] = useState<AccountDebtRow | null>(null);
  const [isTraceModalOpen, setIsTraceModalOpen] = useState(false);

  useAiPageContext({
    route: '/debts-report',
    entity: traceAccount ? 'account' : undefined,
    recordId: traceAccount?.id,
    label: traceAccount ? `${traceAccount.code} ${traceAccount.nameAr}` : undefined,
  });

  useEffect(() => {
    if (!debtContextMenu) return;
    const closeMenu = () => setDebtContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [debtContextMenu]);

  const debtRows = useMemo<AccountDebtRow[]>(() => debtsReport?.rows ?? [], [debtsReport]);

  // 3. Filtered Debt Rows based on user filter toggle mode, currency switches & search
  const filteredRows = useMemo(() => {
    return debtRows.filter(row => {
      // Currency Switch Filter:
      // If ONLY USD switch is active, filter for USD accounts
      if (pageShowUSD && !pageShowIQD && row.accountCurrency !== 'USD' && Math.abs(row.endingBalanceUSD) < 0.01) {
        return false;
      }
      // If ONLY IQD switch is active, filter for IQD accounts
      if (pageShowIQD && !pageShowUSD && row.accountCurrency !== 'IQD' && Math.abs(row.endingBalanceIQD) < 0.01) {
        return false;
      }

      if (hideZeroBalances && Math.abs(row.endingBalance) < 0.01) {
        return false;
      }

      if (filterMode === 'receivables' && row.debtType !== 'receivable') {
        return false;
      }
      if (filterMode === 'payables' && row.debtType !== 'payable') {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchCode = row.code.toLowerCase().includes(q);
        const matchName = row.nameAr.toLowerCase().includes(q);
        const matchEn = (row.nameEn || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchEn) return false;
      }

      return true;
    });
  }, [debtRows, filterMode, hideZeroBalances, searchQuery, pageShowUSD, pageShowIQD]);

  // 4. Calculated Summary Metrics (Separated USD vs IQD!)
  const summary = useMemo(() => {
    let usdReceivables = 0;
    let usdPayables = 0;
    let iqdReceivables = 0;
    let iqdPayables = 0;

    debtRows.forEach(r => {
      if (r.accountCurrency === 'IQD' || Math.abs(r.endingBalanceIQD) > 0.01) {
        if (r.endingBalanceIQD > 0.01) iqdReceivables += r.endingBalanceIQD;
        if (r.endingBalanceIQD < -0.01) iqdPayables += Math.abs(r.endingBalanceIQD);
      }
      if (r.accountCurrency === 'USD' || Math.abs(r.endingBalanceUSD) > 0.01) {
        if (r.endingBalanceUSD > 0.01) usdReceivables += r.endingBalanceUSD;
        if (r.endingBalanceUSD < -0.01) usdPayables += Math.abs(r.endingBalanceUSD);
      }
    });

    return {
      usdReceivables,
      usdPayables,
      netUSD: usdReceivables - usdPayables,
      iqdReceivables,
      iqdPayables,
      netIQD: iqdReceivables - iqdPayables,
    };
  }, [debtRows]);

  // Handle navigate to statement of account
  const handleOpenStatement = useCallback((account: AccountDebtRow) => {
    openTab({
      id: 'reports',
      title: 'كشف الحساب',
      path: `/reports?accountId=${account.id}`,
      closable: true,
    });
    navigate(`/reports?accountId=${account.id}`);
  }, [navigate, openTab]);

  const handleOpenAmountTrace = useCallback((account: AccountDebtRow) => {
    setDebtContextMenu(null);
    setTraceAccount(account);
    setIsTraceModalOpen(true);
  }, []);

  const handleDebtContextMenu = useCallback((event: React.MouseEvent, row: AccountDebtRow) => {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 260;
    const menuHeight = 154;
    const viewportPadding = 12;
    const x = Math.max(
      viewportPadding,
      Math.min(event.clientX, window.innerWidth - menuWidth - viewportPadding),
    );
    const y = Math.max(
      viewportPadding,
      Math.min(event.clientY, window.innerHeight - menuHeight - viewportPadding),
    );
    setDebtContextMenu({ x, y, row });
  }, []);

  // Export to Excel
  const handleExportExcel = () => {
    const dataToExport = filteredRows.map(r => ({
      'رقم الحساب': r.code,
      'اسم الحساب': r.nameAr,
      'نوع الدين': r.debtLabel,
      'إجمالي المدين': r.totalDebit,
      'إجمالي الدائن': r.totalCredit,
      'المبلغ الصافي': Math.abs(r.endingBalance),
      'الوضعية': r.endingBalance > 0 ? 'لنا' : r.endingBalance < 0 ? 'علينا' : 'متعادل',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير الديون');
    XLSX.writeFile(wb, `Debts_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    showSuccessNotification('تم التصدير', 'تم تصدير تقرير الديون بنجاح إلى ملف Excel.');
  };

  // ── Helper to calculate full statement data for a single account ──
  const generateAccountStatementData = useCallback(async (targetAcc: AccountDebtRow) => {
    const stmt = await getAccountStatement(targetAcc.id, batchStartDate, batchEndDate);
    const rawLines = (stmt.lines || []).map((line) => ({
      date: line.date,
      entryNumber: line.entryNumber || '—',
      voucherNumber: line.reference || '—',
      docType: 'قيد يومية',
      description: line.description || 'حركة حساب',
      debit: Number(line.debit || 0),
      credit: Number(line.credit || 0),
      runningBalance: Number(line.runningBalance || 0),
    }));
    const previousBalance = Number(stmt.openingBalance || 0);
    const closingBalance = includeOpening || includePrevious
      ? Number(stmt.closingBalance || 0)
      : rawLines.reduce((sum, line) => sum + line.debit - line.credit, 0);

    return {
      account: targetAcc,
      previousBalance,
      openingBalance: previousBalance,
      lines: rawLines,
      totalDebit: rawLines.reduce((sum, line) => sum + line.debit, 0),
      totalCredit: rawLines.reduce((sum, line) => sum + line.credit, 0),
      closingBalance,
    };
  }, [batchStartDate, batchEndDate, includeOpening, includePrevious]);

  // Get selected accounts based on user choice
  const getSelectedAccountsForBatch = useCallback(() => {
    let list = debtRows;
    if (batchTarget === 'RECEIVABLES') {
      list = debtRows.filter(r => r.debtType === 'receivable');
    } else if (batchTarget === 'PAYABLES') {
      list = debtRows.filter(r => r.debtType === 'payable');
    } else if (batchTarget === 'CUSTOM') {
      const setIds = new Set(customSelectedAccIds);
      list = debtRows.filter(r => setIds.has(r.id));
    }
    return list;
  }, [debtRows, batchTarget, customSelectedAccIds]);

  // Bulk Excel Export Handler with Progress Bar & direct download
  const handleExportBatchExcel = async () => {
    const targetAccounts = getSelectedAccountsForBatch();
    if (targetAccounts.length === 0) {
      showErrorNotification('تنبيه', 'يرجى اختيار حساب واحد على الأقل لتصدير الكشف.');
      return;
    }

    setIsGeneratingBatch(true);
    setExportProgress(10);
    setExportStatusText('جاري تجميع حركات الحسابات وفلترتها...');

    try {
      await new Promise(r => setTimeout(r, 200));
      const allRowsForExcel: any[] = [];

      for (let index = 0; index < targetAccounts.length; index++) {
        const acc = targetAccounts[index];
        const stmt = await generateAccountStatementData(acc);
        if (skipZeroBalanceAccounts && Math.abs(stmt.closingBalance) < 0.01) {
          return;
        }
        if (hideZeroMovements && stmt.lines.length === 0 && Math.abs(stmt.closingBalance) < 0.01) {
          return;
        }

        // Header block
        allRowsForExcel.push({
          'كود الحساب': `=== [${acc.code}] ${acc.nameAr} ===`,
          'تاريخ الحركة': '',
          'رقم القيد/المستند': '',
          'نوع المستند': '',
          'البيان والتوضيح': '',
          'مدين ($)': '',
          'دائن ($)': '',
          'الرصيد التراكمي ($)': '',
        });

        if (includeOpening || includePrevious) {
          allRowsForExcel.push({
            'كود الحساب': acc.code,
            'تاريخ الحركة': batchStartDate || '—',
            'رقم القيد/المستند': '—',
            'نوع المستند': 'رصيد افتتاحي/سابق',
            'البيان والتوضيح': 'الرصيد المدوّر السابق للفترة',
            'مدين ($)': stmt.previousBalance > 0 ? stmt.previousBalance : 0,
            'دائن ($)': stmt.previousBalance < 0 ? Math.abs(stmt.previousBalance) : 0,
            'الرصيد التراكمي ($)': stmt.previousBalance,
          });
        }

        stmt.lines.forEach(l => {
          allRowsForExcel.push({
            'كود الحساب': acc.code,
            'تاريخ الحركة': l.date ? new Date(l.date).toLocaleDateString('ar-EG') : '—',
            'رقم القيد/المستند': l.entryNumber || l.voucherNumber || '—',
            'نوع المستند': l.docType,
            'البيان والتوضيح': l.description,
            'مدين ($)': l.debit,
            'دائن ($)': l.credit,
            'الرصيد التراكمي ($)': l.runningBalance,
          });
        });

        // Summary row for account
        allRowsForExcel.push({
          'كود الحساب': acc.code,
          'تاريخ الحركة': 'مجموع الحساب',
          'رقم القيد/المستند': '',
          'نوع المستند': '',
          'البيان والتوضيح': `إجمالي حركة الفترة: ${stmt.lines.length} حركات`,
          'مدين ($)': stmt.totalDebit,
          'دائن ($)': stmt.totalCredit,
          'الرصيد التراكمي ($)': stmt.closingBalance,
        });

        allRowsForExcel.push({});

        const p = Math.min(85, 10 + Math.round(((index + 1) / targetAccounts.length) * 75));
        setExportProgress(p);
        setExportStatusText(`معالجة حساب ${index + 1} من ${targetAccounts.length} (${acc.nameAr})...`);
      }

      setExportProgress(90);
      setExportStatusText('جاري إنشاء وتحميل ملف Excel واختيار مكان الحفظ...');
      await new Promise(r => setTimeout(r, 300));

      const ws = XLSX.utils.json_to_sheet(allRowsForExcel);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الكشوفات المجمعة');
      XLSX.writeFile(wb, `Batch_Statements_${new Date().toISOString().split('T')[0]}.xlsx`);

      setExportProgress(100);
      setExportStatusText('تم التصدير وتحميل الملف بنجاح! 🚀');

      setTimeout(() => {
        setIsGeneratingBatch(false);
        setIsBatchModalOpen(false);
        showSuccessNotification('تم التصدير بنجاح', `تم تصدير كشوفات الحسابات المجمعة في ملف Excel بنجاح.`);
      }, 600);
      } catch {
      showErrorNotification('خطأ في التصدير', 'حدث خطأ أثناء إنشاء ملف Excel المجمع.');
      setIsGeneratingBatch(false);
    }
  };

  // Static Header Export Button Handler
  const handleStaticExportClick = () => {
    if (selectedAccountIds.size === 0) {
      showErrorNotification(
        'تنبيه — لم يتم تحديد حسابات',
        'يجب تحديد حساب واحد على الأقل من الجدول عبر مفتاح التشغيل للتصدير أو الإرسال.'
      );
      return;
    }
    setIsExportChoiceModalOpen(true);
  };

  // Bulk PDF Export Handler: Generates real official PDF files using the approved Account Statement template!
  const handleExportBatchZipPDF = async (overrideSelectedIds?: string[]) => {
    const idsToUse = overrideSelectedIds && overrideSelectedIds.length > 0
      ? overrideSelectedIds
      : Array.from(selectedAccountIds);

    if (idsToUse.length === 0) {
      showErrorNotification(
        'تنبيه — لم يتم تحديد حسابات',
        'يجب تحديد حساب واحد على الأقل من الجدول عبر مفتاح التشغيل للتصدير.'
      );
      return;
    }

    const targetAccounts = debtRows.filter(r => idsToUse.includes(r.id));
    if (targetAccounts.length === 0) {
      showErrorNotification(
        'تنبيه — لم يتم تحديد حسابات',
        'يجب تحديد حساب واحد على الأقل من الجدول عبر مفتاح التشغيل للتصدير.'
      );
      return;
    }

    setIsGeneratingBatch(true);
    setExportProgress(5);
    setExportStatusText('جاري بدء إنشاء ملفات PDF الرسمية...');

    try {
      const zip = new JSZip();
      let processedCount = 0;

      for (let i = 0; i < targetAccounts.length; i++) {
        const acc = targetAccounts[i];
        const percent = Math.min(90, 5 + Math.round(((i + 1) / targetAccounts.length) * 85));
        setExportProgress(percent);
        setExportStatusText(`جاري إنشاء كشف PDF للحساب (${i + 1} من ${targetAccounts.length}): ${acc.nameAr}...`);

        const stmt = await getAccountStatement(acc.id, batchStartDate, batchEndDate);
        const rawLines: StatementMovementItem[] = (stmt.lines || []).map((line, idx) => ({
          rowNumber: idx + 1,
          date: line.date,
          docRef: line.entryNumber || line.reference || '—',
          docLabel: line.voucherType || 'قيد يومية',
          statement: line.description || 'حركة حساب',
          debit: Number(line.debit || 0),
          credit: Number(line.credit || 0),
          runningBalance: Number(line.runningBalance || 0),
          currency: acc.accountCurrency || 'IQD',
        }));

        const previousBalance = Number(stmt.openingBalance || 0);
        const closingBalance = includeOpening || includePrevious
          ? Number(stmt.closingBalance || 0)
          : rawLines.reduce((sum, line) => sum + line.debit - line.credit, 0);

        if (skipZeroBalanceAccounts && Math.abs(closingBalance) < 0.01) {
          continue;
        }
        if (hideZeroMovements && rawLines.length === 0 && Math.abs(closingBalance) < 0.01) {
          continue;
        }

        const totals = {
          totalDebit: rawLines.reduce((sum, line) => sum + line.debit, 0),
          totalCredit: rawLines.reduce((sum, line) => sum + line.credit, 0),
          finalBalance: closingBalance,
          openingBalance: previousBalance,
          previousBalance: previousBalance,
        };

        // Render sheet in DOM mount
        setBatchRenderState({
          accountName: acc.nameAr,
          accountCode: acc.code,
          accountId: acc.id,
          startDate: batchStartDate || 'البداية',
          endDate: batchEndDate || new Date().toISOString().split('T')[0],
          rows: rawLines,
          totals,
        });

        // Small tick to ensure React commits DOM updates
        await new Promise((r) => setTimeout(r, 70));

        const element = document.getElementById('batch-printable-sheet') || document.getElementById('printable-statement-sheet');
        if (!element) {
          continue;
        }

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        const safeName = acc.nameAr.replace(/[/\\?%*:|"<>]/g, '_').trim();
        const pdfBlob = pdf.output('blob');

        if (targetAccounts.length === 1) {
          pdf.save(`كشف_حساب_${safeName}_${acc.code}.pdf`);
          processedCount++;
        } else {
          zip.file(`كشف_حساب_${safeName}_${acc.code}.pdf`, pdfBlob);
          processedCount++;
        }
      }

      if (processedCount === 0) {
        showErrorNotification('تنبيه', 'لم يتم العثور على أي حركات أو أرصدة للحسابات المختارة وفق شروط التصفية.');
        return;
      }

      if (targetAccounts.length > 1) {
        setExportProgress(95);
        setExportStatusText('جاري ضغط ملفات PDF وتجهيز ملف ZIP...');

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const downloadUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `كشوفات_الحسابات_PDF_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      }

      setExportProgress(100);
      setExportStatusText('تم تجهيز وتحميل ملفات PDF بنجاح! 🚀');

      setTimeout(() => {
        setIsBatchModalOpen(false);
        setBatchRenderState(null);
        showSuccessNotification('تم التصدير بنجاح', `تم تصدير (${processedCount}) كشف حساب بصيغة PDF الرسمية بنجاح.`);
      }, 500);
    } catch (err: any) {
      console.error('Batch export failed:', err);
      showErrorNotification('خطأ في التصدير', 'حدث خطأ أثناء إنشاء ملفات PDF.');
    } finally {
      setIsGeneratingBatch(false);
      setBatchRenderState(null);
    }
  };

  // Bulk PDF Export Handler with Progress Bar & Silent iframe Print (No popup window!)
  const handleExportBatchPDF = async () => {
    const targetAccounts = getSelectedAccountsForBatch();
    if (targetAccounts.length === 0) {
      showErrorNotification('تنبيه', 'يرجى اختيار حساب واحد على الأقل لتصدير الكشف.');
      return;
    }

    setIsGeneratingBatch(true);
    setExportProgress(15);
    setExportStatusText('جاري إعداد قالب كشوفات PDF المجمعة...');

    try {
      await new Promise(r => setTimeout(r, 200));

      let htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8" />
          <title>كشوفات الحسابات المجمعة</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
            body { font-family: 'Cairo', sans-serif; background: #fff; color: #0f172a; margin: 0; padding: 20px; font-size: 12px; }
            .statement-page { page-break-after: always; padding: 20px 0; }
            .statement-page:last-child { page-break-after: auto; }
            .header-box { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
            .title-area h1 { margin: 0; font-size: 18px; color: #0f172a; }
            .title-area p { margin: 4px 0 0 0; color: #64748b; font-size: 11px; }
            .acc-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th { background: #0f172a; color: #fff; padding: 8px 10px; text-align: right; font-size: 11px; }
            td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; font-size: 11px; }
            tr:nth-child(even) { background: #f8fafc; }
            .text-left { text-align: left; }
            .font-mono { font-family: monospace; font-weight: bold; }
            .summary-box { background: #f1f5f9; border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; font-weight: bold; }
            .badge-green { color: #047857; background: #dcfce7; padding: 3px 10px; border-radius: 6px; }
            .badge-red { color: #b91c1c; background: #fee2e2; padding: 3px 10px; border-radius: 6px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
      `;

      for (let index = 0; index < targetAccounts.length; index++) {
        const acc = targetAccounts[index];
        const stmt = await generateAccountStatementData(acc);
        if (skipZeroBalanceAccounts && Math.abs(stmt.closingBalance) < 0.01) {
          continue;
        }
        if (hideZeroMovements && stmt.lines.length === 0 && Math.abs(stmt.closingBalance) < 0.01) {
          continue;
        }

        htmlContent += `
          <div class="statement-page">
            <div class="header-box">
              <div class="title-area">
                <h1>كشف حساب تفصيلي</h1>
                <p>الفترة من: ${batchStartDate || 'البداية'} إلى: ${batchEndDate || 'اليوم'}</p>
              </div>
              <div style="text-align: left;">
                <div style="font-weight: 900; font-size: 16px; color: #047857;">نظام إدارة الحسابات والذمم</div>
                <div style="font-size: 10px; color: #64748b;">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
              </div>
            </div>

            <div class="acc-card">
              <div>
                <strong style="font-size: 14px;">${acc.nameAr}</strong> (${acc.code})<br/>
                <span style="font-size: 11px; color: #475569;">نوع الدين: <strong>${acc.debtLabel}</strong></span>
              </div>
              <div style="text-align: left;">
                <span style="font-size: 11px; color: #64748b; display: block; margin-bottom: 2px;">الرصيد الصافي النهائي:</span>
                <span class="${stmt.closingBalance >= 0 ? 'badge-green' : 'badge-red'} font-mono" style="font-size: 13px;">
                  $ ${Math.abs(stmt.closingBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} (${stmt.closingBalance >= 0 ? 'لنا' : 'علينا'})
                </span>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>تاريخ الحركة</th>
                  <th>رقم المستند</th>
                  <th>نوع المستند</th>
                  <th>البيان والتوضيح</th>
                  <th style="text-align: left;">مدين ($)</th>
                  <th style="text-align: left;">دائن ($)</th>
                  <th style="text-align: left;">الرصيد التراكمي ($)</th>
                </tr>
              </thead>
              <tbody>
        `;

        if (includeOpening || includePrevious) {
          htmlContent += `
            <tr style="background: #f1f5f9; font-weight: bold;">
              <td>${batchStartDate || '—'}</td>
              <td>—</td>
              <td>رصيد مائل/سابق</td>
              <td>الرصيد المدوّر السابق للفترة</td>
              <td class="text-left font-mono">${stmt.previousBalance > 0 ? stmt.previousBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</td>
              <td class="text-left font-mono">${stmt.previousBalance < 0 ? Math.abs(stmt.previousBalance).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</td>
              <td class="text-left font-mono">${stmt.previousBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
          `;
        }

        if (stmt.lines.length === 0) {
          htmlContent += `
            <tr>
              <td colspan="7" style="text-align: center; color: #94a3b8; padding: 20px;">لا توجد حركات تفصيلية في هذه الفترة الزمانية.</td>
            </tr>
          `;
        } else {
          stmt.lines.forEach(l => {
            htmlContent += `
              <tr>
                <td>${l.date ? new Date(l.date).toLocaleDateString('ar-EG') : '—'}</td>
                <td class="font-mono">${l.entryNumber || l.voucherNumber || '—'}</td>
                <td>${l.docType}</td>
                <td>${l.description}</td>
                <td class="text-left font-mono">${l.debit > 0 ? l.debit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</td>
                <td class="text-left font-mono">${l.credit > 0 ? l.credit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</td>
                <td class="text-left font-mono">${l.runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            `;
          });
        }

        htmlContent += `
              </tbody>
            </table>

            <div class="summary-box">
              <div>إجمالي حركات الفترة: ${stmt.lines.length} حركات</div>
              <div>مجموع المدين: $ ${stmt.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div>مجموع الدائن: $ ${stmt.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div>الرصيد الصافي: $ ${Math.abs(stmt.closingBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        `;

        const p = Math.min(80, 15 + Math.round(((index + 1) / targetAccounts.length) * 65));
        setExportProgress(p);
        setExportStatusText(`توليد صفحات PDF لحساب ${index + 1} من ${targetAccounts.length}...`);
      }

      htmlContent += `
        </body>
        </html>
      `;

      setExportProgress(90);
      setExportStatusText('جاري تحضير خيارات طباعة وحفظ PDF...');

      let iframe = document.getElementById('print-batch-iframe') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'print-batch-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
      }

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        setTimeout(() => {
          setExportProgress(100);
          setExportStatusText('تم التجهيز بنجاح! جاري اختيار مسار التصدير...');
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();

          setTimeout(() => {
            setIsBatchModalOpen(false);
            showSuccessNotification('تم التصدير', 'تم سحب الكشوفات وتوجيهها لتحديد مسار حفظ PDF.');
          }, 800);
        }, 500);
      }
    } catch {
      showErrorNotification('خطأ في التصدير', 'حدث خطأ أثناء تجهيز ملف PDF.');
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  // Handler for Email Modal Opening
  const handleOpenEmailModal = (selectedIds: string[]) => {
    setSelectedEmailAccountIds(selectedIds || []);
    if (selectedIds && selectedIds.length > 0) {
      const selectedAccs = debtRows.filter(r => selectedIds.includes(r.id));
      if (selectedAccs.length > 0) {
        setEmailSubject(`كشف حساب مالي: ${selectedAccs.map(a => a.nameAr).join(' ، ')}`);
        const firstWithEmail = selectedAccs.find(a => (a as any).email || (a as any).contactEmail);
        if (firstWithEmail) {
          setEmailRecipient((firstWithEmail as any).email || (firstWithEmail as any).contactEmail || '');
        }
      }
    } else {
      setEmailSubject('كشف حساب تفصيلي — تقرير الذمم المالي');
    }
    setIsEmailModalOpen(true);
  };

  // Real-time Email Sending & Tracking Handler
  const handleStartBatchEmailSending = async (targetAccountIds: string[]) => {
    const targetAccounts = debtRows.filter((r) => targetAccountIds.includes(r.id));
    if (targetAccounts.length === 0) {
      showErrorNotification('تنبيه', 'يرجى اختيار حساب واحد على الأقل لإرسال الكشوفات.');
      return;
    }

    setIsTrackingEmailSending(true);
    setEmailSendStatus('sending');
    setEmailStats({
      sent: 0,
      pending: targetAccounts.length,
      failed: 0,
      skipped: 0,
      total: targetAccounts.length,
    });

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < targetAccounts.length; i++) {
      const acc = targetAccounts[i];
      const foundEmail = (acc as any).email || (acc as any).contactEmail || (acc as any).customer?.email || (acc as any).supplier?.email || user?.email || 'alsaady.rrr123r@gmail.com';
      const recipientEmail = (foundEmail && foundEmail.trim().includes('@')) ? foundEmail.trim() : 'alsaady.rrr123r@gmail.com';

      try {
        const cur = acc.endingBalanceUSD ? 'USD' : 'IQD';
        const bal = acc.endingBalanceUSD || acc.endingBalanceIQD || 0;

        await apiRequest('/api/email/send-statement', {
          method: 'POST',
          timeoutMs: 60_000,
          body: JSON.stringify({
            recipientEmail,
            recipientName: acc.nameAr,
            accountName: acc.nameAr,
            accountCode: acc.code,
            currency: cur,
            currentBalance: bal,
            subject: `كشف حساب مالي — ${acc.code ? `${acc.code} - ` : ''}${acc.nameAr}`,
            customMessage: 'مرحباً، تجدون برفقه كشف الحساب المالي التفصيلي للفترة المحددة.',
            allowWithoutAttachment: true,
            fromDate: batchStartDate ? new Date(batchStartDate).toLocaleDateString('ar-EG') : undefined,
            toDate: batchEndDate ? new Date(batchEndDate).toLocaleDateString('ar-EG') : undefined,
          }),
        });

        sentCount++;
      } catch (err) {
        console.error(`Failed to send email to ${acc.nameAr}:`, err);
        failedCount++;
      }

      setEmailStats({
        sent: sentCount,
        failed: failedCount,
        skipped: 0,
        pending: Math.max(0, targetAccounts.length - (sentCount + failedCount)),
        total: targetAccounts.length,
      });
    }

    if (sentCount > 0) {
      setEmailSendStatus('completed');
      showSuccessNotification('تم الإرسال', `تم إرسال كشوفات الحساب بنجاح لـ (${sentCount}) حساب.`);
    } else {
      setEmailSendStatus('failed');
      showErrorNotification('فشل الإرسال', 'تعذر إرسال كشوفات الحسابات عبر Brevo.');
    }
  };

  // 5. Define Table Grid Columns dynamically according to Currency Filters
  const columnDefs = useMemo<AccountingColumnDef[]>(() => {
    const cols: AccountingColumnDef[] = [
      {
        field: 'code',
        headerText: 'رقم الحساب',
        width: '100px',
        render: (row: AccountDebtRow) => (
          <span className="font-mono text-xs font-bold text-slate-700">{row.code}</span>
        ),
      },
      {
        field: 'nameAr',
        headerText: 'اسم الحساب / الشريك',
        width: '220px',
        render: (row: AccountDebtRow) => (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              <IconUser size={14} />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-xs block leading-tight">{row.nameAr}</span>
              {row.nameEn && <span className="text-[10px] text-slate-400 font-mono block">{row.nameEn}</span>}
            </div>
          </div>
        ),
      },
      {
        field: 'debtType',
        headerText: 'نوع الدين',
        width: '130px',
        render: (row: AccountDebtRow) => {
          if (row.debtType === 'receivable') {
            return (
              <Badge size="sm" color="emerald" variant="light" className="font-bold px-2">
                ديون لنا (مدين)
              </Badge>
            );
          }
          if (row.debtType === 'payable') {
            return (
              <Badge size="sm" color="red" variant="light" className="font-bold px-2">
                ديون علينا (دائن)
              </Badge>
            );
          }
          return (
            <Badge size="sm" color="gray" variant="outline" className="font-bold">
              رصيد صفري
            </Badge>
          );
        },
      },
    ];

    // ── IQD Columns ──
    if (pageShowIQD) {
      cols.push(
        {
          field: 'debitIQD',
          headerText: 'مدين (د.ع)',
          width: '120px',
          render: (row: AccountDebtRow) => (
            <span className="font-mono font-bold text-slate-800 text-xs dir-ltr block text-right">
              {(row.debitIQD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          ),
        },
        {
          field: 'creditIQD',
          headerText: 'دائن (د.ع)',
          width: '120px',
          render: (row: AccountDebtRow) => (
            <span className="font-mono font-bold text-slate-800 text-xs dir-ltr block text-right">
              {(row.creditIQD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          ),
        },
        {
          field: 'endingBalanceIQD',
          headerText: 'صافي (د.ع)',
          width: '160px',
          render: (row: AccountDebtRow) => {
            const val = row.endingBalanceIQD;
            const absVal = Math.abs(val);
            const formatted = absVal.toLocaleString('en-US', { minimumFractionDigits: 2 });

            if (val > 0.01) {
              return (
                <div className="flex items-center gap-1 font-mono font-black text-xs text-emerald-700">
                  <span className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    د.ع {formatted} (لنا)
                  </span>
                </div>
              );
            }
            if (val < -0.01) {
              return (
                <div className="flex items-center gap-1 font-mono font-black text-xs text-rose-700">
                  <span className="bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                    د.ع {formatted} (علينا)
                  </span>
                </div>
              );
            }
            return <span className="font-mono text-slate-400 text-xs">د.ع 0.00</span>;
          },
        }
      );
    }

    // ── USD Columns ──
    if (pageShowUSD) {
      cols.push(
        {
          field: 'debitUSD',
          headerText: 'مدين ($)',
          width: '120px',
          render: (row: AccountDebtRow) => (
            <span className="font-mono font-bold text-slate-800 text-xs dir-ltr block text-right">
              {(row.debitUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          ),
        },
        {
          field: 'creditUSD',
          headerText: 'دائن ($)',
          width: '120px',
          render: (row: AccountDebtRow) => (
            <span className="font-mono font-bold text-slate-800 text-xs dir-ltr block text-right">
              {(row.creditUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          ),
        },
        {
          field: 'endingBalanceUSD',
          headerText: 'صافي ($)',
          width: '160px',
          render: (row: AccountDebtRow) => {
            const val = row.endingBalanceUSD;
            const absVal = Math.abs(val);
            const formatted = absVal.toLocaleString('en-US', { minimumFractionDigits: 2 });

            if (val > 0.01) {
              return (
                <div className="flex items-center gap-1 font-mono font-black text-xs text-emerald-700">
                  <span className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    $ {formatted} (لنا)
                  </span>
                </div>
              );
            }
            if (val < -0.01) {
              return (
                <div className="flex items-center gap-1 font-mono font-black text-xs text-rose-700">
                  <span className="bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                    $ {formatted} (علينا)
                  </span>
                </div>
              );
            }
            return <span className="font-mono text-slate-400 text-xs">$ 0.00</span>;
          },
        }
      );
    }

    // Actions Column
    cols.push({
      field: 'actions',
      headerText: 'إجراءات',
      width: '225px',
      render: (row: AccountDebtRow) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="compact-xs"
            variant="light"
            color="orange"
            leftSection={<IconRoute size={13} />}
            onClick={() => handleOpenAmountTrace(row)}
            className="font-bold text-[11px]"
          >
            مسار المبلغ
          </Button>
          <Button
            size="compact-xs"
            variant="light"
            color="emerald"
            leftSection={<IconFileText size={13} />}
            onClick={() => handleOpenStatement(row)}
            className="font-bold text-[11px]"
          >
            كشف الحساب
          </Button>
        </div>
      ),
    });

    return cols;
  }, [pageShowIQD, pageShowUSD, handleOpenAmountTrace, handleOpenStatement]);

  // Render Dynamic Actions when 1 or more accounts are selected via Switch
  const renderSelectedActions = (selectedIds: string[], _clearSelection: () => void) => {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="xs"
          color="orange"
          variant="filled"
          leftSection={<IconFileTypePdf size={15} />}
          onClick={() => handleExportBatchZipPDF(selectedIds)}
          className="font-bold text-xs h-8 px-3.5 shadow-2xs rounded-lg cursor-pointer"
        >
          تصدير PDF ({selectedIds.length})
        </Button>

        <Button
          size="xs"
          color="emerald"
          variant="light"
          leftSection={<IconFileSpreadsheet size={15} />}
          onClick={handleExportExcel}
          className="font-bold text-xs h-8 px-3 rounded-lg cursor-pointer"
        >
          تصدير Excel
        </Button>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto select-none dir-rtl">
      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 flex items-center justify-between gap-3">
          <span>تعذر تحميل تقرير الديون. تحقق من الاتصال ثم أعد المحاولة.</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="h-8 px-3 rounded-lg bg-white border border-red-200 text-red-700 font-bold cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* ── Top Summary Metric Cards (ديون لنا / ديون علينا / الصافي) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: ديون لنا (المدينون) */}
        <Paper p="xs" radius="lg" withBorder className="bg-white border-emerald-200/90 shadow-2xs text-center py-2.5 px-4 hover:shadow-md transition-shadow">
          <span className="text-xs font-bold text-slate-500 block">إجمالي ديون لنا (المدينون)</span>
          <div className="flex items-center justify-center gap-3 mt-1 font-mono font-black text-lg">
            {pageShowUSD && (
              <AnimatedNumber
                value={summary.usdReceivables}
                prefix="$"
                className="text-emerald-700 font-extrabold"
              />
            )}
            {pageShowUSD && pageShowIQD && <span className="text-slate-300">|</span>}
            {pageShowIQD && (
              <AnimatedNumber
                value={summary.iqdReceivables}
                prefix="د.ع"
                className="text-teal-700 font-extrabold"
              />
            )}
          </div>
        </Paper>

        {/* Card 2: ديون علينا (الدائنون) */}
        <Paper p="xs" radius="lg" withBorder className="bg-white border-rose-200/90 shadow-2xs text-center py-2.5 px-4 hover:shadow-md transition-shadow">
          <span className="text-xs font-bold text-slate-500 block">إجمالي ديون علينا (الدائنون)</span>
          <div className="flex items-center justify-center gap-3 mt-1 font-mono font-black text-lg">
            {pageShowUSD && (
              <AnimatedNumber
                value={summary.usdPayables}
                prefix="$"
                className="text-rose-700 font-extrabold"
              />
            )}
            {pageShowUSD && pageShowIQD && <span className="text-slate-300">|</span>}
            {pageShowIQD && (
              <AnimatedNumber
                value={summary.iqdPayables}
                prefix="د.ع"
                className="text-rose-700 font-extrabold"
              />
            )}
          </div>
        </Paper>

        {/* Card 3: صافي المركز المالي للديون */}
        <Paper p="xs" radius="lg" withBorder className="bg-white border-slate-200/90 shadow-2xs text-center py-2.5 px-4 hover:shadow-md transition-shadow">
          <span className="text-xs font-bold text-slate-500 block">صافي المركز المالي للديون</span>
          <div className="flex items-center justify-center gap-3 mt-1 font-mono font-black text-lg">
            {pageShowUSD && (
              <AnimatedNumber
                value={Math.abs(summary.netUSD)}
                prefix="$"
                suffix={summary.netUSD >= 0 ? '(لنا)' : '(علينا)'}
                className={summary.netUSD >= 0 ? 'text-emerald-700 font-extrabold' : 'text-rose-700 font-extrabold'}
              />
            )}
            {pageShowUSD && pageShowIQD && <span className="text-slate-300">|</span>}
            {pageShowIQD && (
              <AnimatedNumber
                value={Math.abs(summary.netIQD)}
                prefix="د.ع"
                suffix={summary.netIQD >= 0 ? '(لنا)' : '(علينا)'}
                className={summary.netIQD >= 0 ? 'text-teal-700 font-extrabold' : 'text-rose-700 font-extrabold'}
              />
            )}
          </div>
        </Paper>
      </div>

      {/* ── Filter Controls Toolbar (شريط الفلترة المنظم) ── */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Right Side (RTL Start): Search Input & Static PDF Button */}
        <div className="flex items-center gap-2">
          <TextInput
            placeholder="بحث باسم الحساب أو الكود..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            leftSection={<IconSearch size={15} className="text-slate-400" />}
            size="xs"
            className="w-56"
            styles={{ input: { borderRadius: 8, height: 36, borderColor: '#cbd5e1' } }}
          />

          <Button
            size="xs"
            color="orange"
            variant="filled"
            leftSection={<IconFileTypePdf size={16} />}
            onClick={() => handleStaticExportClick()}
            className="font-bold text-xs h-9 px-3.5 shadow-2xs rounded-lg cursor-pointer shrink-0"
          >
            تصدير PDF {selectedAccountIds.size > 0 ? `(${selectedAccountIds.size})` : ''}
          </Button>
        </div>

        {/* Center: Segmented Filter Pills (التبويبات في الوسط) */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-lg border border-slate-200/80">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-black transition-all cursor-pointer ${
              filterMode === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <span>جميع الديون</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('receivables')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-black transition-all cursor-pointer ${
              filterMode === 'receivables'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <span>ديون لنا (المدينون)</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('payables')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-black transition-all cursor-pointer ${
              filterMode === 'payables'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            <span>ديون علينا (الدائنون)</span>
          </button>
        </div>

        {/* Left Side (RTL End): Currency Display Switches & Zero Balance Switch */}
        <div className="flex items-center gap-2">
          {/* Currency Display Switches Box */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg h-9">
            <button
              type="button"
              onClick={() => {
                setPageShowUSD(true);
                setPageShowIQD(true);
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-extrabold border transition-all cursor-pointer ${
                pageShowUSD && pageShowIQD
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
              title="تفعيل وتحديث عرض كلا العملتين"
            >
              كلا العملتين
            </button>

            <div className="flex items-center gap-1">
              <Switch
                size="xs"
                color="emerald"
                checked={pageShowUSD}
                onChange={(e) => {
                  const val = e.currentTarget.checked;
                  if (!val && !pageShowIQD) return;
                  setPageShowUSD(val);
                }}
                className="cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">دولار ($)</span>
            </div>

            <div className="flex items-center gap-1">
              <Switch
                size="xs"
                color="emerald"
                checked={pageShowIQD}
                onChange={(e) => {
                  const val = e.currentTarget.checked;
                  if (!val && !pageShowUSD) return;
                  setPageShowIQD(val);
                }}
                className="cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">دينار (د.ع)</span>
            </div>
          </div>

          {/* Zero Balance Switch */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg h-9">
            <Switch
              size="xs"
              color="emerald"
              checked={hideZeroBalances}
              onChange={(e) => setHideZeroBalances(e.currentTarget.checked)}
              className="cursor-pointer"
            />
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">إخفاء الحسابات الصفرية</span>
          </div>
        </div>
      </div>

      {/* ── Main Data Grid (`AccountingGrid`) ── */}
      <Paper p="xs" radius="md" withBorder className="bg-white border-slate-200 shadow-2xs">
        <AccountingGrid
          data={filteredRows}
          columnDefs={columnDefs}
          loading={loading}
          onRefresh={() => { void refetch(); }}
          gridKey="debts_report_grid"
          selectedRowIds={selectedAccountIds}
          onSelectionChange={setSelectedAccountIds}
          hideSelectionBanner={true}
          hideSearch={true}
          hideFilters={true}
          hideDateFilter={true}
          hideHeaderCard={true}
          customFooterSummary={
            <div className="flex items-center flex-wrap gap-4 text-[12px] font-bold">
              <span className="flex items-center gap-1.5 text-orange-700">
                <IconRoute size={14} />
                كليك يمين على أي حساب لعرض مسار المبلغ
              </span>
              <span className="w-px bg-slate-300 h-4"></span>
              <span>عدد السجلات: <strong className="text-sky-700">{filteredRows.length}</strong></span>
              <span className="w-px bg-slate-300 h-4"></span>
              {pageShowIQD && (
                <div className="flex items-center gap-3 bg-teal-50/70 border border-teal-200/80 px-2 py-0.5 rounded-md">
                  <span className="text-teal-900">دينار (د.ع):</span>
                  <span>مدين: <strong className="font-mono text-emerald-700">{summary.iqdReceivables.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                  <span>دائن: <strong className="font-mono text-rose-700">{summary.iqdPayables.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                  <span>صافي: <strong className="font-mono text-slate-900">{Math.abs(summary.netIQD).toLocaleString('en-US', { minimumFractionDigits: 2 })} {summary.netIQD >= 0 ? '(لنا)' : '(علينا)'}</strong></span>
                </div>
              )}
              {pageShowUSD && (
                <div className="flex items-center gap-3 bg-blue-50/70 border border-blue-200/80 px-2 py-0.5 rounded-md">
                  <span className="text-blue-900">دولار ($):</span>
                  <span>مدين: <strong className="font-mono text-emerald-700">${summary.usdReceivables.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                  <span>دائن: <strong className="font-mono text-rose-700">${summary.usdPayables.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                  <span>صافي: <strong className="font-mono text-slate-900">${Math.abs(summary.netUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })} {summary.netUSD >= 0 ? '(لنا)' : '(علينا)'}</strong></span>
                </div>
              )}
            </div>
          }
          onExportExcel={handleExportExcel}
          onOpenBatchStatements={(selectedIds) => {
            if (selectedIds && selectedIds.length > 0) {
              setBatchTarget('CUSTOM');
              setCustomSelectedAccIds(selectedIds);
            } else {
              setBatchTarget('ALL');
            }
            setIsBatchModalOpen(true);
          }}
          onSendEmail={handleOpenEmailModal}
          onRowContextMenu={handleDebtContextMenu}
        />
      </Paper>

      {debtContextMenu && typeof document !== 'undefined' && createPortal(
        <>
          <button
            type="button"
            aria-label="إغلاق قائمة إجراءات الحساب"
            className="fixed inset-0 z-[9998] cursor-default bg-transparent"
            onMouseDown={() => setDebtContextMenu(null)}
          />
          <div
            role="menu"
            aria-label={`إجراءات الحساب ${debtContextMenu.row.nameAr}`}
            dir="rtl"
            className="fixed z-[9999] w-[260px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_45px_rgba(15,23,42,0.22)]"
            style={{ left: debtContextMenu.x, top: debtContextMenu.y }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-3 py-2">
              <span className="block truncate text-[11px] font-black text-slate-900">{debtContextMenu.row.nameAr}</span>
              <span className="mt-0.5 block font-mono text-[9px] font-semibold text-slate-400">{debtContextMenu.row.code}</span>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => handleOpenAmountTrace(debtContextMenu.row)}
              className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-right text-[11px] font-black text-orange-700 hover:bg-orange-50 focus:bg-orange-50 focus:outline-none"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                <IconRoute size={16} />
              </span>
              <span>
                <span className="block">عرض مسار المبلغ</span>
                <span className="mt-0.5 block text-[9px] font-semibold text-slate-400">الخدمات والسندات والقيود المرتبطة</span>
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const row = debtContextMenu.row;
                setDebtContextMenu(null);
                handleOpenStatement(row);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-right text-[11px] font-bold text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <IconFileText size={15} />
              </span>
              <span>فتح كشف الحساب الكامل</span>
            </button>
          </div>
        </>,
        document.body,
      )}

      <DebtAmountTraceModal
        opened={isTraceModalOpen}
        account={traceAccount}
        onClose={() => setIsTraceModalOpen(false)}
        onOpenStatement={(account) => {
          setIsTraceModalOpen(false);
          handleOpenStatement(account as AccountDebtRow);
        }}
      />

      {/* ── Modal for Choosing Export vs Email / Real-time Email Tracking ── */}
      <Modal
        opened={isExportChoiceModalOpen}
        onClose={() => {
          setIsExportChoiceModalOpen(false);
          setIsTrackingEmailSending(false);
        }}
        size={isTrackingEmailSending ? 'lg' : 460}
        centered
        radius="lg"
        withCloseButton={false}
        styles={{
          content: {
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        {isTrackingEmailSending ? (
          /* ── Real-time Progress Tracking View (Matching Screenshot 2 & AccountStatementPrintModal Exactly) ── */
          <div className="p-4 space-y-4 text-slate-900 font-sans" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between pb-1">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                  إرسال كشوفات الحساب
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5" dir="ltr">
                  الفترة: {batchStartDate || '2026-01-01'} إلى {batchEndDate || '2026-12-31'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsTrackingEmailSending(false);
                  setIsExportChoiceModalOpen(false);
                }}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Progress bar and counter */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>{emailStats.sent + emailStats.failed + emailStats.skipped} / {emailStats.total}</span>
                <span className={emailSendStatus === 'completed' ? 'text-emerald-700' : emailSendStatus === 'failed' ? 'text-rose-700' : 'text-orange-600'}>
                  {emailSendStatus === 'completed'
                    ? 'اكتمل'
                    : emailSendStatus === 'failed'
                      ? 'فشل الإرسال'
                      : 'جاري الإرسال...'}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${emailSendStatus === 'failed' ? 'bg-rose-500' : emailSendStatus === 'completed' ? 'bg-emerald-500' : 'bg-orange-500'}`}
                  style={{ width: `${Math.round(((emailStats.sent + emailStats.failed + emailStats.skipped) / Math.max(1, emailStats.total)) * 100)}%` }}
                />
              </div>
            </div>

            {/* Status Details Card */}
            <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-4 space-y-4">
              {/* Status Title */}
              <div className="flex items-center justify-end gap-1.5">
                {emailSendStatus === 'completed' && (
                  <div className="flex items-center gap-1.5 text-emerald-700 font-extrabold text-sm">
                    <span>اكتمل الإرسال بنجاح</span>
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <IconCheck size={14} />
                    </div>
                  </div>
                )}
                {emailSendStatus === 'sending' && (
                  <div className="flex items-center gap-2 text-orange-600 font-bold text-sm">
                    <span>جاري إرسال كشوفات الحساب عبر Brevo...</span>
                    <Loader size={14} color="orange" />
                  </div>
                )}
                {emailSendStatus === 'failed' && (
                  <div className="flex items-center gap-1.5 text-rose-700 font-extrabold text-sm">
                    <span>فشل الإرسال</span>
                    <IconAlertCircle size={16} className="text-rose-600" />
                  </div>
                )}
              </div>

              {/* 4 Stats Columns */}
              <div className="grid grid-cols-4 gap-2 text-center pt-1 border-t border-slate-200/60">
                <div>
                  <span className="text-xs text-slate-500 font-medium block">أُرسلت</span>
                  <span className="text-base font-extrabold text-emerald-600 block mt-1">{emailStats.sent}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-medium block">قيد الانتظار</span>
                  <span className="text-base font-extrabold text-slate-700 block mt-1">{emailStats.pending}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-medium block">فشلت</span>
                  <span className={`text-base font-extrabold block mt-1 ${emailStats.failed > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                    {emailStats.failed}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-medium block">تم تخطيها</span>
                  <span className="text-base font-extrabold text-slate-700 block mt-1">{emailStats.skipped}</span>
                </div>
              </div>
            </div>

            {/* Background note */}
            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
              <IconAlertTriangle size={15} className="shrink-0 text-slate-400" />
              <span>يستمر الإرسال في الخلفية — يمكنك الإغلاق والعودة لاحقاً.</span>
            </div>

            {/* Footer Action */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsTrackingEmailSending(false);
                  setIsExportChoiceModalOpen(false);
                }}
                className="px-6 py-1.5 border border-orange-500 text-orange-600 hover:bg-orange-50 active:scale-95 rounded-lg text-xs font-extrabold transition-all cursor-pointer bg-white"
              >
                إغلاق
              </button>
            </div>
          </div>
        ) : (
          /* ── Choice Modal View (Clean side-by-side buttons زر بجانب زر) ── */
          <div className="p-4 space-y-4 text-slate-900 font-sans" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between pb-1">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                  خيارات تصدير كشوفات الحساب
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5" dir="ltr">
                  الفترة: {batchStartDate || '2026-01-01'} إلى {batchEndDate || '2026-12-31'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExportChoiceModalOpen(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Summary Row */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-bold">عدد الحسابات المحددة للعملية:</span>
              <span className="font-mono font-extrabold text-[#F45A0A] bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-md">
                {selectedAccountIds.size} حساب
              </span>
            </div>

            {/* Side-by-Side Action Buttons (زر بجانب زر) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Button 1: تصدير PDF */}
              <button
                type="button"
                onClick={() => {
                  setIsExportChoiceModalOpen(false);
                  handleExportBatchZipPDF(Array.from(selectedAccountIds));
                }}
                className="h-14 rounded-xl border border-orange-200 bg-orange-50/60 hover:bg-orange-100 hover:border-orange-500 text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-2xs group active:scale-98"
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-orange-200 text-[#F45A0A] flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <IconFileTypePdf size={18} />
                </div>
                <span>تصدير PDF</span>
              </button>

              {/* Button 2: إرسال بالبريد */}
              <button
                type="button"
                onClick={() => {
                  handleStartBatchEmailSending(Array.from(selectedAccountIds));
                }}
                className="h-14 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 hover:border-indigo-500 text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-2xs group active:scale-98"
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-indigo-200 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <IconMail size={18} />
                </div>
                <span>إرسال بالبريد</span>
              </button>
            </div>

            {/* Footer Action */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsExportChoiceModalOpen(false)}
                className="px-6 py-1.5 border border-orange-500 text-orange-600 hover:bg-orange-50 active:scale-95 rounded-lg text-xs font-extrabold transition-all cursor-pointer bg-white"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal for Bulk Batch Account Statements Export ── */}
      <Modal
        opened={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        title={
          <div className="flex items-center gap-2 font-black text-slate-900 text-base">
            <IconFileText className="text-emerald-600" size={20} />
            <span>سحب كشوفات الحسابات المجمعة — Bulk Statements</span>
          </div>
        }
        size="lg"
        centered
        radius="lg"
        padding="lg"
      >
        <Stack gap="md">
          {/* Section 1: Target Accounts */}
          <div>
            <span className="text-xs font-extrabold text-slate-700 block mb-2">1. تحديد الحسابات المطلوبة لسحب الكشف:</span>
            <Radio.Group
              value={batchTarget}
              onChange={(val: any) => setBatchTarget(val)}
            >
              <Group gap="sm">
                <Radio value="ALL" label={`جميع الحسابات (${debtRows.length})`} />
                <Radio value="RECEIVABLES" label="ديون لنا (المدينون)" />
                <Radio value="PAYABLES" label="ديون علينا (الدائنون)" />
                {customSelectedAccIds.length > 0 && (
                  <Badge color="emerald" size="md" variant="filled" className="font-bold">
                    محدد من الجدول ({customSelectedAccIds.length} حساب)
                  </Badge>
                )}
              </Group>
            </Radio.Group>
          </div>

          <Divider />

          {/* Section 2: Date Range Single Custom Field */}
          <div>
            <AccountingDateRangePicker
              startDate={batchStartDate}
              endDate={batchEndDate}
              label="2. النطاق الزمني للكشف (حقل مخصص من - إلى):"
              onChange={(start, end) => {
                setBatchStartDate(start);
                setBatchEndDate(end);
              }}
            />
          </div>

          <Divider />

          {/* Section 3: Financial & Currency Options */}
          <div>
            <span className="text-xs font-extrabold text-slate-700 block mb-2">3. خيارات الرصيد والعملة المربوطة:</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <Switch
                size="xs"
                color="emerald"
                label="تضمين الرصيد الافتتاحي"
                checked={includeOpening}
                onChange={(e) => setIncludeOpening(e.currentTarget.checked)}
              />
              <Switch
                size="xs"
                color="emerald"
                label="تضمين الرصيد السابق المدوّر"
                checked={includePrevious}
                onChange={(e) => setIncludePrevious(e.currentTarget.checked)}
              />
              <Switch
                size="xs"
                color="emerald"
                label="عدم سحب الحسابات ذات الرصيد الصفري"
                checked={skipZeroBalanceAccounts}
                onChange={(e) => setSkipZeroBalanceAccounts(e.currentTarget.checked)}
              />
              <Switch
                size="xs"
                color="emerald"
                label="إخفاء الحسابات بدون حركة صفرية"
                checked={hideZeroMovements}
                onChange={(e) => setHideZeroMovements(e.currentTarget.checked)}
              />
              <div className="col-span-1 md:col-span-2 pt-2 border-t border-slate-200/80 mt-1">
                <span className="text-xs font-extrabold text-slate-700 block mb-2">تحديد العملة المربوطة بالكشف:</span>

                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2.5">
                  {/* Both Currencies Switch in distinct Blue color */}
                  <div className="bg-blue-50/70 p-2.5 rounded-md border border-blue-200 flex items-center justify-between">
                    <span className="text-xs font-black text-blue-900">كلا العملتين (USD & IQD)</span>
                    <Switch
                      size="xs"
                      color="blue"
                      checked={includeUSD && includeIQD}
                      onChange={(e) => {
                        const val = e.currentTarget.checked;
                        setIncludeUSD(val);
                        setIncludeIQD(val);
                      }}
                      className="cursor-pointer"
                    />
                  </div>

                  {/* Individual Currency Switches in Emerald color */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-md border border-slate-200">
                      <span className="text-xs font-bold text-slate-800">دولار أمريكي (USD $)</span>
                      <Switch
                        size="xs"
                        color="emerald"
                        checked={includeUSD}
                        onChange={(e) => {
                          const val = e.currentTarget.checked;
                          if (!val && !includeIQD) return;
                          setIncludeUSD(val);
                        }}
                        className="cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-md border border-slate-200">
                      <span className="text-xs font-bold text-slate-800">دينار عراقي (IQD د.ع)</span>
                      <Switch
                        size="xs"
                        color="emerald"
                        checked={includeIQD}
                        onChange={(e) => {
                          const val = e.currentTarget.checked;
                          if (!val && !includeUSD) return;
                          setIncludeIQD(val);
                        }}
                        className="cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Active Generation Progress Bar */}
          {isGeneratingBatch && (
            <div className="bg-emerald-50 border border-emerald-200/90 p-3 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-emerald-900">
                <span>{exportStatusText || 'جاري معالجة وتصدير الكشوفات المجمعة...'}</span>
                <span className="font-mono">{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} animated color="emerald" size="sm" radius="xl" />
            </div>
          )}

          <Divider />

          {/* Section 4: Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
            <Button
              variant="outline"
              color="gray"
              onClick={() => setIsBatchModalOpen(false)}
              size="sm"
            >
              إلغاء
            </Button>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="filled"
                color="orange"
                size="sm"
                leftSection={<IconFileZip size={16} />}
                onClick={() => handleExportBatchZipPDF()}
                loading={isGeneratingBatch}
                className="font-bold shadow-xs cursor-pointer"
              >
                تصدير ملف PDF لكل حساب (ZIP) 📦
              </Button>

              <Button
                variant="filled"
                color="blue"
                size="sm"
                leftSection={<IconFiles size={16} />}
                onClick={handleExportBatchPDF}
                loading={isGeneratingBatch}
                className="font-bold shadow-xs cursor-pointer"
              >
                كشف PDF موحد مدمج / طباعة
              </Button>

              <Button
                variant="light"
                color="emerald"
                size="sm"
                leftSection={<IconFileSpreadsheet size={16} />}
                onClick={handleExportBatchExcel}
                loading={isGeneratingBatch}
                className="font-bold shadow-xs cursor-pointer"
              >
                تصدير Excel مجمع
              </Button>
            </div>
          </div>
        </Stack>
      </Modal>



      {/* ── Small Progress Popup Modal for Export Progress Tracking (نافذة تحميل صغيرة منبثقة) ── */}
      <Modal
        opened={isGeneratingBatch}
        onClose={() => {}}
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        size="sm"
        centered
        radius="lg"
        padding="lg"
        styles={{
          content: {
            borderRadius: 16,
            border: '1px solid #fed7aa',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          },
        }}
      >
        <div className="text-center space-y-4 py-2">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center mx-auto shadow-2xs">
            <IconFileTypePdf size={26} />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-slate-900 mb-1">جاري تصدير كشوفات PDF</h4>
            <p className="text-xs text-slate-500 font-medium px-2 leading-relaxed">
              {exportStatusText || 'يرجى الانتظار، جاري معالجة الكشوفات...'}
            </p>
          </div>
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-orange-800">
              <span>التقدم</span>
              <span>{exportProgress}%</span>
            </div>
            <Progress value={exportProgress} animated color="orange" size="sm" radius="xl" />
          </div>
        </div>
      </Modal>

      {/* ── Hidden Mount for Official Statement Template PDF Generation ── */}
      {batchRenderState && (
        <div
          id="batch-render-wrapper"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: -9999,
            opacity: 1,
            pointerEvents: 'none',
            width: '780px',
            backgroundColor: '#ffffff',
          }}
        >
          <PrintableAccountStatementSheet
            accountName={batchRenderState.accountName}
            accountCode={batchRenderState.accountCode}
            accountId={batchRenderState.accountId}
            startDate={batchRenderState.startDate}
            endDate={batchRenderState.endDate}
            rows={batchRenderState.rows}
            totals={batchRenderState.totals}
            config={printConfig}
            lang="ar"
          />
        </div>
      )}
    </div>
  );
};
