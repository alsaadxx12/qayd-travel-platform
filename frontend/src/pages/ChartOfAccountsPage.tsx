import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Drawer, Badge } from '@mantine/core';
import {
  ListTree,
  Plus,
  RefreshCw,
  Printer,
  FileSpreadsheet,
  FileDown,
  Download,
} from 'lucide-react';
import { AccountingTreeGrid, AccountNode } from '../components/common/AccountingTreeGrid';
import { SmartAccountWizardModal } from '../components/accounts/SmartAccountWizardModal';
import { ImportAccountsCsvModal } from '../components/accounts/ImportAccountsCsvModal';
import { accountsApi } from '../api/accounts';
import { useLanguageStore } from '../store/useLanguageStore';
import { useAiPageContext } from '../hooks/useAiPageContext';
import { notifications } from '@mantine/notifications';

export const ChartOfAccountsPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [wizardOpen, setWizardOpen] = useState<boolean>(false);
  const [importCsvOpen, setImportCsvOpen] = useState<boolean>(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  useAiPageContext({
    route: '/accounts',
    entity: selectedAccount ? 'account' : undefined,
    recordId: selectedAccount?.id,
    label: selectedAccount ? `${selectedAccount.code} ${selectedAccount.nameAr}` : undefined,
  });
  const [accounts, setAccounts] = useState<AccountNode[]>(() => {
    return (window as any).__cachedAccountsTree || [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return !((window as any).__cachedAccountsTree?.length > 0);
  });

  const persistAccountsTree = useCallback((tree: AccountNode[]) => {
    setAccounts(tree);
    (window as any).__cachedAccountsTree = tree;
  }, []);

  const removeAccountsLocally = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const prune = (nodes: AccountNode[]): AccountNode[] =>
      nodes
        .filter((node) => !idSet.has(node.id))
        .map((node) => ({
          ...node,
          children: node.children && node.children.length > 0 ? prune(node.children) : node.children,
        }));
    setAccounts((prev) => {
      const source = ((window as unknown as { __cachedAccountsTree?: AccountNode[] }).__cachedAccountsTree) || prev;
      const next = prune(source);
      (window as unknown as { __cachedAccountsTree?: AccountNode[] }).__cachedAccountsTree = next;
      return next;
    });
    setSelectedAccount((current) => {
      if (current && idSet.has(current.id)) {
        setDrawerOpen(false);
        return null;
      }
      return current;
    });
  }, []);

  const loadAccounts = useCallback(async (_forceRefresh = false) => {
    const hasCachedTree = Boolean((window as any).__cachedAccountsTree?.length);
    if (!hasCachedTree) setLoading(true);
    try {
      const structure = await accountsApi.getTree(true);
      persistAccountsTree(structure || []);
      setLoading(false);

      const full = await accountsApi.getTree(false);
      persistAccountsTree(full || structure || []);
    } catch (error) {
      console.error('Error fetching accounts tree from database:', error);
    } finally {
      setLoading(false);
    }
  }, [persistAccountsTree]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Compute Total Accounts Count
  const totalAccountsCount = useMemo(() => {
    let count = 0;
    const countNodes = (nodes: AccountNode[]) => {
      nodes.forEach((acc) => {
        count++;
        if (acc.children && acc.children.length > 0) {
          countNodes(acc.children);
        }
      });
    };
    countNodes(accounts);
    return count;
  }, [accounts]);

  // Export full chart of accounts to CSV
  // Export template CSV with parent structure + sample child accounts
  const handleExportTemplateSampleCsv = useCallback(() => {
    if (!accounts || accounts.length === 0) {
      notifications.show({
        title: isAr ? 'لا توجد بيانات' : 'No Data',
        message: isAr ? 'شجرة الحسابات فارغة حالياً' : 'Chart of accounts is currently empty',
        color: 'yellow',
      });
      return;
    }

    const rows: string[] = [];

    // Recursive traversal: include all parent/group nodes, but limit leaf children to 2 samples per parent
    const traverseTemplate = (
      nodes: AccountNode[],
      parentCode = '',
      parentName = '',
      pathPrefix = ''
    ) => {
      let leafChildCount = 0;

      nodes.forEach((acc) => {
        const isParentNode = Boolean(acc.isGroup || (acc.children && acc.children.length > 0));

        // If it's a leaf node under a parent, limit to 2 sample accounts to keep template clean
        if (!isParentNode) {
          if (leafChildCount >= 2) return;
          leafChildCount++;
        }

        const currentPath = pathPrefix ? `${pathPrefix} > ${acc.nameAr}` : acc.nameAr;
        const balIqd = Number(acc.balanceIQD ?? acc.balance ?? 0);
        const balUsd = Number(acc.balanceUSD ?? 0);
        const dirIqd = balIqd > 0 ? 'مدين' : balIqd < 0 ? 'دائن' : 'متوازن';
        const dirUsd = balUsd > 0 ? 'مدين' : balUsd < 0 ? 'دائن' : 'متوازن';
        const cardType = isParentNode
          ? 'حساب اب رئيسي'
          : acc.code.startsWith('1614')
          ? 'بطاقة عميل'
          : acc.code.startsWith('2614')
          ? 'بطاقة مورد'
          : acc.code.startsWith('181')
          ? 'صندوق'
          : acc.code.startsWith('182')
          ? 'مصرف'
          : 'بطاقة حساب';

        rows.push(
          [
            acc.level || 1,
            acc.code,
            `"${(acc.nameAr || '').replace(/"/g, '""')}"`,
            `"${cardType}"`,
            `"${acc.nature === 'DEBIT' ? 'مدين' : acc.nature === 'CREDIT' ? 'دائن' : 'كلاهما'}"`,
            `"${(parentName || '').replace(/"/g, '""')}"`,
            parentCode || '',
            acc.code.startsWith('1') || acc.code.startsWith('2') ? 'الميزانية العامه' : 'الارباح والخسائر',
            Math.abs(balUsd),
            dirUsd,
            Math.abs(balIqd),
            dirIqd,
            `"${currentPath.replace(/"/g, '""')}"`,
            'IQD + USD',
          ].join(',')
        );

        if (acc.children && acc.children.length > 0) {
          traverseTemplate(acc.children, acc.code, acc.nameAr, currentPath);
        }
      });
    };

    traverseTemplate(accounts);

    const headerLine =
      'المستوى,رمز الحساب,اسم الحساب,نوع/بطاقة الحساب,طبيعة الرصيد,حساب الأب,رمز الأب,الحساب الختامي,الرصيد المباشر $,جهة الرصيد $,الرصيد المباشر د.ع,جهة الرصيد د.ع,المسار الكامل,العملة الافتراضية';
    const csvContent = '\uFEFF' + headerLine + '\n' + rows.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `نموذج_هيكل_شجرة_الحسابات_مع_أمثلة.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notifications.show({
      title: isAr ? 'تم تصدير النموذج' : 'Template Exported',
      message: isAr
        ? `تم تصدير نموذج الهيكل الشجري (${rows.length.toLocaleString()} حساباً للأب مع أمثلة فرعية) بنجاح`
        : `Exported template model (${rows.length} parent nodes with samples) to CSV`,
      color: 'teal',
    });
  }, [accounts, isAr]);

  const handleExportTreeCsv = useCallback(() => {
    if (!accounts || accounts.length === 0) {
      notifications.show({
        title: isAr ? 'لا توجد بيانات' : 'No Data',
        message: isAr ? 'شجرة الحسابات فارغة حالياً' : 'Chart of accounts is currently empty',
        color: 'yellow',
      });
      return;
    }

    const rows: string[] = [];
    const flattenTree = (nodes: AccountNode[], parentCode = '', parentName = '', pathPrefix = '') => {
      nodes.forEach((acc) => {
        const currentPath = pathPrefix ? `${pathPrefix} > ${acc.nameAr}` : acc.nameAr;
        const balIqd = Number(acc.balanceIQD ?? acc.balance ?? 0);
        const balUsd = Number(acc.balanceUSD ?? 0);
        const dirIqd = balIqd > 0 ? 'مدين' : balIqd < 0 ? 'دائن' : 'متوازن';
        const dirUsd = balUsd > 0 ? 'مدين' : balUsd < 0 ? 'دائن' : 'متوازن';
        const cardType = acc.isGroup
          ? 'حساب اب رئيسي'
          : acc.code.startsWith('1614')
          ? 'بطاقة عميل'
          : acc.code.startsWith('2614')
          ? 'بطاقة مورد'
          : acc.code.startsWith('181')
          ? 'صندوق'
          : acc.code.startsWith('182')
          ? 'مصرف'
          : 'بطاقة حساب';

        rows.push(
          [
            acc.level || 1,
            acc.code,
            `"${(acc.nameAr || '').replace(/"/g, '""')}"`,
            `"${cardType}"`,
            `"${acc.nature === 'DEBIT' ? 'مدين' : acc.nature === 'CREDIT' ? 'دائن' : 'كلاهما'}"`,
            `"${(parentName || '').replace(/"/g, '""')}"`,
            parentCode || '',
            acc.code.startsWith('1') || acc.code.startsWith('2') ? 'الميزانية العامه' : 'الارباح والخسائر',
            Math.abs(balUsd),
            dirUsd,
            Math.abs(balIqd),
            dirIqd,
            `"${currentPath.replace(/"/g, '""')}"`,
            'IQD + USD',
          ].join(',')
        );

        if (acc.children && acc.children.length > 0) {
          flattenTree(acc.children, acc.code, acc.nameAr, currentPath);
        }
      });
    };

    flattenTree(accounts);

    const headerLine =
      'المستوى,رمز الحساب,اسم الحساب,نوع/بطاقة الحساب,طبيعة الرصيد,حساب الأب,رمز الأب,الحساب الختامي,الرصيد المباشر $,جهة الرصيد $,الرصيد المباشر د.ع,جهة الرصيد د.ع,المسار الكامل,العملة الافتراضية';
    const csvContent = '\uFEFF' + headerLine + '\n' + rows.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `شجرة_الحسابات_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notifications.show({
      title: isAr ? 'تم التصدير' : 'Export Successful',
      message: isAr
        ? `تم تصدير ${rows.length.toLocaleString()} حساباً إلى ملف CSV بنجاح`
        : `Exported ${rows.length} accounts to CSV`,
      color: 'teal',
    });
  }, [accounts, isAr]);

  return (
    <div className="p-5 md:p-6 space-y-5 max-w-[1750px] mx-auto w-full select-none font-sans" dir={direction}>
      {/* ── 1. MODERN PAGE HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#F45A0A] border border-orange-200/80 flex items-center justify-center font-bold shadow-xs shrink-0">
            <ListTree size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-black text-slate-900 leading-tight tracking-tight">
                {isAr ? 'دليل وشجرة الحسابات المحاسبية' : 'Chart of Accounts (COA)'}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black font-mono bg-orange-50 text-[#F45A0A] border border-orange-200/80 shadow-2xs">
                <span>{totalAccountsCount.toLocaleString()}</span>
                <span className="text-[11.5px] font-sans font-bold">{isAr ? 'حساب محاسبي' : 'Accounts'}</span>
              </span>
            </div>
            <p className="text-xs font-normal text-slate-500 mt-1">
              {isAr
                ? 'الهيكلية المالية الموحدة، أرصدة الأصول والخصوم والإيرادات والمصروفات والمسارات الشجرية المعتمدة'
                : 'Unified organizational chart of accounts, assets, liabilities, revenues, expenses & postings'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => loadAccounts(true)}
            disabled={loading}
            className="h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-2xs disabled:opacity-50"
            title={isAr ? 'تحديث الشجرة' : 'Refresh Tree'}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-[#F45A0A]' : 'text-slate-500'} />
            <span>{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <Printer size={15} className="text-slate-500" />
            <span>{isAr ? 'طباعة' : 'Print'}</span>
          </button>

          <button
            type="button"
            onClick={() => setImportCsvOpen(true)}
            className="h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-orange-50 hover:text-[#F45A0A] hover:border-orange-200 text-slate-700 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
            title={isAr ? 'استيراد شجرة الحسابات (CSV)' : 'Import Tree (CSV)'}
          >
            <FileSpreadsheet size={16} className="text-[#F45A0A]" />
            <span>{isAr ? 'استيراد الشجرة' : 'Import Tree'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportTemplateSampleCsv}
            className="h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
            title={isAr ? 'تصدير نموذج شجرة الحسابات للأب مع أمثلة قليلة' : 'Export Parent Tree Model with Samples'}
          >
            <FileDown size={16} className="text-[#F45A0A]" />
            <span>{isAr ? 'نموذج الهيكل' : 'Template'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportTreeCsv}
            className="h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
            title={isAr ? 'تصدير شجرة الحسابات الحالية كملف CSV' : 'Export Tree to CSV'}
          >
            <Download size={16} className="text-[#F45A0A]" />
            <span>{isAr ? 'تصدير الشجرة' : 'Export Tree'}</span>
          </button>

          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="h-10 px-4 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer hover:shadow-md active:scale-98"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>{isAr ? 'حساب جديد' : 'New Account'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. PURE ACCOUNTING TREEGRID COMPONENT ── */}
      <AccountingTreeGrid
        accounts={accounts}
        loading={loading}
        onRefresh={() => loadAccounts(true)}
        onAccountsRemoved={removeAccountsLocally}
        onAddAccount={() => setWizardOpen(true)}
        onSelectAccount={(acc) => {
          setSelectedAccount(acc);
          setDrawerOpen(true);
        }}
        onRowDoubleClick={(acc) => {
          setSelectedAccount(acc);
          setDrawerOpen(true);
        }}
      />

      {/* ── 3. SMART ACCOUNT WIZARD MODAL ── */}
      <SmartAccountWizardModal
        opened={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={() => {
          loadAccounts(true);
        }}
        allAccounts={accounts}
        initialData={selectedAccount}
      />

      {/* ── 4. IMPORT ACCOUNTS CSV / TXT MODAL WITH PREVIEW ── */}
      <ImportAccountsCsvModal
        opened={importCsvOpen}
        onClose={() => setImportCsvOpen(false)}
        onSuccess={() => {
          loadAccounts(true);
        }}
      />

      {/* ── 5. ACCOUNT DETAILS DRAWER ── */}
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <ListTree size={18} className="text-[#F45A0A]" />
            <span>{isAr ? 'بطاقة تفاصيل الحساب المحاسبي' : 'Account Details Profile'}</span>
          </div>
        }
        position={direction === 'rtl' ? 'left' : 'right'}
        size="md"
        radius="lg"
      >
        {selectedAccount && (
          <div className="space-y-4 text-xs font-sans" dir={direction}>
            {/* Header Card */}
            <div className="p-4 bg-orange-50/50 border border-orange-200/80 rounded-xl space-y-1.5">
              <span className="text-[11px] text-[#C2410C] font-bold block">{isAr ? 'رمز واسم الحساب' : 'Code & Name'}</span>
              <div className="text-lg font-black text-slate-900 font-mono">
                {selectedAccount.code} — {isAr ? selectedAccount.nameAr : (selectedAccount.nameEn || selectedAccount.nameAr)}
              </div>
              {selectedAccount.nameEn && (
                <div className="text-xs text-slate-500 font-sans">
                  {selectedAccount.nameEn}
                </div>
              )}
            </div>

            {/* Quick Meta Grid */}
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10.5px]">{isAr ? 'نوع الحساب' : 'Account Type'}</span>
                <span className="font-bold text-slate-800 text-xs">{selectedAccount.type}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">{isAr ? 'طبيعة الحساب' : 'Nature'}</span>
                <span className="font-bold text-slate-800 text-xs">
                  {selectedAccount.nature === 'DEBIT' ? (isAr ? 'مدين (Debit)' : 'Debit') : (isAr ? 'دائن (Credit)' : 'Credit')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">{isAr ? 'المستوى' : 'Level'}</span>
                <span className="font-bold text-slate-800 font-mono text-xs">Level {selectedAccount.level}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">{isAr ? 'الحالة' : 'Status'}</span>
                <span className="font-bold text-emerald-600 text-xs">
                  {selectedAccount.status || (isAr ? 'نشط' : 'Active')}
                </span>
              </div>
            </div>

            {/* Financial Balances Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="text-[11px] font-bold text-slate-600 block">{isAr ? 'ملخص الأرصدة المالية' : 'Financial Balances Summary'}</span>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10.5px] text-slate-400 block">{isAr ? 'الرصيد بالدينار (IQD)' : 'Balance (IQD)'}</span>
                  <span className="font-mono font-black text-sm text-slate-900 block mt-0.5" dir="ltr">
                    {(selectedAccount.balanceIQD || selectedAccount.balance || 0).toLocaleString()} IQD
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10.5px] text-slate-400 block">{isAr ? 'الرصيد بالدولار ($ USD)' : 'Balance (USD)'}</span>
                  <span className="font-mono font-black text-sm text-blue-700 block mt-0.5" dir="ltr">
                    ${(selectedAccount.balanceUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ChartOfAccountsPage;
