import React, { useState, useMemo } from 'react';
import {
  Modal,
  Button,
  Paper,
  Badge,
  Textarea,
} from '@mantine/core';
import {
  Sparkles,
  Check,
  ClipboardPaste,
  FileSpreadsheet,
  Users,
  Trash2,
} from 'lucide-react';
import { type VisaPassengerItem } from './VisaIssueModal';
import { showSuccessNotification, showWarningNotification } from '../../utils/notifications';

interface SmartVisaImportModalProps {
  opened: boolean;
  onClose: () => void;
  onImport: (passengers: VisaPassengerItem[], meta?: {
    supplierName?: string;
    customerName?: string;
    issueDate?: string;
    employeeName?: string;
    detectedCurrency?: 'IQD' | 'USD';
  }) => void;
  defaultVisaType?: string;
  availableVisaTypes?: string[];
}

// ── Arabic / Indic Digits Normalizer ──
function normalizeDigits(str: string): string {
  return String(str || '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 1632));
}

// ── Clean Numeric Amount ──
function parseMonetaryValue(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const clean = normalizeDigits(String(val))
    .replace(/د\.?ع|IQD|\$|USD|,/gi, '')
    .replace(/[^\d.-]/g, '')
    .trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

// ── Header Column Synonyms for Excel Mapping ──
const COLUMN_ALIASES: Record<string, string[]> = {
  name: ['أسم المسافر', 'اسم المسافر', 'المسافر', 'الاسم', 'أسم', 'اسم', 'النزيل', 'name', 'passenger', 'traveler', 'passenger name'],
  passport: ['رقم الجواز', 'الجواز', 'جواز', 'رقم الوثيقة', 'passport', 'passport no', 'passport number', 'doc no'],
  orderNumber: ['رقم الطلب', 'الطلب', 'كود الطلب', 'مرجع الطلب', 'order no', 'order number', 'application no', 'app no', 'voucher', 'ref'],
  visaType: ['نوع الفيزا', 'نوع التأشيرة', 'الفيزا', 'التأشيرة', 'نوع الحجز', 'visa type', 'visa', 'destination', 'service'],
  supplier: ['قطعت من', 'المورد', 'المزود', 'مزود الخدمة', 'الشركة المزودة', 'من', 'supplier', 'provider', 'vendor'],
  customer: ['قطعت الى', 'العميل', 'الحساب', 'المشتري', 'الوكيل', 'الى', 'customer', 'client', 'agent', 'account'],
  buyPrice: ['شراء', 'سعر الشراء', 'سعر شراء', 'التكلفة', 'الكلفة', 'تكلفة', 'buy', 'cost', 'buy price', 'purchase'],
  salePrice: ['مبيع', 'سعر المبيع', 'سعر البيع', 'البيع', 'مبيعات', 'sell', 'sale', 'sell price', 'sale price'],
  issueDate: ['تاريخ التقديم', 'تاريخ الاصدار', 'تاريخ الإصدار', 'التاريخ', 'تاريخ', 'date', 'issue date', 'submission date'],
  notes: ['ملاحظات', 'الملاحظات', 'ملاحظة', 'شروط', 'notes', 'remarks', 'comment'],
  employee: ['موظف الاصدار', 'موظف الإصدار', 'الموظف', 'موظف', 'employee', 'issuer', 'issued by', 'staff'],
  profit: ['الارباح', 'الأرباح', 'الربح', 'صافي الربح', 'profit', 'net profit'],
};

function matchHeaderName(cellText: string): string | null {
  const clean = cellText.trim().toLowerCase().replace(/[\s\-_:]+/g, ' ');
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((alias) => clean === alias || clean.includes(alias))) {
      return key;
    }
  }
  return null;
}

