import { QuickPastePassengersModal } from './QuickPastePassengersModal';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Button,
  Select,
  Tooltip,
  ActionIcon,
  Modal,
  Textarea,
  Badge,
  Popover,
} from '@mantine/core';
import {
  UserPlus,
  Users,
  Copy,
  Trash2,
  Edit2,
  Check,
  Zap,
  Plus,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Sparkles,
  Loader2,
  LayoutList,
  LayoutGrid,
} from 'lucide-react';
import { showSuccessNotification, showInfoNotification, showErrorNotification } from '../../utils/notifications';
import { formatCurrency, getCurrencySymbol, getCurrencyLabel, parseCurrencyInput } from '../../utils/currencyUtils';
import { prepareTicketParseFormData } from '../../utils/pdfTextExtractor';
import { useLanguageStore } from '../../store/useLanguageStore';
import { API_BASE_URL } from '../../api/client';
import { Lottie } from 'lottie-react';
import flightTicketAnimation from '../../assets/animations/flight-ticket.json';

export interface PassengerLine {
  id: string;
  name: string;
  ticketType: 'ADULT' | 'CHILD' | 'INFANT';
  ticketNumber: string;
  documentNumber?: string;
  pnr?: string;
  fareBuy: number | null;
  fareSell: number | null;
  tax1: number;
  tax2: number;
  charge: number;
  percentage?: number;
  status?: string;
  batchId?: string; // Links passenger to a PriceBatch
}

export interface PriceBatch {
  id: string;
  batchName: string; // e.g. "سعر بالغ ×2"
  type: 'ADULT' | 'CHILD' | 'INFANT';
  count: number;
  fareBuy: number;
  fareSell: number;
  tax1?: number;
  tax2?: number;
  charge?: number;
  discount?: number;
  passengerIds: string[];
}

interface TicketPassengersTableProps {
  passengers: PassengerLine[];
  currency: string;
  globalPnr?: string;
  globalRoute?: string;
  airline?: string;
  onChangePassengers: (updatedList: PassengerLine[]) => void;
  onSmartImport?: (parsedData: any) => void;
  errors?: Record<string, string>;
}

// ── Smart Number Parsing Utility (handles 210 -> 210,000 in IQD, 190k, 190,000, ١٩٠٠٠٠, 190000) ──
/**
 * صفّ تسعير فئة: بالغ أو طفل أو رضيع.
 *
 * يحمل مسوّدته الخاصة أثناء الكتابة ثم يثبّتها عند الخروج أو Enter، فلا يتشاجر
 * ما تكتبه مع القيمة المشتقّة من المسافرين. وحين تختلف أسعار مسافري الفئة يظهر
 * الحقل فارغاً بعلامة «مختلف» — لأن عرض سعر أحدهم كأنه سعر الجميع تضليل.
 */
