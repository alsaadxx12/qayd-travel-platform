import React, { useState, useMemo } from 'react';
import {
  Modal,
  Button,
  Textarea,
  Badge,
  Select,
} from '@mantine/core';
import {
  Clipboard,
  Trash2,
  Check,
  Table as TableIcon,
  FileSpreadsheet,
} from 'lucide-react';
import { PassengerLine } from './TicketPassengersTable';
import { useLanguageStore } from '../../store/useLanguageStore';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';

interface QuickPastePassengersModalProps {
  opened: boolean;
  onClose: () => void;
  onImportPassengers: (
    passengers: PassengerLine[],
    detectedPnr?: string,
    detectedSupplier?: string,
    detectedCustomer?: string
  ) => void;
  globalPnr?: string;
  currency?: string;
}

export const QuickPastePassengersModal: React.FC<QuickPastePassengersModalProps> = ({
  opened,
  onClose,
  onImportPassengers,
  globalPnr = '',
  currency = 'IQD',
}) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [rawText, setRawText] = useState('');
  const [defaultTicketType, setDefaultTicketType] = useState<'ADULT' | 'CHILD' | 'INFANT'>('ADULT');

  // Clean numeric values (strip IQD, $, commas, spaces)
  const cleanNumber = (val: string): number | null => {
    if (!val) return null;
    const cleaned = val
      .replace(/IQD|USD|\$|د\.ع/gi, '')
      .replace(/,/g, '')
      .trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  // Detect ticket numbers of any airline layout, never phones
  const isLikelyTicketNumber = (val: string): boolean => {
    const v = val.replace(/[\s-]/g, '');
    if (/^(?:00)?9647\d{9}$/.test(v) || /^0?7\d{9}$/.test(v)) return false;
    return /^\d{8,16}$/.test(v) || /^[A-Z0-9][-A-Z0-9]{5,20}$/i.test(val.trim());
  };

  // Detect if a string is a PNR
  const isLikelyPnr = (val: string): boolean => {
    const v = val.trim();
    if (v.length >= 5 && v.length <= 12 && /^[A-Za-z0-9-]+$/.test(v) && !/^\d+$/.test(v)) {
      return true;
    }
    return false;
  };

  // Detect ticket type
  const detectType = (val: string): 'ADULT' | 'CHILD' | 'INFANT' => {
    const v = val.toLowerCase();
    if (v.includes('inf') || v.includes('رضيع') || v.includes('baby')) return 'INFANT';
    if (v.includes('chd') || v.includes('child') || v.includes('طفل')) return 'CHILD';
    return defaultTicketType;
  };

  // Smart Parser for pasted lines
  const parsedResults = useMemo(() => {
    if (!rawText.trim()) {
      return { passengers: [], detectedPnr: '', detectedSupplier: '', detectedCustomer: '' };
    }

    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let detectedPnr = '';
    let detectedSupplier = '';
    let detectedCustomer = '';
    const passengers: PassengerLine[] = [];

    lines.forEach((line, index) => {
      let cells = line.split('\t');
      if (cells.length === 1 && line.includes('  ')) {
        cells = line.split(/\s{2,}/);
      } else if (cells.length === 1 && line.includes(',')) {
        cells = line.split(',');
      }
      cells = cells.map((c) => c.trim()).filter((c) => c !== '');

      if (cells.length === 0) return;

      // Skip header rows
      const lowerRow = line.toLowerCase();
      if (
        (lowerRow.includes('مسافر') || lowerRow.includes('passenger') || lowerRow.includes('name')) &&
        (lowerRow.includes('تذكرة') || lowerRow.includes('ticket') || lowerRow.includes('pnr') || lowerRow.includes('سعر'))
      ) {
        return;
      }

      let name = '';
      let ticketNumber = '';
      let pnr = globalPnr || '';
      let supplier = '';
      let customer = '';
      let fareBuy: number | null = null;
      let fareSell: number | null = null;
      let ticketType: 'ADULT' | 'CHILD' | 'INFANT' = defaultTicketType;

      if (cells.length === 1) {
        name = cells[0];
      } else {
        const remainingCells = [...cells];

        // 1. PNR
        const pnrIdx = remainingCells.findIndex((c) => isLikelyPnr(c));
        if (pnrIdx !== -1) {
          pnr = remainingCells[pnrIdx];
          if (!detectedPnr) detectedPnr = pnr;
          remainingCells.splice(pnrIdx, 1);
        }

        // 2. Ticket Number
        const tktIdx = remainingCells.findIndex((c) => isLikelyTicketNumber(c));
        if (tktIdx !== -1) {
          ticketNumber = remainingCells[tktIdx];
          remainingCells.splice(tktIdx, 1);
        }

        // 3. Extract Numeric Price Cells
        const priceIndices: number[] = [];
        remainingCells.forEach((c, idx) => {
          const num = cleanNumber(c);
          if (num !== null && num > 0) {
            priceIndices.push(idx);
          }
        });

        if (priceIndices.length >= 2) {
          fareBuy = cleanNumber(remainingCells[priceIndices[0]]);
          fareSell = cleanNumber(remainingCells[priceIndices[1]]);
          priceIndices.reverse().forEach((idx) => remainingCells.splice(idx, 1));
        } else if (priceIndices.length === 1) {
          fareSell = cleanNumber(remainingCells[priceIndices[0]]);
          fareBuy = fareSell;
          remainingCells.splice(priceIndices[0], 1);
        }

        // 4. Remaining text cells: Name, Supplier, Customer
        if (remainingCells.length >= 3) {
          name = remainingCells[0];
          supplier = remainingCells[1];
          customer = remainingCells[2];
        } else if (remainingCells.length === 2) {
          name = remainingCells[0];
          supplier = remainingCells[1];
        } else if (remainingCells.length === 1) {
          name = remainingCells[0];
        } else {
          name = `مسافر ${index + 1}`;
        }

        ticketType = detectType(name);
        if (supplier && !detectedSupplier) detectedSupplier = supplier;
        if (customer && !detectedCustomer) detectedCustomer = customer;
      }

      if (name.trim()) {
        passengers.push({
          id: `p-quick-${Date.now()}-${index}`,
          name: name.trim(),
          ticketType,
          ticketNumber: ticketNumber.trim(),
          documentNumber: '',
          pnr: pnr || globalPnr || '',
          fareBuy,
          fareSell,
          tax1: 0,
          tax2: 0,
          charge: 0,
          percentage: 0,
          status: fareSell ? 'مسعر' : 'باقي',
        });
      }
    });

    return { passengers, detectedPnr, detectedSupplier, detectedCustomer };
  }, [rawText, defaultTicketType, globalPnr]);

  // Handle Paste from Clipboard
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText(text);
        showSuccessNotification(
          isAr ? 'تم اللصق بنجاح' : 'Pasted Successfully',
          isAr ? 'تم قراءة البيانات من الحافظة' : 'Clipboard content read',
        );
      }
    } catch {
      showErrorNotification(
        isAr ? 'تعذر اللصق' : 'Paste failed',
        isAr ? 'يرجى لصق النص يدوياً داخل المربع (Ctrl+V)' : 'Please paste text manually using Ctrl+V',
      );
    }
  };

  // Commit and Import
  const handleCommit = () => {
    if (parsedResults.passengers.length === 0) {
      showErrorNotification(
        isAr ? 'لا توجد بيانات' : 'No Data',
        isAr ? 'يرجى لصق أسماء المسافرين أو جدول الإكسل أولاً' : 'Please paste passenger data first',
      );
      return;
    }

    onImportPassengers(
      parsedResults.passengers,
      parsedResults.detectedPnr,
      parsedResults.detectedSupplier,
      parsedResults.detectedCustomer
    );

    showSuccessNotification(
      isAr ? 'تم الاستيراد بنجاح' : 'Imported Successfully',
      isAr
        ? `تم إدراج ${parsedResults.passengers.length} مسافرين مع الأسعار والبيانات بنجاح`
        : `Imported ${parsedResults.passengers.length} passengers successfully`,
    );
    setRawText('');
    onClose();
  };

  const totalBuy = parsedResults.passengers.reduce((sum, p) => sum + (p.fareBuy || 0), 0);
  const totalSell = parsedResults.passengers.reduce((sum, p) => sum + (p.fareSell || 0), 0);
  const totalProfit = totalSell - totalBuy;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5 font-black text-sm text-slate-900" dir={direction}>
          <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F45A0A] flex items-center justify-center border border-orange-200 shrink-0">
            <FileSpreadsheet size={18} strokeWidth={2.2} />
          </div>
          <span className="text-slate-900 font-black text-sm">
            {isAr ? 'الإدخال السريع عبر النسخ واللصق من Excel' : 'Quick Copy-Paste from Excel'}
          </span>
        </div>
      }
      size="1100px"
      radius="20px"
      dir={direction}
      centered
      styles={{
        header: {
          padding: '14px 20px',
          borderBottom: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
        },
        body: {
          padding: '20px',
          backgroundColor: '#FFFFFF',
        },
      }}
    >
      <div className="space-y-3.5 font-sans text-xs select-none" dir={direction}>
        {/* Top Minimal Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap bg-slate-50 p-2 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="filled"
              color="orange"
              leftSection={<Clipboard size={14} />}
              onClick={handlePasteFromClipboard}
              className="font-bold rounded-lg h-8 text-white bg-[#F45A0A] hover:bg-[#dd4f05] shadow-xs px-3.5 text-xs cursor-pointer"
            >
              {isAr ? 'لصق من الحافظة (Paste)' : 'Paste from Clipboard'}
            </Button>

            {rawText && (
              <Button
                size="xs"
                variant="subtle"
                color="red"
                leftSection={<Trash2 size={13} />}
                onClick={() => setRawText('')}
                className="font-bold rounded-lg h-8 text-xs cursor-pointer"
              >
                {isAr ? 'مسح' : 'Clear'}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-bold text-xs">
              {isAr ? 'النوع الافتراضي:' : 'Default Type:'}
            </span>
            <Select
              size="xs"
              value={defaultTicketType}
              onChange={(v) => setDefaultTicketType((v as any) || 'ADULT')}
              data={[
                { value: 'ADULT', label: isAr ? 'بالغ (Adult)' : 'Adult' },
                { value: 'CHILD', label: isAr ? 'طفل (Child)' : 'Child' },
                { value: 'INFANT', label: isAr ? 'رضيع (Infant)' : 'Infant' },
              ]}
              className="w-36"
              styles={{
                input: {
                  borderRadius: '8px',
                  height: '32px',
                  fontWeight: 700,
                  borderColor: '#E2E8F0',
                  fontSize: '12px',
                },
              }}
            />
          </div>
        </div>

        {/* Large Textarea */}
        <div className="relative">
          <Textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={
              isAr
                ? "الصق البيانات هنا بالضغط على (Ctrl+V)..."
                : "Paste data here (Ctrl+V)..."
            }
            minRows={10}
            maxRows={16}
            radius="md"
            styles={{
              input: {
                fontFamily: 'monospace',
                fontSize: 13,
                lineHeight: 1.7,
                borderColor: '#CBD5E1',
                backgroundColor: '#FAFAFA',
                padding: '14px',
                borderRadius: '12px',
                minHeight: '220px',
              },
            }}
          />
        </div>

        {/* Detected Info Badges (Supplier / Customer / PNR) */}
        {(parsedResults.detectedSupplier || parsedResults.detectedCustomer || parsedResults.detectedPnr) && (
          <div className="flex items-center gap-3 p-2 bg-orange-50/60 border border-orange-200/80 rounded-xl text-xs flex-wrap">
            {parsedResults.detectedPnr && (
              <div className="flex items-center gap-1">
                <span className="text-slate-500 font-bold">PNR:</span>
                <span className="font-mono font-black text-[#F45A0A] bg-white px-2 py-0.5 rounded border border-orange-200">
                  {parsedResults.detectedPnr}
                </span>
              </div>
            )}
            {parsedResults.detectedSupplier && (
              <div className="flex items-center gap-1">
                <span className="text-slate-500 font-bold">الجهة المصدرة (المورد):</span>
                <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {parsedResults.detectedSupplier}
                </span>
              </div>
            )}
            {parsedResults.detectedCustomer && (
              <div className="flex items-center gap-1">
                <span className="text-slate-500 font-bold">الجهة المستفيدة (العميل):</span>
                <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {parsedResults.detectedCustomer}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Parsed Live Preview Table */}
        {parsedResults.passengers.length > 0 && (
          <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/60 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <TableIcon size={14} className="text-slate-600" />
                <span className="font-bold text-slate-900 text-xs">
                  {isAr ? 'معاينة المسافرين المستخرجين:' : 'Extracted Passengers:'}
                </span>
                <Badge color="orange" variant="filled" size="sm" className="font-mono font-bold">
                  {parsedResults.passengers.length} {isAr ? 'مسافر' : 'Pax'}
                </Badge>
              </div>

              {(totalBuy > 0 || totalSell > 0) && (
                <div className="flex items-center gap-3 text-xs font-mono font-bold text-slate-700 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
                  <span>شراء: <strong className="text-slate-900">{totalBuy.toLocaleString()} {currency}</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>بيع: <strong className="text-slate-900">{totalSell.toLocaleString()} {currency}</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>الربح: <strong className="text-[#078B61] font-black">+{totalProfit.toLocaleString()} {currency}</strong></span>
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[220px] overflow-y-auto bg-white">
              <table className="w-full text-right border-collapse text-xs">
                <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold text-[11px] sticky top-0">
                  <tr>
                    <th className="p-2 text-center w-10">#</th>
                    <th className="p-2">{isAr ? 'اسم المسافر' : 'Passenger Name'}</th>
                    <th className="p-2 text-center">{isAr ? 'النوع' : 'Type'}</th>
                    <th className="p-2 text-center">{isAr ? 'رقم التذكرة' : 'Ticket No'}</th>
                    <th className="p-2 text-center">{isAr ? 'PNR' : 'PNR'}</th>
                    <th className="p-2 text-center">{isAr ? 'سعر الشراء' : 'Buy Fare'}</th>
                    <th className="p-2 text-center">{isAr ? 'سعر البيع' : 'Sell Fare'}</th>
                    <th className="p-2 text-center">{isAr ? 'الربح' : 'Profit'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedResults.passengers.map((p, idx) => {
                    const lineProfit = (p.fareSell || 0) - (p.fareBuy || 0);
                    return (
                      <tr key={p.id} className="hover:bg-orange-50/30 transition-colors font-mono text-[11.5px]">
                        <td className="p-2 text-center text-slate-400 font-bold text-[11px]">{idx + 1}</td>
                        <td className="p-2 font-sans font-bold text-slate-900 text-xs">{p.name}</td>
                        <td className="p-2 text-center">
                          <Badge size="xs" variant="light" color="orange">
                            {p.ticketType === 'CHILD' ? 'طفل' : p.ticketType === 'INFANT' ? 'رضيع' : 'بالغ'}
                          </Badge>
                        </td>
                        <td className="p-2 text-center font-bold text-slate-700">{p.ticketNumber || '—'}</td>
                        <td className="p-2 text-center font-bold text-[#F45A0A] bg-orange-50/50 rounded">{p.pnr || '—'}</td>
                        <td className="p-2 text-center font-bold text-slate-800">
                          {p.fareBuy ? `${p.fareBuy.toLocaleString()} ${currency}` : '—'}
                        </td>
                        <td className="p-2 text-center font-black text-slate-900">
                          {p.fareSell ? `${p.fareSell.toLocaleString()} ${currency}` : '—'}
                        </td>
                        <td className="p-2 text-center font-black text-[#078B61]">
                          {p.fareSell && p.fareBuy ? `+${lineProfit.toLocaleString()} ${currency}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 flex-wrap gap-2">
          <div className="text-slate-500 text-xs font-mono font-bold">
            {parsedResults.passengers.length > 0 ? (
              <span className="text-[#078B61] flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                <Check size={14} />
                {isAr ? `جاهز لإدراج ${parsedResults.passengers.length} مسافرين` : `Ready (${parsedResults.passengers.length})`}
              </span>
            ) : (
              <span className="text-slate-400">{isAr ? 'في انتظار لصق البيانات...' : 'Waiting for pasted data...'}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="default"
              onClick={onClose}
              className="rounded-lg font-bold h-8.5 px-4 text-xs"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>

            <Button
              size="xs"
              color="orange"
              variant="filled"
              disabled={parsedResults.passengers.length === 0}
              onClick={handleCommit}
              className="bg-[#F45A0A] hover:bg-[#dd4f05] rounded-lg font-black h-8.5 px-5 text-xs text-white shadow-xs cursor-pointer"
            >
              {isAr ? `إدراج وتطبيق (${parsedResults.passengers.length}) مسافرين` : `Import (${parsedResults.passengers.length}) Passengers`}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