// ── Smart Parser Function for Excel / Google Sheets Pasted Rows ──
export function parseVisaPastedText(
  rawText: string,
  defaultVisa: string = '',
  recognizedVisaTypes: string[] = []
): VisaPassengerItem[] {
  if (!rawText || !rawText.trim()) return [];

  const rawLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) return [];

  const results: VisaPassengerItem[] = [];

  // 1. Check for Passport MRZ format
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (line.startsWith('P<') || line.startsWith('P ')) {
      const namePart = line.substring(2).replace(/</g, ' ').trim();
      let passportNo = '';
      if (i + 1 < rawLines.length) {
        const line2 = rawLines[i + 1];
        const passMatch = line2.match(/([A-Z0-9]{7,10})/);
        if (passMatch) passportNo = passMatch[1];
      }
      if (namePart) {
        results.push({
          id: `imp-${Math.random().toString(36).substring(2, 9)}`,
          name: namePart,
          passportNumber: passportNo,
          visaType: defaultVisa || 'فيزا العراق',
          personType: 'ADT',
          status: 'Processing',
          voucherNumber: '',
          buyPrice: 0,
          salePrice: 0,
          notes: 'مستورد عبر الجواز الذكي MRZ',
        });
        i++;
        continue;
      }
    }
  }

  if (results.length > 0) return results;

  // 2. Tab-Separated or Delimited Rows (Excel / Google Sheets)
  const firstLineCells = rawLines[0].split('\t').map((c) => c.trim());
  const headerMap: Record<number, string> = {};
  let hasHeader = false;

  if (firstLineCells.length >= 2) {
    let matchedCount = 0;
    firstLineCells.forEach((cell, idx) => {
      const matched = matchHeaderName(cell);
      if (matched) {
        headerMap[idx] = matched;
        matchedCount++;
      }
    });
    if (matchedCount >= 2) {
      hasHeader = true;
    }
  }

  const dataLines = hasHeader ? rawLines.slice(1) : rawLines;

  for (const line of dataLines) {
    const cells = line.split('\t').map((c) => c.trim());
    if (cells.length === 0 || (cells.length === 1 && !cells[0])) continue;

    let name = '';
    let passportNumber = '';
    let orderNumber = '';
    let visaType = defaultVisa;
    let supplierName = '';
    let customerName = '';
    let buyPrice = 0;
    let salePrice = 0;
    let issueDate = '';
    let employeeName = '';
    let notes = '';

    if (hasHeader && Object.keys(headerMap).length > 0) {
      // ─── Header-Guided Mapping ───
      cells.forEach((cell, idx) => {
        const field = headerMap[idx];
        if (!field) return;

        switch (field) {
          case 'name':
            name = cell;
            break;
          case 'passport':
            passportNumber = normalizeDigits(cell).replace(/\s+/g, '');
            break;
          case 'orderNumber':
            orderNumber = normalizeDigits(cell);
            break;
          case 'visaType':
            if (cell) visaType = cell;
            break;
          case 'supplier':
            supplierName = cell;
            break;
          case 'customer':
            customerName = cell;
            break;
          case 'buyPrice':
            buyPrice = parseMonetaryValue(cell);
            break;
          case 'salePrice':
            salePrice = parseMonetaryValue(cell);
            break;
          case 'issueDate':
            issueDate = cell;
            break;
          case 'notes':
            notes = cell;
            break;
          case 'employee':
            employeeName = cell;
            break;
        }
      });
    } else if (cells.length >= 4) {
      // ─── Positional Heuristics for Excel Rows ───
      let offset = 0;
      if (/^(true|false|yes|no|✔|✓|✕|x|1|0)$/i.test(cells[0]) || cells[0].length === 0) {
        offset = 1;
      }

      const activeCells = cells.slice(offset);
      const possiblePass = normalizeDigits(activeCells[1] || '').replace(/\s+/g, '');
      const thirdCell = activeCells[2] || '';
      const isThirdCellOrder = /^202\d{3}-\d+/i.test(thirdCell) || /^\d{10,20}$/.test(thirdCell);

      if (isThirdCellOrder) {
        name = activeCells[0] || '';
        passportNumber = possiblePass;
        orderNumber = thirdCell;
        visaType = activeCells[3] || defaultVisa;
        supplierName = activeCells[4] || '';
        buyPrice = parseMonetaryValue(activeCells[5]);
        customerName = activeCells[6] || '';
        salePrice = parseMonetaryValue(activeCells[7]);
        issueDate = activeCells[8] || '';
        notes = activeCells[10] || activeCells[9] || '';
        employeeName = activeCells[11] || '';
      } else {
        name = activeCells[0] || '';
        passportNumber = possiblePass;
        visaType = activeCells[2] || defaultVisa;
        supplierName = activeCells[3] || '';
        buyPrice = parseMonetaryValue(activeCells[4]);
        customerName = activeCells[5] || '';
        salePrice = parseMonetaryValue(activeCells[6]);
        issueDate = activeCells[7] || '';
        orderNumber = activeCells[8] || '';
        notes = activeCells[9] || '';
        employeeName = activeCells[10] || '';
      }
    } else {
      // Free-form line
      const passMatch = line.match(/\b([A-Za-z]\d{7,8}|\d{8,9}|[A-Z0-9]{7,10})\b/);
      if (passMatch) passportNumber = passMatch[1];

      if (Array.isArray(recognizedVisaTypes) && recognizedVisaTypes.length > 0) {
        for (const vType of recognizedVisaTypes) {
          const coreName = vType.replace(/^فيزا\s*/, '').trim();
          if (line.includes(vType) || (coreName.length > 2 && line.includes(coreName))) {
            visaType = vType;
            break;
          }
        }
      }

      const cleanNumbers = line
        .replace(passportNumber, '')
        .match(/(\b\d+(?:,\d{3})*(?:\.\d{1,2})?\b|\b\d+\$)/g);

      if (cleanNumbers && cleanNumbers.length >= 2) {
        buyPrice = parseMonetaryValue(cleanNumbers[0]);
        salePrice = parseMonetaryValue(cleanNumbers[1]);
      } else if (cleanNumbers && cleanNumbers.length === 1) {
        salePrice = parseMonetaryValue(cleanNumbers[0]);
      }

      let cleanName = line
        .replace(/^[0-9]+[\.\-\)\s]+/, '')
        .replace(passportNumber, '')
        .replace(visaType, '')
        .replace(/فيزا/g, '')
        .replace(/[\d,.$]/g, '')
        .replace(/[\/\-\|\:\;\#\_\t\(\)]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      name = cleanName;
    }

    if (!visaType || visaType === defaultVisa) {
      if (/العراق|iraq/i.test(line)) visaType = 'فيزا العراق';
      else if (/دبي|dubai/i.test(line)) visaType = 'فيزا دبي';
      else if (/الاردن|أردن|jordan/i.test(line)) visaType = 'فيزا الاردن';
      else if (/مسقط|عمان|oman/i.test(line)) visaType = 'فيزا مسقط';
      else if (/مصر|egypt/i.test(line)) visaType = 'فيزا مصر العربية';
      else if (/تايلند|thailand/i.test(line)) visaType = 'فيزا تايلند';
      else if (/الصين|china/i.test(line)) visaType = 'فيزا الصين';
      else if (/سوق|اجازة/i.test(line)) visaType = 'اجازة سوق دولية';
      else if (/تامين|تأمين/i.test(line)) visaType = 'تامين صحي';
      else visaType = defaultVisa || 'فيزا العراق';
    }

    if (name.trim() || passportNumber.trim()) {
      results.push({
        id: `imp-${Math.random().toString(36).substring(2, 9)}`,
        name: name.trim() || 'مسافر مستورد',
        passportNumber: passportNumber.trim(),
        visaType: visaType.trim(),
        personType: 'ADT',
        status: 'Processing',
        voucherNumber: orderNumber.trim(),
        buyPrice: buyPrice,
        salePrice: salePrice,
        supplierName: supplierName.trim(),
        customerName: customerName.trim(),
        issueDate: issueDate.trim(),
        employeeName: employeeName.trim(),
        profit: salePrice - buyPrice,
        notes: notes.trim(),
      });
    }
  }

  return results;
}