const TypePriceRow: React.FC<{
  label: string;
  count: number;
  buyValue: number | null;
  sellValue: number | null;
  buyMixed: boolean;
  sellMixed: boolean;
  currency: string;
  isAr: boolean;
  onCommit: (field: 'fareBuy' | 'fareSell', raw: string) => void;
}> = ({ label, count, buyValue, sellValue, buyMixed, sellMixed, currency, isAr, onCommit }) => {
  const [draft, setDraft] = useState<{ buy: string | null; sell: string | null }>({ buy: null, sell: null });

  const shown = (field: 'buy' | 'sell') => {
    if (draft[field] !== null) return draft[field] as string;
    const mixed = field === 'buy' ? buyMixed : sellMixed;
    if (mixed) return '';
    const v = field === 'buy' ? buyValue : sellValue;
    return v === null || v === undefined ? '' : v.toLocaleString('en-US');
  };

  const commit = (field: 'buy' | 'sell') => {
    const raw = draft[field];
    setDraft((d) => ({ ...d, [field]: null }));
    if (raw === null) return;
    onCommit(field === 'buy' ? 'fareBuy' : 'fareSell', raw);
  };

  const profit =
    buyValue !== null && sellValue !== null && !buyMixed && !sellMixed ? sellValue - buyValue : null;
  const empty = count === 0;

  const field = (name: 'buy' | 'sell') => (
    <input
      type="text"
      dir="ltr"
      disabled={empty}
      value={shown(name)}
      onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
      onBlur={() => commit(name)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          commit(name);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder={(name === 'buy' ? buyMixed : sellMixed) ? (isAr ? 'مختلف' : 'mixed') : '0'}
      className={`w-full h-9 px-2.5 rounded-lg border bg-white font-mono text-xs text-end outline-none transition-all disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed ${
        name === 'sell' ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'
      } ${
        (name === 'buy' ? buyMixed : sellMixed)
          ? 'border-amber-300 placeholder:text-amber-600 placeholder:font-bold'
          : 'border-slate-300 hover:border-slate-400 focus:border-[#F45A0A] focus:ring-2 focus:ring-orange-100 placeholder:text-slate-300'
      }`}
    />
  );

  return (
    <div className={`grid grid-cols-[minmax(96px,1.1fr)_1fr_1fr_minmax(84px,0.9fr)] items-center gap-2 ${empty ? 'opacity-45' : ''}`}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-xs font-bold text-slate-800 truncate">{label}</span>
        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded px-1 shrink-0">
          ×{count}
        </span>
      </div>
      {field('buy')}
      {field('sell')}
      <div className="text-end font-mono text-xs font-bold" dir="ltr">
        {profit === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span className={profit > 0 ? 'text-[#078B61]' : profit < 0 ? 'text-red-600' : 'text-slate-600'}>
            {profit >= 0 ? `+${formatCurrency(profit, currency)}` : formatCurrency(profit, currency)}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * خانة سعر تُقرأ كنصّ وتُحرَّر كحقل.
 *
 * تبدو رقماً عادياً في الجدول حتى تُنقر، فلا تزدحم الشاشة بمربّعات إدخال؛ وعند
 * النقر تصير حقلاً مفتوحاً على قيمته محدَّدةً بالكامل ليُكتب فوقها مباشرة.
 * Enter وTab يثبّتان، وEsc يتراجع، وCtrl+↓ ينسخ القيمة إلى بقية الصفوف.
 */
const EditablePriceCell: React.FC<{
  value: number | null;
  display: string;
  bold?: boolean;
  placeholder: string;
  title: string;
  onCommit: (raw: string) => void;
  onFillDown: () => void;
}> = ({ value, display, bold, placeholder, title, onCommit, onFillDown }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const open = () => {
    setDraft(value === null || value === undefined ? '' : String(value));
    setEditing(true);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        dir="ltr"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onCommit(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            onCommit(draft);
            setEditing(false);
            return;
          }
          if (e.key === 'Escape') {
            e.stopPropagation();
            setEditing(false);
            return;
          }
          if (e.ctrlKey && e.key === 'ArrowDown') {
            e.preventDefault();
            onCommit(draft);
            setEditing(false);
            window.setTimeout(onFillDown, 0);
          }
        }}
        placeholder={placeholder}
        className="w-full h-8 px-2 rounded-[6px] border border-[#F45A0A] bg-white font-mono font-bold text-xs text-slate-900 text-end outline-none ring-2 ring-orange-100"
      />
    );
  }

  return (
    <button
      type="button"
      title={title}
      onClick={open}
      className={`w-full h-8 px-2 rounded-[6px] border border-transparent hover:border-slate-300 hover:bg-white text-end font-mono text-xs cursor-text transition-colors ${
        value === null || value === undefined
          ? 'text-slate-300 font-normal'
          : bold
          ? 'text-slate-900 font-bold'
          : 'text-slate-800 font-semibold'
      }`}
    >
      {value === null || value === undefined ? placeholder : display}
    </button>
  );
};

export const parseNumberInput = (raw?: string | number | null, currency: string = 'IQD'): number => {
  if (raw === undefined || raw === null || raw === '') return 0;
  if (typeof raw === 'number') {
    if (isNaN(raw)) return 0;
    if (currency === 'IQD' && raw > 0 && raw < 1000) return Math.round(raw * 1000);
    return raw;
  }

  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let clean = raw.toString().trim();
  arabicNumerals.forEach((char, i) => {
    clean = clean.replaceAll(char, String(i));
  });

  clean = clean.replace(/,/g, '').toLowerCase();
  if (clean === '') return 0;

  if (clean.endsWith('k') || clean.endsWith('kilo') || clean.endsWith('ألف')) {
    const numPart = parseFloat(clean.replace(/[kilo|k|ألف]/g, ''));
    return isNaN(numPart) ? 0 : Math.round(numPart * 1000);
  }

  if (clean.endsWith('m') || clean.endsWith('مليون')) {
    const numPart = parseFloat(clean.replace(/[m|مليون]/g, ''));
    return isNaN(numPart) ? 0 : Math.round(numPart * 1000000);
  }

  const parsed = parseFloat(clean);
  if (isNaN(parsed)) return 0;

  // Auto-expand thousands for IQD when typing short numbers (e.g. 190 -> 190,000, 210 -> 210,000, 300 -> 300,000)
  if (currency === 'IQD' && parsed > 0 && parsed < 1000) {
    return Math.round(parsed * 1000);
  }

  return parsed;
};

// ── Arabic Pluralization Helper ──
export const formatArabicCount = (count: number, type?: 'ADULT' | 'CHILD' | 'INFANT'): string => {
  if (!type) {
    if (count === 1) return 'مسافر واحد';
    if (count === 2) return 'مسافران اثنان';
    if (count >= 3 && count <= 10) return `${count} مسافرين`;
    return `${count} مسافر`;
  }

  if (type === 'ADULT') {
    if (count === 1) return 'بالغ واحد';
    if (count === 2) return 'بالغان';
    if (count >= 3 && count <= 10) return `${count} بالغين`;
    return `${count} بالغ`;
  }

  if (type === 'CHILD') {
    if (count === 1) return 'طفل واحد';
    if (count === 2) return 'طفلان';
    if (count >= 3 && count <= 10) return `${count} أطفال`;
    return `${count} طفل`;
  }

  // INFANT
  if (count === 1) return 'رضيع واحد';
  if (count === 2) return 'رضيعان';
  if (count >= 3 && count <= 10) return `${count} رضع`;
  return `${count} رضيع`;
};

export const TicketPassengersTable: React.FC<TicketPassengersTableProps> = ({
  passengers,
  currency,
  globalPnr = '',
  onChangePassengers,
  onSmartImport,
  errors = {},
}) => {
  // ── Price Batches State ──
  const [batches, setBatches] = useState<PriceBatch[]>([]);

  // ── Active Batch Input Bar Draft State ──
  const [draftType, setDraftType] = useState<'ADULT' | 'CHILD' | 'INFANT'>('ADULT');
  const [draftCount, setDraftCount] = useState<number>(1);
  const [draftBuy, setDraftBuy] = useState<string>('');
  const [draftSell, setDraftSell] = useState<string>('');
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [showBatchDetails, setShowBatchDetails] = useState<boolean>(false);

  // Modals & Smart AI File Picker
  const smartFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isAnalyzingTicket, setIsAnalyzingTicket] = useState<boolean>(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchNamesText, setBatchNamesText] = useState('');
  const [excelPasteModalOpen, setExcelPasteModalOpen] = useState(false);
  const [excelPasteText, setExcelPasteText] = useState('');

  // Refs for bar inputs
  const countInputRef = useRef<HTMLInputElement | null>(null);
  const buyInputRef = useRef<HTMLInputElement | null>(null);
  const sellInputRef = useRef<HTMLInputElement | null>(null);

  // ── Direct AI Ticket Import File Selection Handler ──
  const handleDirectSmartFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingTicket(true);
    try {
      const formData = await prepareTicketParseFormData(file);

      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/smart-parser/parse-ticket`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        throw new Error('فشل معالجة التذكرة عبر الذكاء الاصطناعي');
      }

      const apiResult = await res.json();
      if (apiResult) {
        if (onSmartImport) {
          onSmartImport(apiResult);
        } else if (apiResult.passengers && apiResult.passengers.length > 0) {
          const moneyOrNull = (v: any) => {
            const n = Number(v);
            return Number.isFinite(n) && n > 0 ? n : null;
          };
          const newRows: PassengerLine[] = apiResult.passengers.map((p: any, i: number) => ({
            id: `p-ai-${Date.now()}-${i}`,
            name: p.name || '',
            ticketType: p.ticketType || 'ADULT',
            ticketNumber: p.ticketNumber || '',
            documentNumber: p.documentNumber || '',
            pnr: apiResult.pnr || globalPnr || '',
            fareBuy: moneyOrNull(p.fareBuy),
            fareSell: moneyOrNull(p.fareSell),
            tax1: Number(p.tax1) > 0 ? Number(p.tax1) : 0,
            tax2: Number(p.tax2) > 0 ? Number(p.tax2) : 0,
            charge: Number(p.charge) > 0 ? Number(p.charge) : 0,
          }));

          if (passengers.length === 1 && !passengers[0].name.trim() && !passengers[0].ticketNumber.trim()) {
            onChangePassengers(newRows);
          } else {
            onChangePassengers([...passengers, ...newRows]);
          }
        }
      }
    } catch (err: any) {
      console.error('Smart ticket parsing error:', err);
      showErrorNotification('تعذر استخراج بيانات التذكرة', err?.message || 'تأكد من أن ملف التذكرة صالح ويحتوي على نص واضح.');
    } finally {
      setIsAnalyzingTicket(false);
      if (smartFileInputRef.current) {
        smartFileInputRef.current.value = '';
      }
    }
  };

  // ── 1. Calculate counts and unpriced remaining per type ──
  const passengerCounts = useMemo(() => {
    const total = { ADULT: 0, CHILD: 0, INFANT: 0 };
    const priced = { ADULT: 0, CHILD: 0, INFANT: 0 };

    passengers.forEach((p) => {
      const t = p.ticketType || 'ADULT';
      total[t] = (total[t] || 0) + 1;
      // المسعَّر من له سعر بيع، سواء جاءه من صفّ الفئة أو كُتب في صفّه بيده.
      if (p.fareSell !== null && p.fareSell !== undefined && p.fareSell > 0) {
        priced[t] = (priced[t] || 0) + 1;
      }
    });

    return {
      total,
      priced,
      remaining: {
        ADULT: Math.max(0, total.ADULT - priced.ADULT),
        CHILD: Math.max(0, total.CHILD - priced.CHILD),
        INFANT: Math.max(0, total.INFANT - priced.INFANT),
      },
    };
  }, [passengers]);

  // ── 2. Auto-set draft count & type to first remaining unpriced category ──
  useEffect(() => {
    if (editingBatchId) return;

    if (passengerCounts.remaining[draftType] > 0) {
      setDraftCount(passengerCounts.remaining[draftType]);
    } else {
      // Find first type with remaining unpriced
      const types: Array<'ADULT' | 'CHILD' | 'INFANT'> = ['ADULT', 'CHILD', 'INFANT'];
      const nextAvailable = types.find((t) => passengerCounts.remaining[t] > 0);
      if (nextAvailable) {
        setDraftType(nextAvailable);
        setDraftCount(passengerCounts.remaining[nextAvailable]);
      } else {
        setDraftCount(1);
      }
    }
  }, [passengerCounts.remaining, draftType, editingBatchId]);

  // ── 3. Add or Update Batch Engine ──
  const handleSaveBatch = useCallback(() => {
    const buyNum = parseNumberInput(draftBuy, currency);
    const sellNum = parseNumberInput(draftSell, currency);

    if (draftCount <= 0 || (buyNum === 0 && sellNum === 0)) return;

    const maxAllowed = editingBatchId
      ? (batches.find((b) => b.id === editingBatchId)?.count || 0) + passengerCounts.remaining[draftType]
      : passengerCounts.remaining[draftType];

    const finalCount = Math.min(draftCount, Math.max(1, maxAllowed));

    if (editingBatchId) {
      // Updating existing batch
      const updatedBatches = batches.map((b) => {
        if (b.id === editingBatchId) {
          return {
            ...b,
            type: draftType,
            count: finalCount,
            fareBuy: buyNum,
            fareSell: sellNum,
          };
        }
        return b;
      });

      setBatches(updatedBatches);

      // Sync passengers linked to this batch
      const updatedPassengers = passengers.map((p) => {
        if (p.batchId === editingBatchId) {
          return {
            ...p,
            fareBuy: buyNum,
            fareSell: sellNum,
          };
        }
        return p;
      });

      onChangePassengers(updatedPassengers);
      setEditingBatchId(null);
    } else {
      // Creating a new batch
      const newBatchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const typeLabel = draftType === 'ADULT' ? 'بالغ' : draftType === 'CHILD' ? 'طفل' : 'رضيع';

      // Find first unassigned passengers of this type
      const unassignedOfSameType = passengers.filter(
        (p) => (p.ticketType || 'ADULT') === draftType && (!p.batchId || p.fareSell === null),
      );

      const assignedPassengers = unassignedOfSameType.slice(0, finalCount);
      const assignedIds = assignedPassengers.map((p) => p.id);

      const newBatch: PriceBatch = {
        id: newBatchId,
        batchName: `سعر ${typeLabel} ×${finalCount}`,
        type: draftType,
        count: finalCount,
        fareBuy: buyNum,
        fareSell: sellNum,
        passengerIds: assignedIds,
      };

      setBatches([...batches, newBatch]);

      // Apply pricing to assigned passengers
      const updatedPassengers = passengers.map((p) => {
        if (assignedIds.includes(p.id)) {
          return {
            ...p,
            batchId: newBatchId,
            fareBuy: buyNum,
            fareSell: sellNum,
          };
        }
        return p;
      });

      onChangePassengers(updatedPassengers);
    }

    // Prepare next draft
    setDraftBuy('');
    setDraftSell('');
  }, [draftBuy, draftSell, draftCount, draftType, editingBatchId, batches, passengers, passengerCounts.remaining, currency, onChangePassengers]);

  // ── 4. Clone / Duplicate Batch to Remaining (Ctrl + D) ──
  const handleCloneBatchToRemaining = (sourceBatch: PriceBatch) => {
    const rem = passengerCounts.remaining[sourceBatch.type];
    if (rem <= 0) return;

    setEditingBatchId(null);
    setDraftType(sourceBatch.type);
    setDraftCount(rem);
    setDraftBuy(sourceBatch.fareBuy.toLocaleString());
    setDraftSell(sourceBatch.fareSell.toLocaleString());

    // Focus sell input so user can quickly edit different sell price
    setTimeout(() => {
      sellInputRef.current?.focus();
      sellInputRef.current?.select();
    }, 50);
  };

  // ── 5. Delete Batch ──
  const handleDeleteBatch = (batchId: string) => {
    setBatches(batches.filter((b) => b.id !== batchId));

    // Unassign passengers linked to this batch
    const updatedPassengers = passengers.map((p) => {
      if (p.batchId === batchId) {
        return {
          ...p,
          batchId: undefined,
          fareBuy: null,
          fareSell: null,
        };
      }
      return p;
    });

    onChangePassengers(updatedPassengers);
    if (editingBatchId === batchId) setEditingBatchId(null);
  };

  // ── 6. Edit Batch Mode ──
  const handleStartEditBatch = (batch: PriceBatch) => {
    setEditingBatchId(batch.id);
    setDraftType(batch.type);
    setDraftCount(batch.count);
    setDraftBuy(batch.fareBuy.toLocaleString());
    setDraftSell(batch.fareSell.toLocaleString());
    setTimeout(() => {
      buyInputRef.current?.focus();
      buyInputRef.current?.select();
    }, 50);
  };

  // ── 7. Reassign Passenger to Batch ──
  const handleReassignPassenger = (passengerId: string, newBatchId: string) => {
    const targetBatch = batches.find((b) => b.id === newBatchId);
    if (!targetBatch) return;

    const updatedPassengers = passengers.map((p) => {
      if (p.id === passengerId) {
        return {
          ...p,
          batchId: newBatchId,
          fareBuy: targetBatch.fareBuy,
          fareSell: targetBatch.fareSell,
        };
      }
      return p;
    });

    // Update batch passengerIds
    const updatedBatches = batches.map((b) => {
      const filtered = b.passengerIds.filter((id) => id !== passengerId);
      if (b.id === newBatchId) {
        return { ...b, passengerIds: [...filtered, passengerId] };
      }
      return { ...b, passengerIds: filtered };
    });

    setBatches(updatedBatches);
    onChangePassengers(updatedPassengers);
  };

  // ── 8. Command Parser (e.g. "2A 190000 210000" or "1C 100k 110k") ──
  const handleCommandShortcut = (text: string) => {
    const match = text.match(/^(\d+)\s*([aAcCiIأطت])\s+([\d,kKmM]+)\s+([\d,kKmM]+)$/);
    if (match) {
      const count = parseInt(match[1], 10);
      const typeChar = match[2].toUpperCase();
      let type: 'ADULT' | 'CHILD' | 'INFANT' = 'ADULT';
      if (typeChar === 'C' || typeChar === 'ط') type = 'CHILD';
      if (typeChar === 'I' || typeChar === 'ت' || typeChar === 'ر') type = 'INFANT';

      const buy = parseNumberInput(match[3]);
      const sell = parseNumberInput(match[4]);

      setDraftType(type);
      setDraftCount(count);
      setDraftBuy(buy.toLocaleString());
      setDraftSell(sell.toLocaleString());
      return true;
    }
    return false;
  };

  // ── 9. Keyboard Shortcuts Listener (Ctrl+D, Alt+1/2/3, Enter, Esc) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + 1: Adult
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        setDraftType('ADULT');
      }
      // Alt + 2: Child
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        setDraftType('CHILD');
      }
      // Alt + 3: Infant
      if (e.altKey && e.key === '3') {
        e.preventDefault();
        setDraftType('INFANT');
      }
      // Escape: Cancel edit
      if (e.key === 'Escape') {
        if (editingBatchId) {
          e.preventDefault();
          setEditingBatchId(null);
          setDraftBuy('');
          setDraftSell('');
        }
      }
      // Ctrl + D: Clone last batch of same type
      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        if (batches.length > 0) {
          e.preventDefault();
          const lastBatch = batches[batches.length - 1];
          handleCloneBatchToRemaining(lastBatch);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [batches, editingBatchId, handleCloneBatchToRemaining]);

  // ── 10. Passenger Rows Management ──
  const handleAddPassengerRow = () => {
    const newP: PassengerLine = {
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: '',
      ticketType: 'ADULT',
      ticketNumber: '',
      documentNumber: '',
      pnr: globalPnr || '',
      fareBuy: null,
      fareSell: null,
      tax1: 0,
      tax2: 0,
      charge: 0,
      percentage: 0,
      status: 'باقي',
    };
    onChangePassengers([...passengers, newP]);
  };

  const handleRemovePassengerRow = (idx: number) => {
    if (passengers.length <= 1) {
      onChangePassengers([
        {
          id: `p-${Date.now()}`,
          name: '',
          ticketType: 'ADULT',
          ticketNumber: '',
          documentNumber: '',
          pnr: globalPnr || '',
          fareBuy: null,
          fareSell: null,
          tax1: 0,
          tax2: 0,
          charge: 0,
          percentage: 0,
          status: 'باقي',
        },
      ]);
      setBatches([]);
      return;
    }
    const target = passengers[idx];
    const updated = passengers.filter((_, i) => i !== idx);

    // Remove from batch
    if (target.batchId) {
      setBatches(
        batches.map((b) =>
          b.id === target.batchId ? { ...b, passengerIds: b.passengerIds.filter((id) => id !== target.id) } : b,
        ),
      );
    }

    onChangePassengers(updated);
  };

  const handleDuplicatePassengerRow = (idx: number) => {
    const target = passengers[idx];
    const cloned: PassengerLine = {
      ...target,
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ticketNumber: '',
      documentNumber: '',
      batchId: undefined,
      fareBuy: null,
      fareSell: null,
    };
    const nextList = [...passengers];
    nextList.splice(idx + 1, 0, cloned);
    onChangePassengers(nextList);
  };

  /*
   * السعر يُكتب في صفّ صاحبه.
   *
   * كان التسعير كلّه في شريطٍ فوق الجدول: تسعّر «فئة» هناك، وتقرأ أثرها في صفٍّ
   * هنا — فكل تصحيح لمسافرٍ واحد رحلةٌ إلى أعلى الشاشة ثم عودة. والسعر مخزَّن
   * أصلاً لكل مسافر على حدة (fareBuy وfareSell)، فلا شيء يمنع كتابته حيث يُقرأ.
   *
   * وتعبئة العمود إلى أسفل بـCtrl+↓ لأن أغلب الملفات تتشارك السعر نفسه، فيُكتب
   * مرة ويُنسخ على البقية كما في الجداول الحسابية.
   */
  const commitRowPrice = (idx: number, field: 'fareBuy' | 'fareSell', raw: string) => {
    const text = String(raw ?? '').trim();
    const updated = [...passengers];
    const value = text === '' ? null : parseNumberInput(text, currency);
    updated[idx] = { ...updated[idx], [field]: value };
    // السعر المكتوب باليد يفكّ ارتباط الصف بدفعته، وإلا بدا تابعاً لسعرٍ لا يساويه.
    if (updated[idx].batchId) updated[idx] = { ...updated[idx], batchId: undefined };
    onChangePassengers(updated);
  };

  const fillPriceDown = (fromIdx: number, field: 'fareBuy' | 'fareSell') => {
    const source = passengers[fromIdx]?.[field];
    if (source === null || source === undefined) return;
    const updated = passengers.map((p, i) =>
      i <= fromIdx ? p : { ...p, [field]: source, batchId: undefined },
    );
    onChangePassengers(updated);
    showSuccessNotification(
      isAr ? 'تمّت التعبئة' : 'Filled down',
      isAr
        ? `نُسخ ${formatCurrency(source as number, currency)} إلى ${updated.length - fromIdx - 1} صفاً تحته`
        : `Copied ${formatCurrency(source as number, currency)} to ${updated.length - fromIdx - 1} row(s) below`,
    );
  };

  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  /*
   * التسعير حسب الفئة: ثلاثة أسطر جاهزة، لا خطوة إضافة.
   *
   * كان التسعير يبدأ بإنشاء «دفعة»: تختار الفئة، وتكتب العدد، وتكتب السعرين، ثم
   * تضغط Enter لتُنشئ كياناً ثم يُربط بالمسافرين. وهي أربع خطوات لتقول ما يقوله
   * التاجر في جملة: «البالغ بمئة وخمسين».
   *
   * فصارت الفئات الثلاث أسطراً حاضرة دائماً — بالغ وطفل ورضيع — يُكتب السعر في
   * سطر الفئة فيسري على مسافريها فوراً. لا إنشاء، ولا اعتماد، ولا ربط.
   */
  const priceWholeType = (type: 'ADULT' | 'CHILD' | 'INFANT', field: 'fareBuy' | 'fareSell', raw: string) => {
    const text = String(raw ?? '').trim();
    const value = text === '' ? null : parseNumberInput(text, currency);
    let touched = 0;
    const updated = passengers.map((p) => {
      if ((p.ticketType || 'ADULT') !== type) return p;
      if (p[field] === value) return p;
      touched += 1;
      return { ...p, [field]: value, batchId: undefined };
    });
    if (touched === 0) return;
    onChangePassengers(updated);
  };

  /**
   * السعر المعروض في سطر الفئة: قيمةُ مسافريها إن اتفقوا، وإلا فراغٌ لأن الفئة
   * لم يعد لها سعر واحد — وعرضُ أحدهم كأنه سعر الجميع كذبٌ صغير يكلّف كثيراً.
   */
  const typeRowValue = (type: 'ADULT' | 'CHILD' | 'INFANT', field: 'fareBuy' | 'fareSell'): number | null => {
    const group = passengers.filter((p) => (p.ticketType || 'ADULT') === type);
    if (group.length === 0) return null;
    const first = group[0][field] ?? null;
    return group.every((p) => (p[field] ?? null) === first) ? (first as number | null) : null;
  };

  const typeRowMixed = (type: 'ADULT' | 'CHILD' | 'INFANT', field: 'fareBuy' | 'fareSell'): boolean => {
    const group = passengers.filter((p) => (p.ticketType || 'ADULT') === type);
    if (group.length < 2) return false;
    const first = group[0][field] ?? null;
    return !group.every((p) => (p[field] ?? null) === first);
  };

  const handleFieldChange = (idx: number, field: keyof PassengerLine, value: any) => {
    const updated = [...passengers];
    updated[idx] = { ...updated[idx], [field]: value };
    onChangePassengers(updated);
  };

  // ── 11. Totals Calculation ──
  const totalBuy = passengers.reduce((sum, p) => sum + (p.fareBuy || 0) + (p.tax1 || 0) + (p.tax2 || 0) + (p.charge || 0), 0);
  const totalSell = passengers.reduce((sum, p) => sum + (p.fareSell || 0) + (p.tax1 || 0) + (p.tax2 || 0) + (p.charge || 0), 0);
  const totalTaxes = passengers.reduce((sum, p) => sum + (p.tax1 || 0) + (p.tax2 || 0) + (p.charge || 0), 0);
  const totalProfit = totalSell - totalBuy;

  const formatAmount = useCallback(
    (val: number | null | undefined) => {
      if (val === null || val === undefined) return '—';
      return formatCurrency(val, currency);
    },
    [currency],
  );

  const allPriced =
    passengers.length > 0 &&
    passengers.every((p) => p.fareSell !== null && p.fareSell > 0);

  const draftBuyNum = parseNumberInput(draftBuy, currency);
  const draftSellNum = parseNumberInput(draftSell, currency);
  const draftProfit = draftSellNum - draftBuyNum;

  // Header status string
  const statusString = useMemo(() => {
    const parts = [];
    if (passengerCounts.total.ADULT > 0) {
      parts.push(isAr ? formatArabicCount(passengerCounts.total.ADULT, 'ADULT') : `${passengerCounts.total.ADULT} Adult${passengerCounts.total.ADULT > 1 ? 's' : ''}`);
    }
    if (passengerCounts.total.CHILD > 0) {
      parts.push(isAr ? formatArabicCount(passengerCounts.total.CHILD, 'CHILD') : `${passengerCounts.total.CHILD} Child${passengerCounts.total.CHILD > 1 ? 'ren' : ''}`);
    }
    if (passengerCounts.total.INFANT > 0) {
      parts.push(isAr ? formatArabicCount(passengerCounts.total.INFANT, 'INFANT') : `${passengerCounts.total.INFANT} Infant${passengerCounts.total.INFANT > 1 ? 's' : ''}`);
    }
    return parts.join(' — ') || (isAr ? 'لا يوجد مسافرون' : 'No passengers');
  }, [passengerCounts.total, isAr]);

  const remainingString = useMemo(() => {
    const parts = [];
    if (passengerCounts.remaining.ADULT > 0) {
      parts.push(isAr ? formatArabicCount(passengerCounts.remaining.ADULT, 'ADULT') : `${passengerCounts.remaining.ADULT} Adult${passengerCounts.remaining.ADULT > 1 ? 's' : ''}`);
    }
    if (passengerCounts.remaining.CHILD > 0) {
      parts.push(isAr ? formatArabicCount(passengerCounts.remaining.CHILD, 'CHILD') : `${passengerCounts.remaining.CHILD} Child${passengerCounts.remaining.CHILD > 1 ? 'ren' : ''}`);
    }
    if (passengerCounts.remaining.INFANT > 0) {
      parts.push(isAr ? formatArabicCount(passengerCounts.remaining.INFANT, 'INFANT') : `${passengerCounts.remaining.INFANT} Infant${passengerCounts.remaining.INFANT > 1 ? 's' : ''}`);
    }
    return parts.join(isAr ? ' و ' : ', ');
  }, [passengerCounts.remaining, isAr]);

  // ── Dynamic Type Options with live remaining counts ──
  const dynamicTypeOptions = useMemo(() => {
    const list: Array<{ value: 'ADULT' | 'CHILD' | 'INFANT'; label: string }> = [];

    const types: Array<{ key: 'ADULT' | 'CHILD' | 'INFANT'; nameAr: string; nameEn: string }> = [
      { key: 'ADULT', nameAr: 'بالغ', nameEn: 'Adult' },
      { key: 'CHILD', nameAr: 'طفل', nameEn: 'Child' },
      { key: 'INFANT', nameAr: 'رضيع', nameEn: 'Infant' },
    ];

    types.forEach(({ key, nameAr, nameEn }) => {
      const name = isAr ? nameAr : nameEn;
      const tot = passengerCounts.total[key];
      const rem = passengerCounts.remaining[key];
      if (tot > 0) {
        list.push({
          value: key,
          label: rem > 0 ? (isAr ? `${name} (متبقي: ${rem})` : `${name} (${rem} left)`) : (isAr ? `${name} (اكتمل ✓)` : `${name} (Done ✓)`),
        });
      } else {
        list.push({
          value: key,
          label: `${name} (0)`,
        });
      }
    });

    return list;
  }, [passengerCounts, isAr]);

  // ── Handle Passenger Type Change in Table (Auto-links to available batch) ──
  const handlePassengerTypeChange = (idx: number, newType: 'ADULT' | 'CHILD' | 'INFANT') => {
    const updated = [...passengers];
    const target = updated[idx];
    const oldBatchId = target.batchId;

    // Find if there is an existing batch of this new type
    const matchingBatch = batches.find((b) => b.type === newType);

    if (matchingBatch) {
      updated[idx] = {
        ...target,
        ticketType: newType,
        batchId: matchingBatch.id,
        fareBuy: matchingBatch.fareBuy,
        fareSell: matchingBatch.fareSell,
      };

      // Update batches passenger lists
      setBatches(
        batches.map((b) => {
          if (b.id === oldBatchId) {
            return { ...b, passengerIds: b.passengerIds.filter((id) => id !== target.id) };
          }
          if (b.id === matchingBatch.id) {
            return { ...b, passengerIds: [...b.passengerIds.filter((id) => id !== target.id), target.id] };
          }
          return b;
        }),
      );
    } else {
      updated[idx] = {
        ...target,
        ticketType: newType,
        batchId: undefined,
        fareBuy: null,
        fareSell: null,
      };

      if (oldBatchId) {
        setBatches(
          batches.map((b) => (b.id === oldBatchId ? { ...b, passengerIds: b.passengerIds.filter((id) => id !== target.id) } : b)),
        );
      }
    }

    onChangePassengers(updated);
  };

  const [mobileView, setMobileView] = useState<'cards' | 'table'>('cards');

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden font-sans space-y-3 p-3.5 sm:p-5" dir={direction}>
      {/* ── CARD HEADER ── */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 flex-wrap gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 flex items-center justify-center shrink-0 relative">
            <Lottie src={flightTicketAnimation} loop={true} autoplay={true} className="w-full h-full object-contain" />
          </div>
          <div>
            <h3 className="font-bold text-[15px] text-[#111827] leading-tight">
              {isAr ? 'المسافرون والتذاكر' : 'Passengers & Tickets'}
            </h3>
            {statusString && (
              <span className="text-[11px] text-[#6B7280] font-normal block">
                {statusString}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons & Mobile View Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
          {/* Mobile View Switcher (Cards vs Table) */}
          <div className="flex md:hidden items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setMobileView('cards')}
              className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                mobileView === 'cards'
                  ? 'bg-white text-[#F45A0A] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid size={13} />
              <span>{isAr ? 'بطاقات' : 'Cards'}</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileView('table')}
              className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                mobileView === 'table'
                  ? 'bg-white text-[#F45A0A] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutList size={13} />
              <span>{isAr ? 'جدول' : 'Table'}</span>
            </button>
          </div>

          {/* Direct Native Windows File Picker for AI Ticket Parsing */}
          <input
            ref={smartFileInputRef}
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp,.txt"
            onChange={handleDirectSmartFileSelect}
            className="hidden"
          />

          <Button
            size="xs"
            variant="light"
            color="violet"
            radius="md"
            leftSection={
              isAnalyzingTicket ? (
                <Loader2 size={14} className="animate-spin text-purple-700" />
              ) : (
                <Sparkles size={14} className="text-purple-600" />
              )
            }
            loading={isAnalyzingTicket}
            onClick={() => smartFileInputRef.current?.click()}
            className="font-semibold text-xs border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300 h-8 px-2.5 sm:px-3 rounded-[8px] transition-colors cursor-pointer"
          >
            {isAnalyzingTicket
              ? (isAr ? 'جارٍ التحليل...' : 'Analyzing...')
              : (isAr ? 'إدخال ذكي' : 'AI Import')}
          </Button>

          <Button
            size="xs"
            variant="default"
            radius="md"
            leftSection={<Users size={14} />}
            onClick={() => setBatchModalOpen(true)}
            className="font-medium text-xs border-[#E2E6EA] text-slate-700 hover:bg-slate-50 h-8 px-2.5 sm:px-3 rounded-[8px] cursor-pointer"
          >
            {isAr ? 'دفعة جديدة' : 'Add Batch'}
          </Button>

          <Button
            size="xs"
            color="orange"
            variant="filled"
            radius="md"
            leftSection={<UserPlus size={14} />}
            onClick={handleAddPassengerRow}
            className="bg-[#F45A0A] hover:bg-orange-600 font-medium text-xs text-white shadow-xs cursor-pointer h-8 px-3 rounded-[8px]"
          >
            {isAr ? 'مسافر جديد' : 'Add Pax'}
          </Button>
        </div>
      </div>

      {/* ── 1. PRICE BATCH INPUT BAR (شريط التسعير بالدفعات) ── */}
      <div id="field-price-batch-bar" className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/90 space-y-2.5">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-[#F45A0A]" />
            <span className="font-bold text-slate-900 text-xs">
              {isAr ? 'التسعير حسب الفئة' : 'Pricing by type'}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {isAr
                ? 'اكتب السعر في سطر الفئة فيسري على مسافريها فوراً'
                : 'Type a price on the type row and it applies to its passengers at once'}
            </span>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[minmax(96px,1.1fr)_1fr_1fr_minmax(84px,0.9fr)] gap-2 px-0.5">
          <span className="text-[11px] font-bold text-slate-600">{isAr ? 'الفئة' : 'Type'}</span>
          <span className="text-[11px] font-bold text-slate-600 text-end">
            {isAr ? `شراء الفرد (${getCurrencySymbol(currency)})` : `Unit buy (${getCurrencySymbol(currency)})`}
          </span>
          <span className="text-[11px] font-bold text-slate-600 text-end">
            {isAr ? `بيع الفرد (${getCurrencySymbol(currency)}) *` : `Unit sell (${getCurrencySymbol(currency)}) *`}
          </span>
          <span className="text-[11px] font-bold text-slate-600 text-end">
            {isAr ? 'ربح الفرد' : 'Unit profit'}
          </span>
        </div>

        {/* الفئات الثلاث حاضرة دائماً، وما لا مسافر له يبقى باهتاً لا يُكتب فيه. */}
        <div className="space-y-1.5">
          {([
            { type: 'ADULT' as const, label: isAr ? 'بالغ' : 'Adult' },
            { type: 'CHILD' as const, label: isAr ? 'طفل' : 'Child' },
            { type: 'INFANT' as const, label: isAr ? 'رضيع' : 'Infant' },
          ]).map((row) => (
            <TypePriceRow
              key={row.type}
              label={row.label}
              count={passengerCounts.total[row.type] || 0}
              buyValue={typeRowValue(row.type, 'fareBuy')}
              sellValue={typeRowValue(row.type, 'fareSell')}
              buyMixed={typeRowMixed(row.type, 'fareBuy')}
              sellMixed={typeRowMixed(row.type, 'fareSell')}
              currency={currency}
              isAr={isAr}
              onCommit={(field, raw) => priceWholeType(row.type, field, raw)}
            />
          ))}
        </div>

        <div className="text-[10.5px] text-slate-500 font-medium pt-0.5 border-t border-slate-200/80">
          {isAr
            ? 'ولأي مسافر سعر خاص — اكتبه في صفّه بالجدول أدناه، و Ctrl+↓ يعبّئ بقية العمود.'
            : 'For a one-off price, type it in the passenger row below — Ctrl+↓ fills the rest of the column.'}
        </div>

        {batches.length > 0 && (
          <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
            <span className="text-[11.5px] font-semibold text-slate-700 block">
              {isAr ? 'دفعات الأسعار المعتمدة:' : 'Approved Price Batches:'}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {batches.map((b) => {
                const bProfit = b.fareSell - b.fareBuy;
                const bTotalProfit = bProfit * b.count;
                const typeName = b.type === 'ADULT'
                  ? (isAr ? 'بالغ' : 'Adult')
                  : b.type === 'CHILD'
                  ? (isAr ? 'طفل' : 'Child')
                  : (isAr ? 'رضيع' : 'Infant');

                // Passenger names in this batch
                const linkedNames = passengers
                  .filter((p) => p.batchId === b.id)
                  .map((p, idx) => p.name?.trim() || `${isAr ? 'مسافر' : 'Pax'} #${idx + 1}`)
                  .join(isAr ? '، ' : ', ');

                return (
                  <div
                    key={b.id}
                    className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs hover:border-orange-300 transition-colors shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900">
                          {typeName} ×{b.count}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500" dir="ltr">
                          {formatCurrency(b.fareBuy, currency)} → {formatCurrency(b.fareSell, currency)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                        <span className="text-slate-500">
                          {isAr ? 'ربح:' : 'Profit:'} <span className="font-mono font-bold text-emerald-700">+{formatCurrency(bProfit, currency)}</span>
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-500">
                          {isAr ? 'الإجمالي:' : 'Total:'} <span className="font-mono font-bold text-emerald-700">+{formatCurrency(bTotalProfit, currency)}</span>
                        </span>
                      </div>

                      {linkedNames && (
                        <span className="text-[10.5px] text-slate-400 truncate block mt-0.5" title={linkedNames}>
                          {isAr ? 'المسافرون:' : 'Passengers:'} {linkedNames}
                        </span>
                      )}
                    </div>

                    {/* Batch Actions: Edit, Clone Ctrl+D, Delete */}
                    <div className={`flex items-center gap-1 shrink-0 ${isAr ? 'mr-2' : 'ml-2'}`}>
                      <Tooltip label={isAr ? 'نسخ السعر وإضافة دفعة للمتبقي (Ctrl+D)' : 'Clone price to remaining (Ctrl+D)'} position="top" withArrow>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="orange"
                          onClick={() => handleCloneBatchToRemaining(b)}
                          className="text-[#F45A0A]"
                        >
                          <Copy size={13} />
                        </ActionIcon>
                      </Tooltip>

                      <Tooltip label={isAr ? 'تعديل الدفعة' : 'Edit batch'} position="top" withArrow>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="gray"
                          onClick={() => handleStartEditBatch(b)}
                          className="text-slate-600 hover:text-slate-900"
                        >
                          <Edit2 size={13} />
                        </ActionIcon>
                      </Tooltip>

                      <Tooltip label={isAr ? 'حذف الدفعة' : 'Delete batch'} position="top" withArrow>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => handleDeleteBatch(b.id)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 size={13} />
                        </ActionIcon>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── 2A. MOBILE TOUCH-FRIENDLY PASSENGER CARDS VIEW (md:hidden when mobileView === 'cards') ── */}
      {mobileView === 'cards' && (
        <div className="block md:hidden space-y-3" id="mobile-passengers-cards">
          {passengers.map((p, idx) => {
            const buyVal = p.fareBuy;
            const sellVal = p.fareSell;
            const isUnpriced = buyVal === null && sellVal === null;
            const totalRowBuy = (buyVal || 0) + (p.tax1 || 0) + (p.tax2 || 0) + (p.charge || 0);
            const totalRowSell = (sellVal || 0) + (p.tax1 || 0) + (p.tax2 || 0) + (p.charge || 0);
            const rowProfit = isUnpriced ? null : totalRowSell - totalRowBuy;
            const linkedBatch = batches.find((b) => b.id === p.batchId);
            const nameError = errors[`passenger_${idx}_name`];
            const sameTypeBatches = batches.filter((b) => b.type === (p.ticketType || 'ADULT'));

            return (
              <div
                key={p.id || idx}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-all"
              >
                {/* Card Top Banner */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full font-bold text-xs inline-flex items-center justify-center bg-[#FFF3E8] text-[#F45A0A] border border-orange-200">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-xs text-slate-800">
                      {p.name.trim() || `${isAr ? 'مسافر' : 'Passenger'} #${idx + 1}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Live Profit Tag */}
                    {rowProfit !== null && (
                      <span
                        className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          rowProfit > 0
                            ? 'bg-emerald-50 text-[#078B61] border border-emerald-200'
                            : rowProfit < 0
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                        dir="ltr"
                      >
                        {rowProfit >= 0 ? `+${formatCurrency(rowProfit, currency)}` : formatCurrency(rowProfit, currency)}
                      </span>
                    )}

                    {/* Actions */}
                    <Tooltip label={isAr ? 'تكرار المسافر' : 'Duplicate'} position="top">
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="gray"
                        onClick={() => handleDuplicatePassengerRow(idx)}
                        className="text-slate-500"
                      >
                        <Copy size={13} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={isAr ? 'حذف المسافر' : 'Delete'} position="top">
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => handleRemovePassengerRow(idx)}
                        className="text-red-500"
                      >
                        <Trash2 size={13} />
                      </ActionIcon>
                    </Tooltip>
                  </div>
                </div>

                {/* Card Fields Body */}
                <div className="p-3 space-y-2.5 text-xs">
                  {/* Passenger Name */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {isAr ? 'المسافر *' : 'Passenger *'}
                    </label>
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
                      placeholder={isAr ? 'اسم المسافر...' : 'Passenger name...'}
                      className={`w-full h-9 px-3 rounded-[8px] text-xs font-medium text-slate-900 outline-none transition-all ${
                        nameError
                          ? 'border border-red-500 bg-red-50/20'
                          : 'border border-[#E2E6EA] bg-white hover:border-slate-300 focus:border-[#F45A0A]'
                      }`}
                    />
                    {nameError && (
                      <span className="text-[10.5px] font-medium text-red-600 block mt-0.5">{nameError}</span>
                    )}
                  </div>

                  {/* 2-col: Type & Ticket No */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        {isAr ? 'النوع' : 'Type'}
                      </label>
                      <Select
                        size="xs"
                        radius="md"
                        value={p.ticketType}
                        onChange={(val) => handlePassengerTypeChange(idx, (val || 'ADULT') as any)}
                        data={[
                          { value: 'ADULT', label: isAr ? 'بالغ' : 'Adult' },
                          { value: 'CHILD', label: isAr ? 'طفل' : 'Child' },
                          { value: 'INFANT', label: isAr ? 'رضيع' : 'Infant' },
                        ]}
                        styles={{
                          input: { height: 36, fontSize: 12, fontWeight: 500, borderRadius: 8, borderColor: '#E2E6EA' },
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        {isAr ? 'رقم التذكرة' : 'Ticket #'}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={p.ticketNumber}
                        onChange={(e) => handleFieldChange(idx, 'ticketNumber', e.target.value)}
                        className="w-full h-9 px-2.5 rounded-[8px] border border-[#E2E6EA] bg-white text-xs font-mono font-medium text-slate-900 outline-none hover:border-slate-300 focus:border-[#F45A0A]"
                      />
                    </div>
                  </div>

                  {/* Price Batch & Direct Prices */}
                  <div className="p-2.5 bg-slate-50/70 rounded-lg border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-600">
                        {isAr ? 'دفعة السعر:' : 'Price Batch:'}
                      </span>
                      {linkedBatch ? (
                        <Popover position="bottom" withArrow shadow="md">
                          <Popover.Target>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-orange-50 text-[#F45A0A] border border-orange-200"
                            >
                              <span>{linkedBatch.batchName}</span>
                              {sameTypeBatches.length > 1 && <ChevronDown size={10} />}
                            </button>
                          </Popover.Target>
                          {sameTypeBatches.length > 1 && (
                            <Popover.Dropdown className="p-2 text-xs space-y-1 font-sans" dir={direction}>
                              <span className="text-[11px] font-semibold text-slate-700 block pb-1 border-b border-slate-100">
                                {isAr ? 'تبديل الدفعة:' : 'Switch Batch:'}
                              </span>
                              {sameTypeBatches.map((b) => (
                                <button
                                  key={b.id}
                                  type="button"
                                  onClick={() => handleReassignPassenger(p.id, b.id)}
                                  className={`w-full ${isAr ? 'text-right' : 'text-left'} p-1.5 rounded text-xs flex items-center justify-between ${
                                    b.id === p.batchId ? 'bg-orange-50 text-[#F45A0A] font-bold' : 'hover:bg-slate-50 text-slate-800'
                                  }`}
                                >
                                  <span>{b.batchName}</span>
                                  <span className="font-mono text-[10px]" dir="ltr">
                                    {b.fareSell.toLocaleString()}
                                  </span>
                                </button>
                              ))}
                            </Popover.Dropdown>
                          )}
                        </Popover>
                      ) : sameTypeBatches.length > 0 ? (
                        <Popover position="bottom" withArrow shadow="md">
                          <Popover.Target>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-300"
                            >
                              <span>{isAr ? `ربط بدفعة (${sameTypeBatches.length})` : `Link batch (${sameTypeBatches.length})`}</span>
                              <ChevronDown size={10} />
                            </button>
                          </Popover.Target>
                          <Popover.Dropdown className="p-2 text-xs space-y-1 font-sans" dir={direction}>
                            {sameTypeBatches.map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => handleReassignPassenger(p.id, b.id)}
                                className={`w-full ${isAr ? 'text-right' : 'text-left'} p-1.5 rounded text-xs flex items-center justify-between hover:bg-slate-50 text-slate-800`}
                              >
                                <span>{b.batchName}</span>
                                <span className="font-mono text-[10px]" dir="ltr">
                                  {b.fareSell.toLocaleString()}
                                </span>
                              </button>
                            ))}
                          </Popover.Dropdown>
                        </Popover>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10.5px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          {isAr ? 'غير مسعر' : 'Unpriced'}
                        </span>
                      )}
                    </div>

                    {/* Buy & Sell Amounts */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono" dir="ltr">
                      <div className="bg-white p-2 rounded border border-slate-200 text-center">
                        <span className="text-[10px] text-slate-500 font-sans block">
                          {isAr ? 'شراء' : 'Buy'}
                        </span>
                        <span className="font-bold text-slate-800 text-xs">
                          {formatAmount(buyVal)}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded border border-slate-200 text-center">
                        <span className="text-[10px] text-slate-500 font-sans block">
                          {isAr ? 'بيع' : 'Sell'}
                        </span>
                        <span className="font-bold text-slate-900 text-xs">
                          {formatAmount(sellVal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Mobile Totals Summary Card */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between font-sans font-semibold text-slate-800">
              <span>{isAr ? `إجمالي (${passengers.length} مسافر)` : `Total (${passengers.length} pax)`}</span>
              <span className={totalProfit >= 0 ? 'text-[#078B61] font-bold' : 'text-red-600 font-bold'}>
                {totalProfit >= 0 ? `+${formatAmount(totalProfit)}` : formatAmount(totalProfit)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center" dir="ltr">
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-[10px] font-sans text-slate-500 block">{isAr ? 'إجمالي الشراء' : 'Total Buy'}</span>
                <span className="font-bold text-slate-800">{formatAmount(totalBuy)}</span>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-[10px] font-sans text-slate-500 block">{isAr ? 'إجمالي البيع' : 'Total Sell'}</span>
                <span className="font-black text-slate-900">{formatAmount(totalSell)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2B. PASSENGERS TABLE (جدول المسافرين المنظم - Desktop or Mobile Table View) ── */}
      <div
        id="field-passengers-table"
        className={`w-full overflow-x-auto border border-[#E5E7EB] rounded-xl bg-white shadow-2xs ${
          mobileView === 'cards' ? 'hidden md:block' : 'block'
        }`}
      >
        <table className={`w-full ${isAr ? 'text-right' : 'text-left'} border-collapse text-xs font-sans table-auto whitespace-nowrap`}>
          <thead>
            <tr className="bg-slate-50/90 text-[#475569] font-semibold border-b border-[#E5E7EB] text-[12.5px] select-none whitespace-nowrap">
              <th className="py-2.5 px-3 w-12 text-center font-mono whitespace-nowrap">#</th>
              <th className="py-2.5 px-3 min-w-[220px] whitespace-nowrap">
                {isAr ? 'المسافر *' : 'Passenger *'}
              </th>
              <th className="py-2.5 px-3 min-w-[90px] whitespace-nowrap">{isAr ? 'النوع' : 'Type'}</th>
              <th className="py-2.5 px-3 min-w-[150px] whitespace-nowrap">{isAr ? 'رقم التذكرة' : 'Ticket #'}</th>
              <th className="py-2.5 px-3 min-w-[100px] text-center whitespace-nowrap">{isAr ? 'الدفعة' : 'Batch'}</th>
              <th className={`py-2.5 px-3 min-w-[120px] whitespace-nowrap ${isAr ? 'text-left' : 'text-right'}`}>
                {isAr ? 'الشراء' : 'Buy'}
              </th>
              <th className={`py-2.5 px-3 min-w-[120px] whitespace-nowrap ${isAr ? 'text-left' : 'text-right'}`}>
                {isAr ? 'البيع *' : 'Sell *'}
              </th>
              <th className={`py-2.5 px-3 min-w-[120px] whitespace-nowrap ${isAr ? 'text-left' : 'text-right'}`}>
                {isAr ? 'الربح' : 'Profit'}
              </th>
              <th className="py-2.5 px-3 min-w-[60px] text-center whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9] whitespace-nowrap">
            {passengers.map((p, idx) => {
              const buyVal = p.fareBuy;
              const sellVal = p.fareSell;
              const isUnpriced = buyVal === null && sellVal === null;

              const totalRowBuy = (buyVal || 0) + (p.tax1 || 0) + (p.tax2 || 0) + (p.charge || 0);
              const totalRowSell = (sellVal || 0) + (p.tax1 || 0) + (p.tax2 || 0) + (p.charge || 0);
              const rowProfit = isUnpriced ? null : totalRowSell - totalRowBuy;

              const linkedBatch = batches.find((b) => b.id === p.batchId);
              const nameError = errors[`passenger_${idx}_name`];

              // Same-type batches available for reassignment
              const sameTypeBatches = batches.filter((b) => b.type === (p.ticketType || 'ADULT'));

              return (
                <tr key={p.id || idx} className="hover:bg-slate-50/60 transition-colors h-[54px]">
                  {/* Row Number Circle */}
                  <td className="py-2 px-3 text-center">
                    <span className="w-7 h-7 rounded-full font-bold text-xs inline-flex items-center justify-center border bg-[#FFF3E8] text-[#F45A0A] border-orange-200">
                      {idx + 1}
                    </span>
                  </td>

                  {/* Passenger Name */}
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
                      placeholder={isAr ? 'اسم المسافر...' : 'Passenger name...'}
                      className={`w-full h-9 px-3 rounded-[8px] text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-[#A0A7B2] ${
                        nameError
                          ? 'border border-red-500 bg-red-50/20'
                          : 'border border-[#E2E6EA] bg-white hover:border-slate-300 focus:border-[#F45A0A]'
                      }`}
                    />
                    {nameError && (
                      <span className="text-[11px] font-medium text-red-600 block mt-0.5">{nameError}</span>
                    )}
                  </td>

                  {/* Passenger Type */}
                  <td className="py-2 px-3">
                    <Select
                      size="xs"
                      radius="md"
                      value={p.ticketType}
                      onChange={(val) => {
                        handlePassengerTypeChange(idx, (val || 'ADULT') as any);
                      }}
                      data={[
                        { value: 'ADULT', label: isAr ? 'بالغ' : 'Adult' },
                        { value: 'CHILD', label: isAr ? 'طفل' : 'Child' },
                        { value: 'INFANT', label: isAr ? 'رضيع' : 'Infant' },
                      ]}
                      styles={{
                        input: {
                          height: 36,
                          fontSize: 13,
                          fontWeight: 500,
                          borderRadius: 8,
                          borderColor: '#E2E6EA',
                        },
                      }}
                    />
                  </td>

                  {/* Ticket Number (LTR) */}
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      dir="ltr"
                      value={p.ticketNumber}
                      onChange={(e) => handleFieldChange(idx, 'ticketNumber', e.target.value)}
                      className="w-full h-9 px-3 rounded-[8px] border border-[#E2E6EA] bg-white text-xs font-mono font-medium text-slate-900 outline-none hover:border-slate-300 focus:border-[#F45A0A] placeholder:text-[#A0A7B2]"
                    />
                  </td>

                  {/* Linked Batch Name + Switcher Popover */}
                  <td className="py-2 px-3 text-center">
                    {linkedBatch ? (
                      <Popover position="bottom" withArrow shadow="md">
                        <Popover.Target>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-orange-50 text-[#F45A0A] border border-orange-200 hover:bg-orange-100 cursor-pointer"
                          >
                            <span>{linkedBatch.batchName}</span>
                            {sameTypeBatches.length > 1 && <ChevronDown size={11} />}
                          </button>
                        </Popover.Target>
                        {sameTypeBatches.length > 1 && (
                          <Popover.Dropdown className="p-2 text-xs space-y-1 font-sans" dir={direction}>
                            <span className="text-[11px] font-semibold text-slate-700 block pb-1 border-b border-slate-100">
                              {isAr ? 'تبديل الدفعة المسعرة:' : 'Switch Price Batch:'}
                            </span>
                            {sameTypeBatches.map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => handleReassignPassenger(p.id, b.id)}
                                className={`w-full ${isAr ? 'text-right' : 'text-left'} p-1.5 rounded text-xs flex items-center justify-between cursor-pointer ${
                                  b.id === p.batchId ? 'bg-orange-50 text-[#F45A0A] font-bold' : 'hover:bg-slate-50 text-slate-800'
                                }`}
                              >
                                <span>{b.batchName}</span>
                                <span className="font-mono text-[10px]" dir="ltr">
                                  {b.fareSell.toLocaleString()}
                                </span>
                              </button>
                            ))}
                          </Popover.Dropdown>
                        )}
                      </Popover>
                    ) : sameTypeBatches.length > 0 ? (
                      <Popover position="bottom" withArrow shadow="md">
                        <Popover.Target>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 cursor-pointer"
                          >
                            <span>{isAr ? `ربط بدفعة (${sameTypeBatches.length})` : `Link batch (${sameTypeBatches.length})`}</span>
                            <ChevronDown size={11} />
                          </button>
                        </Popover.Target>
                        <Popover.Dropdown className="p-2 text-xs space-y-1 font-sans" dir={direction}>
                          <span className="text-[11px] font-semibold text-slate-700 block pb-1 border-b border-slate-100">
                            {isAr ? 'ربط بدفعة متوفرة:' : 'Link available batch:'}
                          </span>
                          {sameTypeBatches.map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => handleReassignPassenger(p.id, b.id)}
                              className={`w-full ${isAr ? 'text-right' : 'text-left'} p-1.5 rounded text-xs flex items-center justify-between cursor-pointer hover:bg-slate-50 text-slate-800`}
                            >
                              <span>{b.batchName}</span>
                              <span className="font-mono text-[10px]" dir="ltr">
                                {b.fareSell.toLocaleString()}
                              </span>
                            </button>
                          ))}
                        </Popover.Dropdown>
                      </Popover>
                    ) : !isUnpriced ? (
                      /* له سعر كُتب في صفّه أو في سطر فئته — فهو مسعَّر، ولو بلا دفعة. */
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {isAr ? 'مسعَّر' : 'Priced'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        {isAr ? 'غير مسعر' : 'Unpriced'}
                      </span>
                    )}
                  </td>

                  {/* Buy Fare — editable in place */}
                  <td className="py-2 px-2" dir="ltr">
                    <EditablePriceCell
                      value={buyVal}
                      display={formatAmount(buyVal)}
                      placeholder="—"
                      title={isAr ? 'انقر للتعديل · Ctrl+↓ لتعبئة العمود' : 'Click to edit · Ctrl+↓ to fill down'}
                      onCommit={(raw) => commitRowPrice(idx, 'fareBuy', raw)}
                      onFillDown={() => fillPriceDown(idx, 'fareBuy')}
                    />
                  </td>

                  {/* Sell Fare — editable in place */}
                  <td className="py-2 px-2" dir="ltr">
                    <EditablePriceCell
                      value={sellVal}
                      display={formatAmount(sellVal)}
                      bold
                      placeholder="—"
                      title={isAr ? 'انقر للتعديل · Ctrl+↓ لتعبئة العمود' : 'Click to edit · Ctrl+↓ to fill down'}
                      onCommit={(raw) => commitRowPrice(idx, 'fareSell', raw)}
                      onFillDown={() => fillPriceDown(idx, 'fareSell')}
                    />
                  </td>

                  {/* Net Profit Display */}
                  <td className={`py-2 px-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-bold text-xs`} dir="ltr">
                    {rowProfit === null ? (
                      <span className="text-slate-400 font-normal">—</span>
                    ) : (
                      <span className={rowProfit > 0 ? 'text-[#078B61]' : rowProfit < 0 ? 'text-red-600' : 'text-slate-700'}>
                        {rowProfit >= 0 ? `+${formatCurrency(rowProfit, currency)}` : formatCurrency(rowProfit, currency)}
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-2 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Tooltip label={isAr ? 'تكرار المسافر' : 'Duplicate passenger'} position="top" withArrow>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="gray"
                          radius="md"
                          onClick={() => handleDuplicatePassengerRow(idx)}
                          className="text-slate-500 hover:text-slate-900 h-7 w-7 cursor-pointer"
                        >
                          <Copy size={13} />
                        </ActionIcon>
                      </Tooltip>

                      <Tooltip label={isAr ? 'حذف المسافر' : 'Delete passenger'} position="top" withArrow>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          radius="md"
                          onClick={() => handleRemovePassengerRow(idx)}
                          className="text-slate-400 hover:text-red-600 h-7 w-7 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </ActionIcon>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* ── 3. FIXED TOTALS FOOTER (صف الإجماليات الثابت) ── */}
          <tfoot>
            <tr className="bg-slate-50 font-bold border-t border-[#E5E7EB] text-slate-900 text-xs whitespace-nowrap">
              <td colSpan={5} className="py-3 px-4 text-slate-700 font-semibold text-xs whitespace-nowrap">
                {isAr ? 'الإجمالي' : 'Total'}
              </td>
              <td className={`py-3 px-3 ${isAr ? 'text-left' : 'text-right'} font-mono text-xs whitespace-nowrap`} dir="ltr">
                {formatAmount(totalBuy)}
              </td>
              <td className={`py-3 px-3 ${isAr ? 'text-left' : 'text-right'} font-mono text-xs text-slate-900 whitespace-nowrap`} dir="ltr">
                {formatAmount(totalSell)}
              </td>
              <td className={`py-3 px-3 ${isAr ? 'text-left' : 'text-right'} font-mono text-xs whitespace-nowrap`} dir="ltr">
                <span className={totalProfit > 0 ? 'text-[#078B61]' : totalProfit < 0 ? 'text-red-600' : 'text-slate-700'}>
                  {totalProfit >= 0 ? `+${formatAmount(totalProfit)}` : formatAmount(totalProfit)}
                </span>
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── MODAL: ENLARGED QUICK COPY-PASTE & EXCEL IMPORT ── */}
      <QuickPastePassengersModal
        opened={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        globalPnr={globalPnr}
        currency={currency}
        onImportPassengers={(importedList, detectedPnr, detectedSupplier, detectedCustomer) => {
          if (importedList.length > 0) {
            if (passengers.length === 1 && !passengers[0].name.trim() && !passengers[0].ticketNumber.trim()) {
              onChangePassengers(importedList);
            } else {
              onChangePassengers([...passengers, ...importedList]);
            }
          }
          if (onSmartImport && (detectedPnr || detectedSupplier || detectedCustomer)) {
            onSmartImport({
              pnr: detectedPnr,
              supplier: detectedSupplier,
              customer: detectedCustomer,
              customerName: detectedCustomer,
              supplierName: detectedSupplier,
            });
          }
        }}
      />
    </div>
  );
};

export default TicketPassengersTable;
