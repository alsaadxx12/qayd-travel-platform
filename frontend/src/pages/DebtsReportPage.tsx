import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAccountStatement, getDebtsReport } from '../api/reports';
import { apiRequest } from '../api/client';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { AccountingGrid, AccountingColumnDef } from '../components/common/AccountingGrid';
import { AccountingDateRangePicker } from '../components/common/date/AccountingDateRangePicker';
import { AnimatedNumber } from '../components/common/AnimatedNumber';
import { DebtAmountTraceModal } from '../components/reports/DebtAmountTraceModal';
import { Paper, TextInput, Button, Badge, Switch, Modal, Radio, Group, Stack, Divider, Progress, Textarea, Menu } from '@mantine/core';
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
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
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

  // Helper to generate a single account PDF Blob (standalone, styled, bilingual support)
  const generateAccountPdfBlob = async (
    targetAcc: AccountDebtRow,
    stmt: any,
  ): Promise<Blob> => {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px'; // Standard A4 width in pixels at 96 DPI
    container.style.background = '#ffffff';
    container.style.padding = '24px';
    container.style.fontFamily = "'IBM Plex Sans Arabic', 'Cairo', system-ui, sans-serif";
    container.style.direction = 'rtl';
    container.style.color = '#0f172a';

    const isUsd = targetAcc.accountCurrency === 'USD' || (includeUSD && !includeIQD) || Math.abs(targetAcc.endingBalanceUSD) > 0.01;
    const curSymbol = isUsd ? '$' : 'د.ع';

    container.innerHTML = `
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="margin: 0; font-size: 19px; font-weight: 800; color: #0f172a;">شركة السعدي للسفر والسياحة</h1>
          <p style="margin: 3px 0 0 0; font-size: 11px; color: #64748b;">كشف حساب مالي رسمي تفصيلي</p>
        </div>
        <div style="text-align: left; font-size: 11px; color: #475569;">
          <div><strong>تاريخ الطباعة:</strong> ${new Date().toLocaleDateString('ar-EG')}</div>
          <div><strong>الفترة:</strong> من ${batchStartDate || 'البداية'} إلى ${batchEndDate || 'اليوم'}</div>
        </div>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${targetAcc.nameAr}</div>
          <div style="font-size: 11px; font-family: monospace; color: #64748b; margin-top: 2px;">رقم الحساب: <strong>${targetAcc.code}</strong></div>
        </div>
        <div style="text-align: left;">
          <div style="font-size: 11px; color: #64748b;">نوع الحساب / الدين</div>
          <div style="font-size: 12px; font-weight: 800; color: #0369a1;">${targetAcc.debtLabel || 'حساب مالي'}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff;">
            <th style="padding: 7px 10px; text-align: center; width: 35px;">#</th>
            <th style="padding: 7px 10px; text-align: right; width: 85px;">تاريخ الحركة</th>
            <th style="padding: 7px 10px; text-align: right; width: 90px;">رقم المستند</th>
            <th style="padding: 7px 10px; text-align: right; width: 75px;">النوع</th>
            <th style="padding: 7px 10px; text-align: right;">البيان والتوضيح</th>
            <th style="padding: 7px 10px; text-align: left; width: 85px;">مدين (${curSymbol})</th>
            <th style="padding: 7px 10px; text-align: left; width: 85px;">دائن (${curSymbol})</th>
            <th style="padding: 7px 10px; text-align: left; width: 90px;">الرصيد (${curSymbol})</th>
          </tr>
        </thead>
        <tbody>
          ${(includeOpening || includePrevious) && stmt.previousBalance !== 0 ? `
            <tr style="background: #fffbeb; font-weight: bold; border-bottom: 1px solid #fde68a;">
              <td style="padding: 6px 10px; text-align: center;">•</td>
              <td style="padding: 6px 10px;">${batchStartDate || '—'}</td>
              <td style="padding: 6px 10px; font-family: monospace;">—</td>
              <td style="padding: 6px 10px;">رصيد سابق</td>
              <td style="padding: 6px 10px;">الرصيد المدوّر السابق للفترة</td>
              <td style="padding: 6px 10px; text-align: left; font-family: monospace;">${stmt.previousBalance > 0 ? stmt.previousBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</td>
              <td style="padding: 6px 10px; text-align: left; font-family: monospace;">${stmt.previousBalance < 0 ? Math.abs(stmt.previousBalance).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</td>
              <td style="padding: 6px 10px; text-align: left; font-family: monospace;">${stmt.previousBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
          ` : ''}
          ${stmt.lines.length === 0 ? `
            <tr>
              <td colspan="8" style="padding: 24px; text-align: center; color: #94a3b8;">لا توجد حركات تفصيلية مسجلة خلال الفترة المحددة.</td>
            </tr>
          ` : stmt.lines.map((l: any, idx: number) => `
            <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px; text-align: center; font-family: monospace; color: #64748b;">${idx + 1}</td>
              <td style="padding: 6px 10px;">${l.date ? new Date(l.date).toLocaleDateString('ar-EG') : '—'}</td>
              <td style="padding: 6px 10px; font-family: monospace; font-weight: bold;">${l.entryNumber || l.voucherNumber || '—'}</td>
              <td style="padding: 6px 10px;">${l.docType || 'قيد'}</td>
              <td style="padding: 6px 10px;">${l.description || 'حركة حساب'}</td>
              <td style="padding: 6px 10px; text-align: left; font-family: monospace; font-weight: bold; color: #065f46;">${l.debit > 0 ? l.debit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</td>
              <td style="padding: 6px 10px; text-align: left; font-family: monospace; font-weight: bold; color: #9f1239;">${l.credit > 0 ? l.credit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}</td>
              <td style="padding: 6px 10px; text-align: left; font-family: monospace; font-weight: 800;">${l.runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="background: #f1f5f9; border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; font-weight: bold; margin-bottom: 14px;">
        <div>إجمالي الحركات: <span style="font-family: monospace;">${stmt.lines.length}</span></div>
        <div>مجموع المدين: <span style="color: #065f46; font-family: monospace;">${curSymbol} ${stmt.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
        <div>مجموع الدائن: <span style="color: #9f1239; font-family: monospace;">${curSymbol} ${stmt.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
        <div style="font-size: 12.5px; font-weight: 800; color: #0f172a;">الرصيد الصافي: <span style="color: ${stmt.closingBalance >= 0 ? '#065f46' : '#9f1239'}; font-family: monospace;">${curSymbol} ${Math.abs(stmt.closingBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${stmt.closingBalance >= 0 ? '(لنا)' : '(علينا)'}</span></div>
      </div>

      <div style="border-top: 1px dashed #cbd5e1; padding-top: 8px; text-align: center; font-size: 9.5px; color: #94a3b8;">
        هذا الكشف صادر آلياً من نظام قيد المحاسبي المعتمد • قسم الحسابات والمالية
      </div>
    `;

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
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

      return pdf.output('blob');
    } finally {
      document.body.removeChild(container);
    }
  };

  // Bulk ZIP PDF Export Handler (A separate PDF file for each account packed into a ZIP)
  const handleExportBatchZipPDF = async () => {
    const targetAccounts = getSelectedAccountsForBatch();
    if (targetAccounts.length === 0) {
      showErrorNotification('تنبيه', 'يرجى اختيار حساب واحد على الأقل لتصدير الكشوفات.');
      return;
    }

    setIsGeneratingBatch(true);
    setExportProgress(5);
    setExportStatusText('جاري بدء إنشاء ملفات PDF الفردية لكل حساب...');

    try {
      const zip = new JSZip();
      let processedCount = 0;

      for (let i = 0; i < targetAccounts.length; i++) {
        const acc = targetAccounts[i];
        const percent = Math.min(85, 5 + Math.round(((i + 1) / targetAccounts.length) * 80));
        setExportProgress(percent);
        setExportStatusText(`جاري توليد ملف PDF لحساب (${i + 1} من ${targetAccounts.length}): ${acc.nameAr}...`);

        const stmt = await generateAccountStatementData(acc);
        if (skipZeroBalanceAccounts && Math.abs(stmt.closingBalance) < 0.01) {
          continue;
        }
        if (hideZeroMovements && stmt.lines.length === 0 && Math.abs(stmt.closingBalance) < 0.01) {
          continue;
        }

        const pdfBlob = await generateAccountPdfBlob(acc, stmt);
        const safeName = acc.nameAr.replace(/[/\\?%*:|"<>]/g, '_').trim();
        const fileName = `كشف_حساب_${safeName}_${acc.code}.pdf`;
        zip.file(fileName, pdfBlob);
        processedCount++;
      }

      if (processedCount === 0) {
        showErrorNotification('تنبيه', 'لم يتم العثور على أي حركات أو أرصدة للحسابات المختارة وفق شروط التصفية.');
        setIsGeneratingBatch(false);
        return;
      }

      setExportProgress(90);
      setExportStatusText('جاري ضغط الملفات وتجهيز أرشيف ZIP...');

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `كشوفات_الحسابات_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setExportProgress(100);
      setExportStatusText('تم تجهيز وتحميل ملف ZIP بنجاح! 🚀');

      setTimeout(() => {
        setIsGeneratingBatch(false);
        setIsBatchModalOpen(false);
        showSuccessNotification('تم التصدير بنجاح', `تم تصدير وتنزيل (${processedCount}) ملف PDF في أرشيف ZIP بنجاح.`);
      }, 600);
    } catch (err: any) {
      console.error(err);
      showErrorNotification('خطأ في التصدير', 'حدث خطأ أثناء إنشاء ملفات PDF وضغطها.');
      setIsGeneratingBatch(false);
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
            setIsGeneratingBatch(false);
            setIsBatchModalOpen(false);
            showSuccessNotification('تم التصدير', 'تم سحب الكشوفات وتوجيهها لتحديد مسار حفظ PDF.');
          }, 800);
        }, 500);
      }
    } catch {
      showErrorNotification('خطأ في التصدير', 'حدث خطأ أثناء تجهيز ملف PDF.');
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

  // Handler for Email Submit
  const handleSendEmailSubmit = async () => {
    if (!emailRecipient || !emailRecipient.trim()) {
      showErrorNotification('تنبيه', 'يرجى إدخال عنوان البريد الإلكتروني للمستلم.');
      return;
    }

    setIsSendingEmail(true);
    try {
      const selectedAccs = debtRows.filter(r => selectedEmailAccountIds.includes(r.id));
      const targetAcc = selectedAccs[0] || { nameAr: 'كشف الذمم المالي', endingBalanceUSD: 0, endingBalanceIQD: 0 };
      const cur = targetAcc.endingBalanceUSD ? 'USD' : 'IQD';
      const bal = targetAcc.endingBalanceUSD || targetAcc.endingBalanceIQD || 0;

      await apiRequest('/api/email/send-statement', {
        method: 'POST',
        body: JSON.stringify({
          recipientEmail: emailRecipient.trim(),
          recipientName: targetAcc.nameAr,
          accountName: targetAcc.nameAr,
          currency: cur,
          currentBalance: bal,
          subject: emailSubject,
          customMessage: emailBody,
          allowWithoutAttachment: true,
          fromDate: batchStartDate ? new Date(batchStartDate).toLocaleDateString('ar-EG') : undefined,
          toDate: batchEndDate ? new Date(batchEndDate).toLocaleDateString('ar-EG') : undefined,
        }),
      });

      showSuccessNotification('تم إرسال البريد الإلكتروني بنجاح', `تم إرسال كشف الحساب عبر Brevo بنجاح إلى: ${emailRecipient}`);
      setIsEmailModalOpen(false);
      setEmailRecipient('');
    } catch (err: any) {
      showErrorNotification('خطأ في الإرسال', err.message || 'حدث خطأ أثناء إرسال البريد الإلكتروني عبر Brevo.');
    } finally {
      setIsSendingEmail(false);
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

  // Render Dynamic Actions when 1 or more accounts are selected via Checkbox
  const renderSelectedActions = (selectedIds: string[], _clearSelection: () => void) => {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="xs"
          color="orange"
          variant="filled"
          leftSection={<IconFileZip size={15} />}
          onClick={() => {
            setBatchTarget('CUSTOM');
            setCustomSelectedAccIds(selectedIds);
            handleExportBatchZipPDF();
          }}
          loading={isGeneratingBatch}
          className="font-bold text-xs h-8 px-3.5 shadow-2xs rounded-lg cursor-pointer"
        >
          تصدير ملف لكل حساب (ZIP) ({selectedIds.length})
        </Button>

        <Button
          size="xs"
          color="blue"
          variant="light"
          leftSection={<IconFiles size={15} />}
          onClick={() => {
            setBatchTarget('CUSTOM');
            setCustomSelectedAccIds(selectedIds);
            handleExportBatchPDF();
          }}
          loading={isGeneratingBatch}
          className="font-bold text-xs h-8 px-3 rounded-lg cursor-pointer"
        >
          كشف موحد مدمج (PDF)
        </Button>

        <Button
          size="xs"
          color="emerald"
          variant="light"
          leftSection={<IconFileSpreadsheet size={15} />}
          onClick={() => {
            setBatchTarget('CUSTOM');
            setCustomSelectedAccIds(selectedIds);
            handleExportBatchExcel();
          }}
          loading={isGeneratingBatch}
          className="font-bold text-xs h-8 px-3 rounded-lg cursor-pointer"
        >
          تصدير Excel
        </Button>

        <Menu position="bottom-end" shadow="md" width={220} withinPortal={false}>
          <Menu.Target>
            <Button
              size="xs"
              color="gray"
              variant="outline"
              leftSection={<IconDotsVertical size={14} />}
              rightSection={<IconChevronDown size={13} />}
              className="font-bold text-xs h-8 px-2.5 rounded-lg border-slate-300 bg-white"
            >
              خيارات إضافية
            </Button>
          </Menu.Target>

          <Menu.Dropdown p="xs" className="space-y-1">
            <Menu.Item
              leftSection={<IconFileText size={15} className="text-orange-600" />}
              onClick={() => {
                setBatchTarget('CUSTOM');
                setCustomSelectedAccIds(selectedIds);
                setIsBatchModalOpen(true);
              }}
              className="font-bold text-xs"
            >
              تخصيص الفترة والخيارات المجمعة...
            </Menu.Item>

            <Menu.Item
              leftSection={<IconMail size={15} className="text-indigo-600" />}
              onClick={() => handleOpenEmailModal(selectedIds)}
              className="font-bold text-xs"
            >
              إرسال عبر الإيميل
            </Menu.Item>

            <Menu.Item
              leftSection={<IconPrinter size={15} className="text-slate-600" />}
              onClick={() => window.print()}
              className="font-bold text-xs"
            >
              طباعة الجدول المالي
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
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
        {/* Right Side (RTL Start): Search Input */}
        <div className="flex items-center gap-2">
          <TextInput
            placeholder="بحث باسم الحساب أو الكود..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            leftSection={<IconSearch size={15} className="text-slate-400" />}
            size="xs"
            className="w-64"
            styles={{ input: { borderRadius: 8, height: 36, borderColor: '#cbd5e1' } }}
          />
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
          renderSelectedActions={renderSelectedActions}
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
                onClick={handleExportBatchZipPDF}
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

      {/* ── Modal for Sending Account Statements via Email ── */}
      <Modal
        opened={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        title={
          <div className="flex items-center gap-2 font-black text-slate-900 text-base">
            <IconMail className="text-indigo-600" size={20} />
            <span>إرسال كشف الحساب عبر البريد الإلكتروني — Send Email</span>
          </div>
        }
        size="md"
        centered
        radius="lg"
        padding="lg"
      >
        <Stack gap="md">
          <TextInput
            label="عنوان البريد الإلكتروني للمستلم:"
            placeholder="example@company.com"
            value={emailRecipient}
            onChange={(e) => setEmailRecipient(e.currentTarget.value)}
            required
            size="xs"
            leftSection={<IconMail size={15} className="text-slate-400" />}
          />

          <TextInput
            label="موضوع الرسالة (Subject):"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.currentTarget.value)}
            size="xs"
          />

          <Textarea
            label="ملاحظات وتوضيحات الرسالة:"
            rows={3}
            value={emailBody}
            onChange={(e) => setEmailBody(e.currentTarget.value)}
            size="xs"
          />

          <div className="flex items-center justify-between gap-3 pt-3 border-t">
            <Button
              variant="outline"
              color="gray"
              onClick={() => setIsEmailModalOpen(false)}
              size="sm"
            >
              إلغاء
            </Button>

            <Button
              variant="filled"
              color="indigo"
              size="sm"
              leftSection={<IconMail size={16} />}
              onClick={handleSendEmailSubmit}
              loading={isSendingEmail}
              className="font-bold shadow-xs cursor-pointer"
            >
              إرسال البريد الإلكتروني الآن
            </Button>
          </div>
        </Stack>
      </Modal>
    </div>
  );
};