export const SmartVisaImportModal: React.FC<SmartVisaImportModalProps> = ({
  opened,
  onClose,
  onImport,
  defaultVisaType = '',
  availableVisaTypes = [],
}) => {
  const [rawText, setRawText] = useState('');
  const [parsedRows, setParsedRows] = useState<VisaPassengerItem[]>([]);

  const handleTextChange = (text: string) => {
    setRawText(text);
    const rows = parseVisaPastedText(text, defaultVisaType, availableVisaTypes);
    setParsedRows(rows);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleTextChange(text);
        showSuccessNotification('تم اللصق بنجاح', 'تم استخراج البيانات من الحافظة وتحليلها تلقائياً.');
      }
    } catch {
      showWarningNotification('تنبيه', 'يرجى استخدام اختصار اللصق Ctrl+V داخل المربع.');
    }
  };

  const summaryMeta = useMemo(() => {
    if (parsedRows.length === 0) return null;

    const suppliers = parsedRows.map((r) => r.supplierName).filter(Boolean);
    const customers = parsedRows.map((r) => r.customerName).filter(Boolean);
    const employees = parsedRows.map((r) => r.employeeName).filter(Boolean);
    const dates = parsedRows.map((r) => r.issueDate).filter(Boolean);

    const hasHighAmounts = parsedRows.some(
      (r) => (Number(r.buyPrice) || 0) > 2000 || (Number(r.salePrice) || 0) > 2000
    );
    const detectedCurrency = hasHighAmounts || rawText.includes('د.ع') || rawText.includes('IQD') ? 'IQD' : 'USD';

    return {
      supplierName: suppliers[0] || undefined,
      customerName: customers[0] || undefined,
      employeeName: employees[0] || undefined,
      issueDate: dates[0] || undefined,
      detectedCurrency: detectedCurrency as 'IQD' | 'USD',
    };
  }, [parsedRows, rawText]);

  const handleApplyImport = () => {
    if (parsedRows.length === 0) {
      showWarningNotification('تنبيه', 'لم يتم اكتشاف أي بيانات صالحة في النص المنسوخ.');
      return;
    }

    onImport(parsedRows, summaryMeta || undefined);
    showSuccessNotification(
      'تم الاستيراد بنجاح',
      `تم استيراد [${parsedRows.length}] سجل بنجاح.`
    );
    setRawText('');
    setParsedRows([]);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="1150px"
      padding="lg"
      radius="xl"
      centered
      styles={{
        header: {
          borderBottom: '1px solid #F1F5F9',
          paddingBottom: '12px',
          marginBottom: '14px',
        },
        content: {
          minHeight: '480px',
        },
      }}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center border border-[#FFD8B2]">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 leading-none">الاستيراد السريع للتأشيرات (Excel Import)</h3>
          </div>
        </div>
      }
    >
      <div className="space-y-3.5 text-xs font-['IBM_Plex_Sans_Arabic',sans-serif]" dir="rtl">
        {/* Compact Action Bar */}
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-[11.5px]">
            <FileSpreadsheet size={16} className="text-[#F45A0A]" />
            <span>الصق البيانات المنسوخة من إكسل مباشرة:</span>
          </div>

          <div className="flex items-center gap-2">
            {rawText && (
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                leftSection={<Trash2 size={12} />}
                onClick={() => {
                  setRawText('');
                  setParsedRows([]);
                }}
                className="text-slate-500 hover:text-red-600 font-bold"
              >
                مسح
              </Button>
            )}

            <Button
              size="compact-sm"
              variant="filled"
              color="orange"
              leftSection={<ClipboardPaste size={14} />}
              onClick={handlePasteFromClipboard}
              className="bg-[#F45A0A] hover:bg-orange-600 font-bold rounded-lg px-3 shadow-2xs cursor-pointer"
            >
              لصق من الحافظة (Ctrl+V)
            </Button>
          </div>
        </div>

        {/* Textarea for Pasting (Generous Height) */}
        <div>
          <Textarea
            rows={parsedRows.length > 0 ? 5 : 10}
            value={rawText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="انسخ صفوف جدول الإكسل (أو الواتساب) ثم اضغط هنا Ctrl+V..."
            className="w-full text-xs font-mono"
            styles={{
              input: {
                fontSize: '12px',
                borderColor: '#E2E8F0',
                borderRadius: '12px',
                lineHeight: '1.6',
                fontFamily: "'JetBrains Mono', 'Consolas', monospace",
                minHeight: parsedRows.length > 0 ? '110px' : '220px',
                backgroundColor: '#FFFFFF',
              },
            }}
          />
        </div>

        {/* Live Detected Preview Table */}
        {parsedRows.length > 0 && (
          <Paper p="sm" radius="md" withBorder className="bg-white border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                <Users size={14} className="text-[#F45A0A]" />
                <span>البيانات المكتشفة ({parsedRows.length} سجل)</span>
              </span>
              <div className="flex items-center gap-1.5">
                <Badge size="sm" color="orange" variant="light" className="font-mono font-bold">
                  {summaryMeta?.detectedCurrency || 'IQD'}
                </Badge>
                <Badge size="sm" color="emerald" variant="filled" className="font-bold font-mono">
                  {parsedRows.length} مسافر
                </Badge>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[220px]">
              <table className="w-full text-xs text-center border-collapse whitespace-nowrap">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 font-extrabold text-slate-900 h-8">
                  <tr>
                    <th className="py-1 px-2 text-center w-8">#</th>
                    <th className="py-1 px-2 text-right">اسم المسافر</th>
                    <th className="py-1 px-2 text-center">رقم الجواز</th>
                    <th className="py-1 px-2 text-center">نوع التأشيرة</th>
                    <th className="py-1 px-2 text-center">المورد</th>
                    <th className="py-1 px-2 text-center text-rose-700">شراء</th>
                    <th className="py-1 px-2 text-center">العميل</th>
                    <th className="py-1 px-2 text-center text-emerald-700">مبيع</th>
                    <th className="py-1 px-2 text-center text-blue-700">الربح</th>
                    <th className="py-1 px-2 text-center">التاريخ</th>
                    <th className="py-1 px-2 text-center">رقم الطلب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {parsedRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-orange-50/40 transition-colors">
                      <td className="py-1.5 px-2 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-1.5 px-2 font-black text-slate-950 text-right">{row.name}</td>
                      <td className="py-1.5 px-2 font-mono font-black text-center text-[#F45A0A]">{row.passportNumber || '—'}</td>
                      <td className="py-1.5 px-2 text-slate-900 font-extrabold">{row.visaType}</td>
                      <td className="py-1.5 px-2 text-slate-800 font-bold">{row.supplierName || '—'}</td>
                      <td className="py-1.5 px-2 font-mono text-center text-rose-700 font-black">
                        {Number(row.buyPrice).toLocaleString('en-US')}
                      </td>
                      <td className="py-1.5 px-2 text-slate-800 font-bold">{row.customerName || '—'}</td>
                      <td className="py-1.5 px-2 font-mono text-center text-emerald-700 font-black">
                        {Number(row.salePrice).toLocaleString('en-US')}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-center text-blue-700 font-black">
                        {Number(Number(row.salePrice) - Number(row.buyPrice)).toLocaleString('en-US')}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-center text-slate-700 font-bold">{row.issueDate || '—'}</td>
                      <td className="py-1.5 px-2 font-mono text-center text-slate-600 font-bold">{row.voucherNumber || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Paper>
        )}

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <Button
            size="sm"
            variant="default"
            onClick={onClose}
            className="border-slate-300 bg-white text-slate-700 font-bold rounded-xl px-5 hover:bg-slate-50"
          >
            إلغاء
          </Button>

          <Button
            size="sm"
            color="orange"
            leftSection={<Check size={16} />}
            disabled={parsedRows.length === 0}
            onClick={handleApplyImport}
            className="font-black px-6 bg-[#F45A0A] hover:bg-orange-600 text-white rounded-xl shadow-sm cursor-pointer"
          >
            تأكيد واستيراد ({parsedRows.length})
          </Button>
        </div>
      </div>
    </Modal>
  );
};
