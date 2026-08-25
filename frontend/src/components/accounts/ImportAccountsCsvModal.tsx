import React, { useState, useMemo } from 'react';
import { Modal, Button, Badge, TextInput, Tooltip, Alert } from '@mantine/core';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Search,
  FolderTree,
  Coins,
  FileUp,
  X,
  Layers,
  ArrowUpDown,
  FileCheck,
} from 'lucide-react';
import { accountsApi } from '../../api/accounts';
import { useLanguageStore } from '../../store/useLanguageStore';
import { notifications } from '@mantine/notifications';

interface ImportAccountsCsvModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Universal CSV parser handling quotes and delimiters
function parseCsvLine(text: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function detectDelimiter(firstLine: string): string {
  if (firstLine.includes('\t')) return '\t';
  if (firstLine.includes(';') && !firstLine.includes(',')) return ';';
  if (firstLine.includes('|')) return '|';
  return ',';
}

export const ImportAccountsCsvModal: React.FC<ImportAccountsCsvModalProps> = ({
  opened,
  onClose,
  onSuccess,
}) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [wipeExisting, setWipeExisting] = useState<boolean>(true);
  const [importBalances, setImportBalances] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isWiping, setIsWiping] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleClose = () => {
    if (isImporting || isWiping) return;
    setFileName('');
    setFileSize('');
    setParsedRows([]);
    setSearchFilter('');
    onClose();
  };

  const handleClearFile = () => {
    setFileName('');
    setFileSize('');
    setParsedRows([]);
    setSearchFilter('');
  };

  // Download Sample Template CSV
  const handleDownloadSampleCsv = () => {
    const csvContent =
      '\uFEFF' +
      `المستوى,رمز الحساب,اسم الحساب,نوع/بطاقة الحساب,طبيعة الرصيد,حساب الأب,رمز الأب,الحساب الختامي,الرصيد المباشر $,جهة الرصيد $,الرصيد المباشر د.ع,جهة الرصيد د.ع,المسار الكامل,العملة الافتراضية\n` +
      `1,1,الموجودات,حساب اب رئيسي,كلاهما,,,الميزانية العامه,0,متوازن,0,متوازن,الموجودات,Dollar\n` +
      `2,11,الموجودات الثابتة,حساب اب رئيسي,كلاهما,الموجودات,1,الميزانية العامه,0,متوازن,0,متوازن,الموجودات > الموجودات الثابتة,Dollar\n` +
      `3,116,اثاث واجهزة مكاتب,حساب اب رئيسي,كلاهما,الموجودات الثابتة,11,الميزانية العامه,0,متوازن,0,متوازن,الموجودات > الموجودات الثابتة > اثاث واجهزة مكاتب,Dollar\n` +
      `3,1161,اثاث,بطاقة حساب,كلاهما,اثاث واجهزة مكاتب,116,الميزانية العامه,3500,مدين,0,متوازن,الموجودات > الموجودات الثابتة > اثاث واجهزة مكاتب > اثاث,Dollar\n` +
      `2,18,الاموال الجاهزة,حساب اب رئيسي,كلاهما,الموجودات,1,الميزانية العامه,0,متوازن,0,متوازن,الموجودات > الاموال الجاهزة,Dollar\n` +
      `3,181,نقدية بالصندوق,حساب اب رئيسي,كلاهما,الاموال الجاهزة,18,الميزانية العامه,0,متوازن,0,متوازن,الموجودات > الاموال الجاهزة > نقدية بالصندوق,Dollar\n` +
      `4,181001,صندوق الفرع الرئيسي,صندوق,كلاهما,نقدية بالصندوق,181,الميزانية العامه,10000,مدين,15000000,مدين,الموجودات > الاموال الجاهزة > نقدية بالصندوق > صندوق الفرع الرئيسي,Dollar\n` +
      `3,1614,مدينون قطاع خاص,حساب اب رئيسي,كلاهما,المدينون,161,الميزانية العامه,0,متوازن,0,متوازن,الموجودات > المدينون > مدينون قطاع خاص,Dollar\n` +
      `4,1614001,شركة النور للسياحة,بطاقة عميل,مدين,مدينون قطاع خاص,1614,الميزانية العامه,110.4,دائن,752.2,دائن,الموجودات > المدينون > مدينون قطاع خاص > شركة النور,Dollar\n` +
      `4,1614002,المصطفى بابل,بطاقة عميل,مدين,مدينون قطاع خاص,1614,الميزانية العامه,9.7,مدين,0,متوازن,الموجودات > المدينون > مدينون قطاع خاص > المصطفى بابل,Dollar\n` +
      `1,2,المطلوبات,حساب اب رئيسي,كلاهما,,,الميزانية العامه,0,متوازن,0,متوازن,المطلوبات,Dollar\n` +
      `2,2614,موردو التذاكر وشركات الطيران,حساب اب رئيسي,كلاهما,الدائنون,261,الميزانية العامه,0,متوازن,0,متوازن,المطلوبات > الدائنون > موردو التذاكر,Dollar\n` +
      `3,2614001,الخطوط الجوية العراقية,بطاقة مورد,دائن,موردو التذاكر,2614,الميزانية العامه,2500,دائن,0,متوازن,المطلوبات > الدائنون > موردو التذاكر > الخطوط العراقية,Dollar\n` +
      `1,3,الاستخدامات (المصروفات),حساب اب رئيسي,كلاهما,,,الارباح والخسائر,0,متوازن,0,متوازن,الاستخدامات (المصروفات),Dollar\n` +
      `2,301,مصاريف أثاث,بطاقة حساب,مدين,الاستخدامات,3,الارباح والخسائر,0,متوازن,0,متوازن,الاستخدامات > مصاريف أثاث,Dollar\n` +
      `1,4,الموارد (الإيرادات),حساب اب رئيسي,كلاهما,,,الارباح والخسائر,0,متوازن,0,متوازن,الموارد (الإيرادات),Dollar\n` +
      `2,401,إيرادات تذاكر الطيران,بطاقة حساب,دائن,الموارد,4,الارباح والخسائر,0,متوازن,0,متوازن,الموارد > إيرادات تذاكر الطيران,Dollar\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'دليل_شجرة_الحسابات_المعتمد.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Upload and Parse
  const handleFileUpload = (uploadedFile: File) => {
    setFileName(uploadedFile.name);
    setFileSize((uploadedFile.size / 1024).toFixed(1) + ' KB');

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      processFileText(text);
    };
    reader.readAsText(uploadedFile, 'UTF-8');
  };

  const processFileText = (content: string) => {
    const rawLines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (rawLines.length === 0) return;

    const firstLine = rawLines[0].replace(/^\uFEFF/, '');
    const delimiter = detectDelimiter(firstLine);

    const pattern = /^(\s*)(?:[└├]─\s*)?(\d+)\s*-\s*(.+)$/;
    const isTextTree = pattern.test(firstLine) || (rawLines[1] && pattern.test(rawLines[1]));

    if (isTextTree) {
      parseTextTree(rawLines);
    } else {
      parseFullCsv(rawLines, delimiter);
    }
  };

  const parseFullCsv = (rawLines: string[], delimiter: string) => {
    const headers = parseCsvLine(rawLines[0].replace(/^\uFEFF/, ''), delimiter).map((h) => h.trim());

    // Specific header finder to prevent substring collisions
    const findExact = (targetNames: string[]) => {
      for (const target of targetNames) {
        for (let i = 0; i < headers.length; i++) {
          if (headers[i] === target) return i;
        }
      }
      for (const target of targetNames) {
        for (let i = 0; i < headers.length; i++) {
          if (headers[i].toLowerCase() === target.toLowerCase()) return i;
        }
      }
      for (const target of targetNames) {
        for (let i = 0; i < headers.length; i++) {
          if (headers[i].toLowerCase().includes(target.toLowerCase())) return i;
        }
      }
      return -1;
    };

    const levelIdx = findExact(['المستوى', 'المرتبة', 'level']);
    const codeIdx = findExact(['رمز الحساب', 'الرمز المحاسبي', 'كود الحساب', 'الرمز', 'code', 'account_code']);
    const nameIdx = findExact(['اسم الحساب', 'اسم_الحساب', 'account_name', 'namear', 'name']);
    const cardTypeIdx = findExact(['نوع/بطاقة الحساب', 'نوع الحساب', 'بطاقة الحساب', 'card_type', 'type']);
    const natureIdx = findExact(['طبيعة الرصيد', 'طبيعة الحساب', 'طبيعة', 'nature']);
    const parentCodeIdx = findExact(['رمز الأب', 'رمز الاب', 'كود الاب', 'parent_code', 'parentCode', 'parent']);
    const curIdx = findExact(['العملة الافتراضية', 'العملة', 'currency', 'cur']);
    const pathIdx = findExact(['المسار الكامل', 'المسار', 'شجرة الحسابات', 'path']);

    // USD Balance indices
    const balUsdDirectIdx = findExact(['الرصيد المباشر $', 'صافي مباشر $', 'رصيد $', 'balance_usd', 'opening_usd']);
    const natureUsdIdx = findExact(['جهة الرصيد $', 'جهة $', 'طبيعة $']);

    // IQD Balance indices
    const balIqdDirectIdx = findExact(['الرصيد المباشر د.ع', 'صافي مباشر د.ع', 'رصيد د.ع', 'balance_iqd', 'opening_iqd']);
    const natureIqdIdx = findExact(['جهة الرصيد د.ع', 'جهة د.ع', 'طبيعة د.ع']);

    const rows: any[] = [];
    const seenCodesInFile = new Map<string, number>();

    for (let i = 1; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) continue;
      const cols = parseCsvLine(line, delimiter);

      const code = (cols[codeIdx !== -1 ? codeIdx : 1] || cols[0] || '').trim();
      const nameAr = (cols[nameIdx !== -1 ? nameIdx : 2] || cols[1] || '').trim();
      if (!code || !nameAr) continue;

      const parentCode = (parentCodeIdx !== -1 ? cols[parentCodeIdx] || '' : '').trim();
      const rawLevel = Number(cols[levelIdx !== -1 ? levelIdx : 0]) || 1;
      const rawCardType = cols[cardTypeIdx !== -1 ? cardTypeIdx : 3] || '';
      const rawNature = cols[natureIdx !== -1 ? natureIdx : 4] || 'كلاهما';
      const treePath = pathIdx !== -1 ? cols[pathIdx] || '' : '';
      const rawCurrency = (curIdx !== -1 ? cols[curIdx] || 'Dollar' : 'Dollar').trim();

      // Balances
      const rawBalUsd = cols[balUsdDirectIdx !== -1 ? balUsdDirectIdx : -1] || '0';
      const rawBalIqd = cols[balIqdDirectIdx !== -1 ? balIqdDirectIdx : -1] || '0';
      const balUsd = Math.abs(Number(rawBalUsd.replace(/[^\d.-]/g, '')) || 0);
      const balIqd = Math.abs(Number(rawBalIqd.replace(/[^\d.-]/g, '')) || 0);

      const natureUsd = (cols[natureUsdIdx !== -1 ? natureUsdIdx : -1] || (balUsd > 0 ? 'مدين' : 'متوازن')).trim();
      const natureIqd = (cols[natureIqdIdx !== -1 ? natureIqdIdx : -1] || (balIqd > 0 ? 'مدين' : 'متوازن')).trim();

      const isParent =
        rawCardType.includes('رئيسي') ||
        rawCardType.includes('اب') ||
        rawCardType.includes('أب') ||
        rawCardType.includes('Group');

      let type = 'ASSET';
      const c0 = code[0];
      if (c0 === '1') type = 'ASSET';
      else if (c0 === '2') type = code.startsWith('21') || code.startsWith('22') ? 'EQUITY' : 'LIABILITY';
      else if (c0 === '3') type = 'EXPENSE';
      else if (c0 === '4') type = 'REVENUE';

      let category = 'GENERAL';
      if (rawCardType.includes('عميل') || code.startsWith('1614') || code.startsWith('161')) category = 'CUSTOMER';
      else if (rawCardType.includes('مورد') || code.startsWith('2614') || code.startsWith('261')) category = 'SUPPLIER';
      else if (rawCardType.includes('صندوق') || code.startsWith('181') || code.startsWith('121') || nameAr.includes('صندوق') || nameAr.includes('قاصة') || nameAr.includes('بورصة')) category = 'CASH';
      else if (rawCardType.includes('مصرف') || code.startsWith('182') || code.startsWith('122') || nameAr.includes('مصرف') || nameAr.includes('بنك')) category = 'BANK';

      let currencyLabel = 'USD';
      let currencyCode = 'USD';
      if (balUsd > 0 && balIqd > 0) {
        currencyLabel = 'USD + IQD';
        currencyCode = 'USD';
      } else if (balIqd > 0 && balUsd === 0) {
        currencyLabel = 'IQD';
        currencyCode = 'IQD';
      } else if (balUsd > 0 && balIqd === 0) {
        currencyLabel = 'USD';
        currencyCode = 'USD';
      } else {
        const u = rawCurrency.toUpperCase();
        if (u.includes('DINAR') || u.includes('IQD') || u.includes('دينار')) {
          currencyLabel = 'IQD';
          currencyCode = 'IQD';
        } else {
          currencyLabel = 'USD';
          currencyCode = 'USD';
        }
      }

      // Auto-disambiguate duplicate codes in the same CSV
      let uniqueCode = code;
      if (seenCodesInFile.has(code)) {
        const dupCount = (seenCodesInFile.get(code) || 0) + 1;
        seenCodesInFile.set(code, dupCount);
        uniqueCode = `${code}-${dupCount}`;
      } else {
        seenCodesInFile.set(code, 0);
      }

      rows.push({
        code: uniqueCode,
        originalCode: code,
        nameAr,
        parentCode,
        level: rawLevel,
        isParent,
        cardType: rawCardType || (isParent ? 'حساب اب رئيسي' : 'بطاقة حساب'),
        nature: rawNature,
        type,
        category,
        currency: currencyCode,
        currencyLabel,
        openingAmountUSD: balUsd,
        openingNatureUSD: natureUsd,
        openingAmountIQD: balIqd,
        openingNatureIQD: natureIqd,
        treePath,
        isValid: true,
      });
    }

    finalizeHierarchy(rows);
  };

  const parseTextTree = (lines: string[]) => {
    const stack: { indent: number; code: string }[] = [];
    const pattern = /^(\s*)(?:[└├]─\s*)?(\d+)\s*-\s*(.+)$/;
    const rows: any[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trimEnd();
      const m = line.match(pattern);
      if (!m) continue;

      const indent = m[1].length;
      const code = m[2].trim();
      const name = m[3].trim();

      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const parentCode = stack.length > 0 ? stack[stack.length - 1].code : '';
      const level = stack.length + 1;

      let type = 'ASSET';
      const c0 = code[0];
      if (c0 === '1') type = 'ASSET';
      else if (c0 === '2') type = code.startsWith('21') || code.startsWith('22') ? 'EQUITY' : 'LIABILITY';
      else if (c0 === '3') type = 'EXPENSE';
      else if (c0 === '4') type = 'REVENUE';

      let category = 'GENERAL';
      if (code.startsWith('181') || code.startsWith('121') || name.includes('صندوق') || name.includes('قاصة') || name.includes('بورصة')) category = 'CASH';
      else if (code.startsWith('182') || code.startsWith('122') || name.includes('مصرف') || name.includes('بنك')) category = 'BANK';
      else if (code.startsWith('161') || name.includes('مدينون') || parentCode.startsWith('161')) category = 'CUSTOMER';
      else if (code.startsWith('261') || name.includes('دائنون') || parentCode.startsWith('261')) category = 'SUPPLIER';

      rows.push({
        code,
        nameAr: name,
        parentCode,
        level,
        isParent: false,
        cardType: 'بطاقة حساب',
        nature: 'كلاهما',
        type,
        category,
        currency: 'USD',
        currencyLabel: 'USD',
        openingAmountUSD: 0,
        openingNatureUSD: 'متوازن',
        openingAmountIQD: 0,
        openingNatureIQD: 'متوازن',
        treePath: '',
        isValid: true,
      });

      stack.push({ indent, code });
    }

    finalizeHierarchy(rows);
  };

  const finalizeHierarchy = (rows: any[]) => {
    const parentCodeSet = new Set<string>();
    rows.forEach((r) => {
      if (r.parentCode) parentCodeSet.add(r.parentCode);
    });

    const codeMap = new Map<string, any>();
    rows.forEach((r) => codeMap.set(r.code, r));

    rows.forEach((r) => {
      if (parentCodeSet.has(r.code)) {
        r.isParent = true;
        if (!r.cardType || r.cardType === 'بطاقة حساب') r.cardType = 'حساب اب رئيسي';
      }

      if (r.parentCode && !codeMap.has(r.parentCode)) {
        r.isValid = false;
        r.errorMsg = isAr
          ? `الحساب الأب (${r.parentCode}) غير موجود في الملف`
          : `Parent (${r.parentCode}) not found`;
      }
    });

    setParsedRows(rows);
  };

  // Preview Statistics
  const stats = useMemo(() => {
    const total = parsedRows.length;
    const roots = parsedRows.filter((r) => r.level === 1 || !r.parentCode).length;
    const parents = parsedRows.filter((r) => r.isParent).length;
    const customers = parsedRows.filter((r) => r.category === 'CUSTOMER').length;
    const suppliers = parsedRows.filter((r) => r.category === 'SUPPLIER').length;
    const maxLevel = total > 0 ? Math.max(...parsedRows.map((r) => r.level)) : 0;

    let totalUsdDebit = 0;
    let totalUsdCredit = 0;
    let totalIqdDebit = 0;
    let totalIqdCredit = 0;
    let withBalances = 0;

    if (importBalances) {
      parsedRows.forEach((r) => {
        const u = Number(r.openingAmountUSD) || 0;
        const i = Number(r.openingAmountIQD) || 0;
        if (u > 0 || i > 0) withBalances++;

        if (u > 0) {
          if (r.openingNatureUSD === 'مدين' || r.openingNatureUSD === 'DEBIT') totalUsdDebit += u;
          else totalUsdCredit += u;
        }
        if (i > 0) {
          if (r.openingNatureIQD === 'مدين' || r.openingNatureIQD === 'DEBIT') totalIqdDebit += i;
          else totalIqdCredit += i;
        }
      });
    }

    return {
      total,
      roots,
      parents,
      customers,
      suppliers,
      maxLevel,
      withBalances,
      totalUsdDebit,
      totalUsdCredit,
      totalIqdDebit,
      totalIqdCredit,
    };
  }, [parsedRows, importBalances]);

  // Filtered Rows for Table Preview
  const filteredRows = useMemo(() => {
    if (!searchFilter.trim()) return parsedRows;
    const q = searchFilter.trim().toLowerCase();
    return parsedRows.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.nameAr.toLowerCase().includes(q) ||
        (r.parentCode && r.parentCode.toLowerCase().includes(q)) ||
        (r.treePath && r.treePath.toLowerCase().includes(q)) ||
        (r.cardType && r.cardType.toLowerCase().includes(q))
    );
  }, [parsedRows, searchFilter]);

  // Confirm Import
  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;

    setIsImporting(true);
    try {
      const accountsPayload = parsedRows.map((r) => ({
        ...r,
        openingAmountUSD: importBalances ? r.openingAmountUSD : 0,
        openingNatureUSD: importBalances ? r.openingNatureUSD : 'متوازن',
        openingAmountIQD: importBalances ? r.openingAmountIQD : 0,
        openingNatureIQD: importBalances ? r.openingNatureIQD : 'متوازن',
      }));

      const res = await accountsApi.importTree(accountsPayload, wipeExisting);

      notifications.show({
        title: isAr ? 'نجاح الاستيراد' : 'Import Successful',
        message: isAr
          ? `تم استيراد ${res.totalInserted} حساباً وتحديث ${res.customersCreated || 0} عميل و ${res.suppliersCreated || 0} مورد بنجاح!`
          : `Successfully imported ${res.totalInserted} accounts!`,
        color: 'teal',
        icon: <CheckCircle2 size={18} />,
        autoClose: 6000,
      });

      onSuccess();
      handleClose();
    } catch (err: any) {
      notifications.show({
        title: isAr ? 'خطأ في الاستيراد' : 'Import Error',
        message: err.message || (isAr ? 'حدث خطأ أثناء استيراد شجرة الحسابات' : 'An error occurred during import'),
        color: 'red',
        icon: <AlertTriangle size={18} />,
        autoClose: 7000,
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Direct Wipe Current Tree
  const handleWipeCurrentTree = async () => {
    if (
      !window.confirm(
        isAr
          ? 'هل أنت متأكد من مسح شجرة الحسابات الحالية بالكامل؟ لا يمكن التراجع عن هذا الإجراء.'
          : 'Are you sure you want to completely wipe all accounts from the database?'
      )
    ) {
      return;
    }

    setIsWiping(true);
    try {
      await accountsApi.wipeAll();
      notifications.show({
        title: isAr ? 'تم مسح الشجرة بالكامل' : 'Accounts Cleared',
        message: isAr ? 'تم تفريغ شجرة الحسابات بالكامل من قاعدة البيانات بنجاح.' : 'Chart of accounts wiped successfully.',
        color: 'orange',
        icon: <Trash2 size={18} />,
      });
      onSuccess();
    } catch (err: any) {
      notifications.show({
        title: isAr ? 'خطأ في المسح' : 'Wipe Error',
        message: err.message || 'Error wiping accounts',
        color: 'red',
      });
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      size="96vw"
      radius="20px"
      dir={direction}
      withCloseButton={false}
      styles={{
        inner: { padding: '12px' },
        content: {
          maxWidth: '1600px',
          width: '96vw',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        },
        body: {
          padding: '0',
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 auto',
          overflow: 'hidden',
        },
      }}
    >
      <div className="flex flex-col h-full font-sans text-xs bg-white select-none" dir={direction}>
        {/* ── 1. LUXURY TOP HEADER BAR ── */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50/80 via-white to-orange-50/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F45A0A] text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
              <FileSpreadsheet size={22} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-slate-900 leading-tight">
                  {isAr ? 'استيراد ومعاينة شجرة الحسابات والأرصدة' : 'Import & Preview Chart of Accounts & Balances'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-100 text-[#C2410C]">
                  CSV / TXT (32 عموداً)
                </span>
              </div>
              <p className="text-[11.5px] text-slate-500 font-medium mt-0.5">
                {isAr
                  ? 'رفع ملف الدليل المحاسبي الشامل مع المعاينة الحية للأرصدة والمستويات الهرمية والربط المباشر'
                  : 'Import ERP chart of accounts with dual balances, hierarchy validation, and customer/supplier auto-linking'}
              </p>
            </div>
          </div>

          {/* Header Actions & Close */}
          <div className="flex items-center gap-2.5">
            <Tooltip label={isAr ? 'تحميل نموذج CSV يطابق هيكل النظام المحاسبي' : 'Download sample template'}>
              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Download size={14} className="text-[#F45A0A]" />
                <span>{isAr ? 'تحميل نموذج CSV' : 'Sample CSV'}</span>
              </button>
            </Tooltip>

            <Tooltip label={isAr ? 'مسح شجرة الحسابات الحالية بالكامل من قاعدة البيانات' : 'Wipe all accounts from database'}>
              <button
                type="button"
                onClick={handleWipeCurrentTree}
                disabled={isWiping}
                className="h-9 px-3.5 rounded-xl border border-red-200 bg-red-50/60 hover:bg-red-100/80 text-red-700 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Trash2 size={14} />
                <span>{isWiping ? (isAr ? 'جاري المسح...' : 'Wiping...') : (isAr ? 'مسح الشجرة الحالية' : 'Wipe All')}</span>
              </button>
            </Tooltip>

            <button
              type="button"
              onClick={handleClose}
              className="w-9 h-9 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer border border-transparent hover:border-slate-200"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── 2. MODAL BODY ── */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 bg-slate-50/40">
          {/* File Upload Zone */}
          {!parsedRows.length ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
              className={`p-10 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center gap-3 bg-white ${
                isDragging
                  ? 'border-[#F45A0A] bg-orange-50/60 shadow-md ring-4 ring-orange-100'
                  : 'border-slate-300 hover:border-orange-400 hover:bg-orange-50/20 shadow-2xs'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#F45A0A] shadow-sm">
                <FileUp size={30} strokeWidth={2} />
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-slate-900 text-sm">
                  {isAr ? 'اسحب وأفلت ملف شجرة الحسابات هنا، أو اضغط للتصفح' : 'Drag & drop chart file here, or click to browse'}
                </h4>
                <p className="text-slate-500 text-xs max-w-md">
                  {isAr
                    ? 'يدعم ملفات CSV المعيارية، ملفات Excel المصدرة بـ 32 عموداً، وملفات الشجرة النصية TXT'
                    : 'Supports standard CSV, 32-column ERP exports, and TXT tree hierarchies'}
                </p>
              </div>

              <label className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F45A0A] hover:bg-[#dd4f05] text-white font-bold text-xs cursor-pointer shadow-sm hover:shadow-md transition-all">
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <Upload size={15} />
                <span>{isAr ? 'اختيار ملف شجرة الحسابات' : 'Select Chart File'}</span>
              </label>
            </div>
          ) : (
            /* File Active Banner */
            <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-bold">
                  <FileCheck size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-xs">{fileName}</span>
                    <span className="text-[10.5px] font-mono text-slate-400">({fileSize})</span>
                  </div>
                  <span className="text-[11px] text-emerald-700 font-bold">
                    {isAr
                      ? `تم قراءة ${parsedRows.length.toLocaleString()} حساباً بنجاح ومطابقة كافة الأعمدة`
                      : `Successfully read ${parsedRows.length} accounts`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition-colors flex items-center gap-1.5">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <Upload size={13} className="text-slate-500" />
                  <span>{isAr ? 'تغيير الملف' : 'Change File'}</span>
                </label>

                <button
                  type="button"
                  onClick={handleClearFile}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  title={isAr ? 'إلغاء الملف' : 'Remove file'}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── 3. KPI STATS SUMMARY (WHEN FILE LOADED) ── */}
          {parsedRows.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="block text-[11px] font-bold text-slate-500">{isAr ? 'إجمالي الحسابات' : 'Total Accounts'}</span>
                <span className="font-mono font-black text-lg text-slate-900 mt-0.5 block">{stats.total.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="block text-[11px] font-bold text-slate-500">{isAr ? 'حسابات العملاء (1614)' : 'Customers'}</span>
                <span className="font-mono font-black text-lg text-blue-600 mt-0.5 block">{stats.customers.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="block text-[11px] font-bold text-slate-500">{isAr ? 'حسابات الموردين (2614)' : 'Suppliers'}</span>
                <span className="font-mono font-black text-lg text-purple-600 mt-0.5 block">{stats.suppliers.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="block text-[11px] font-bold text-slate-500">{isAr ? 'أرصدة الدولار ($)' : 'USD Balances'}</span>
                <span className={`font-mono font-black text-sm mt-1 block ${importBalances ? 'text-emerald-700' : 'text-slate-400 line-through'}`} dir="ltr">
                  ${importBalances ? stats.totalUsdDebit.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '0.0'}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="block text-[11px] font-bold text-slate-500">{isAr ? 'أرصدة الدينار (د.ع)' : 'IQD Balances'}</span>
                <span className={`font-mono font-black text-sm mt-1 block ${importBalances ? 'text-slate-800' : 'text-slate-400 line-through'}`} dir="ltr">
                  {importBalances ? stats.totalIqdDebit.toLocaleString() : '0'} IQD
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="block text-[11px] font-bold text-slate-500">{isAr ? 'العمق الهرمي' : 'Tree Depth'}</span>
                <span className="font-mono font-black text-lg text-amber-600 mt-0.5 block">{stats.maxLevel} مستويات</span>
              </div>
            </div>
          )}

          {/* ── 4. PREVIEW GRID TABLE (WHEN FILE LOADED) ── */}
          {parsedRows.length > 0 && (
            <div className="space-y-2.5 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                    <FolderTree size={15} className="text-[#F45A0A]" />
                    {isAr ? 'المعاينة المطابقة لملف النظام المحاسبي:' : 'Live Pre-Import Grid:'}
                  </span>
                  <Badge size="sm" variant="light" color="orange" className="font-bold">
                    {filteredRows.length} {isAr ? 'حساب معروض' : 'rows'}
                  </Badge>
                  {!importBalances && (
                    <Badge size="sm" variant="filled" color="gray" className="font-bold">
                      {isAr ? 'وضع الاستيراد: بدون أرصدة (تصفير الأرصدة)' : 'No Balances Mode'}
                    </Badge>
                  )}
                </div>

                <TextInput
                  placeholder={isAr ? 'بحث في المعاينة (الرمز، اسم الحساب، رمز الأب، المسار)...' : 'Search preview...'}
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  size="xs"
                  radius="md"
                  className="w-80"
                  leftSection={<Search size={13} className="text-slate-400" />}
                />
              </div>

              {/* Table Container */}
              <div className="max-h-[380px] overflow-y-auto overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-right text-xs border-collapse min-w-[1200px]">
                  <thead className="bg-slate-100 sticky top-0 border-b border-slate-300 z-10">
                    <tr className="text-slate-700 font-black text-[11px]">
                      <th className="py-2.5 px-2.5 w-12 text-center">#</th>
                      <th className="py-2.5 px-2 w-14 text-center">{isAr ? 'المستوى' : 'Level'}</th>
                      <th className="py-2.5 px-3 w-28">{isAr ? 'رمز الحساب' : 'Code'}</th>
                      <th className="py-2.5 px-4 min-w-[230px]">{isAr ? 'اسم الحساب' : 'Account Name'}</th>
                      <th className="py-2.5 px-3 w-32">{isAr ? 'نوع/بطاقة الحساب' : 'Card Type'}</th>
                      <th className="py-2.5 px-2.5 w-24">{isAr ? 'رمز الأب' : 'Parent Code'}</th>
                      <th className="py-2.5 px-3 w-28 text-left">{isAr ? 'رصيد مباشر ($)' : 'Bal ($)'}</th>
                      <th className="py-2.5 px-2 w-20 text-center">{isAr ? 'جهة ($)' : 'Dir ($)'}</th>
                      <th className="py-2.5 px-3 w-32 text-left">{isAr ? 'رصيد مباشر (د.ع)' : 'Bal (IQD)'}</th>
                      <th className="py-2.5 px-2 w-20 text-center">{isAr ? 'جهة (د.ع)' : 'Dir (IQD)'}</th>
                      <th className="py-2.5 px-2 w-24 text-center">{isAr ? 'العملة' : 'Currency'}</th>
                      <th className="py-2.5 px-4">{isAr ? 'المسار الكامل' : 'Full Tree Path'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {filteredRows.slice(0, 300).map((row, idx) => {
                      const displayBalUsd = importBalances ? row.openingAmountUSD : 0;
                      const displayBalIqd = importBalances ? row.openingAmountIQD : 0;
                      const displayNatureUsd = importBalances ? row.openingNatureUSD : 'متوازن';
                      const displayNatureIqd = importBalances ? row.openingNatureIQD : 'متوازن';

                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-orange-50/40 transition-colors ${row.isParent ? 'bg-slate-50/80 font-bold' : ''}`}
                        >
                          <td className="py-2 px-2.5 text-center text-slate-400 font-mono text-[10.5px]">{idx + 1}</td>
                          <td className="py-2 px-2 text-center">
                            <span className="font-mono px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 text-[10px] font-bold">
                              L{row.level}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono font-black text-slate-900 text-xs">{row.code}</td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-1.5" style={{ paddingRight: `${Math.max(0, (row.level - 1) * 10)}px` }}>
                              {row.level > 1 && <span className="text-slate-300 font-mono">└─</span>}
                              <span className={row.isParent ? 'font-black text-slate-900 text-[12.5px]' : 'text-slate-800 text-[12px]'}>
                                {row.nameAr}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <Badge
                              size="sm"
                              variant="light"
                              color={
                                row.cardType.includes('عميل')
                                  ? 'blue'
                                  : row.cardType.includes('مورد')
                                  ? 'purple'
                                  : row.cardType.includes('صندوق')
                                  ? 'teal'
                                  : row.cardType.includes('مصرف')
                                  ? 'green'
                                  : row.isParent
                                  ? 'gray'
                                  : 'orange'
                              }
                              className="text-[10px] px-2 py-0.5"
                            >
                              {row.cardType}
                            </Badge>
                          </td>
                          <td className="py-2 px-2.5 font-mono text-slate-500 text-[11px]">{row.parentCode || '—'}</td>
                          <td className="py-2 px-3 text-left font-mono font-black text-emerald-700 text-xs">
                            {displayBalUsd ? `$${Number(displayBalUsd).toLocaleString()}` : '0.0'}
                          </td>
                          <td className="py-2 px-2 text-center text-[10.5px]">
                            <span
                              className={`px-1.5 py-0.5 rounded ${
                                displayNatureUsd === 'مدين'
                                  ? 'bg-blue-50 text-blue-700 font-bold'
                                  : displayNatureUsd === 'دائن'
                                  ? 'bg-red-50 text-red-700 font-bold'
                                  : 'text-slate-400'
                              }`}
                            >
                              {displayNatureUsd}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-slate-800 text-xs">
                            {displayBalIqd ? Number(displayBalIqd).toLocaleString() : '0.0'}
                          </td>
                          <td className="py-2 px-2 text-center text-[10.5px]">
                            <span
                              className={`px-1.5 py-0.5 rounded ${
                                displayNatureIqd === 'مدين'
                                  ? 'bg-blue-50 text-blue-700 font-bold'
                                  : displayNatureIqd === 'دائن'
                                  ? 'bg-red-50 text-red-700 font-bold'
                                  : 'text-slate-400'
                              }`}
                            >
                              {displayNatureIqd}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <Badge
                              size="sm"
                              variant="outline"
                              color={
                                row.currencyLabel.includes('+')
                                  ? 'indigo'
                                  : row.currencyLabel === 'USD'
                                  ? 'teal'
                                  : 'orange'
                              }
                              className="text-[10px] px-1.5 py-0.5"
                            >
                              {row.currencyLabel}
                            </Badge>
                          </td>
                          <td className="py-2 px-4 text-[11px] text-slate-500 max-w-sm truncate" title={row.treePath}>
                            {row.treePath || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredRows.length > 300 && (
                  <div className="p-2.5 text-center text-slate-500 text-xs bg-slate-50 border-t border-slate-200">
                    {isAr
                      ? `يتم عرض أول 300 حساب في المعاينة من إجمالي ${filteredRows.length} حساب.`
                      : `Showing first 300 of ${filteredRows.length} rows.`}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── 5. LUXURY FOOTER BAR WITH CLEAN OPTIONS ── */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          {/* Options */}
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={wipeExisting}
                onChange={(e) => setWipeExisting(e.target.checked)}
                className="w-4 h-4 rounded text-[#F45A0A] focus:ring-orange-400 accent-[#F45A0A]"
              />
              <span className="font-bold text-slate-800 text-xs">
                {isAr ? 'مسح الشجرة الحالية واستبدالها بالكامل (موصى به)' : 'Wipe & replace current chart (Recommended)'}
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none bg-orange-50/80 px-3 py-1.5 rounded-xl border border-orange-200/80">
              <input
                type="checkbox"
                checked={importBalances}
                onChange={(e) => setImportBalances(e.target.checked)}
                className="w-4 h-4 rounded text-[#F45A0A] focus:ring-orange-400 accent-[#F45A0A]"
              />
              <span className="font-extrabold text-[#C2410C] text-xs">
                {isAr
                  ? 'استيراد الأرصدة الافتتاحية المباشرة (دينار ودولار)'
                  : 'Import direct opening balances'}
              </span>
              <span className="text-[10.5px] text-slate-500 font-medium">
                {isAr ? '(ألغِ التحديد للاستيراد بدون أرصدة)' : '(Uncheck for zero balances)'}
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <Button
              variant="default"
              size="sm"
              disabled={isImporting}
              onClick={handleClose}
              className="rounded-xl font-bold h-10 px-4 border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>

            <Button
              size="sm"
              color="orange"
              variant="filled"
              disabled={parsedRows.length === 0 || isImporting}
              loading={isImporting}
              onClick={handleConfirmImport}
              className="bg-[#F45A0A] hover:bg-[#dd4f05] rounded-xl font-black h-10 px-7 text-white shadow-md shadow-orange-500/20 cursor-pointer text-xs transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              {isAr
                ? `تأكيد واستيراد (${parsedRows.length.toLocaleString()} حساب ${importBalances ? 'مع الأرصدة' : 'بدون أرصدة'})`
                : `Confirm & Import (${parsedRows.length} ${importBalances ? 'with balances' : 'no balances'})`}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
