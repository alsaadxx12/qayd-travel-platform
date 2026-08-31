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
      if (p.batchId && p.fareSell !== null && p.fareSell > 0) {
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
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

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
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 p-1 relative">
            <Lottie src={flightTicketAnimation} loop={true} autoplay={true} className="w-full h-full object-contain" />
          </div>
          <div>
            <h3 className="font-bold text-[16px] sm:text-[17px] text-[#111827] leading-tight flex items-center gap-2">
              <span>{isAr ? 'المسافرون والتسعير بالدفعات' : 'Passengers & Pricing Batches'}</span>
              <span className="text-[10px] font-black text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                {isAr ? 'خطوة 2' : 'Step 2'}
              </span>
            </h3>
            <span className="text-[11.5px] sm:text-[12px] text-[#6B7280] font-normal block sm:inline">
              {statusString} {remainingString ? (isAr ? `| متبقي للتسعير: ${remainingString}` : `| Remaining to price: ${remainingString}`) : (isAr ? '| اكتمل تسعير جميع المسافرين ✓' : '| All passengers priced ✓')}
            </span>
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
              : (isAr ? 'إدخال ذكي (AI)' : 'AI Import')}
          </Button>

          <Button
            size="xs"
            variant="default"
            radius="md"
            leftSection={<Users size={14} />}
            onClick={() => setBatchModalOpen(true)}
            className="font-medium text-xs border-[#E2E6EA] text-slate-700 hover:bg-slate-50 h-8 px-2.5 sm:px-3 rounded-[8px] cursor-pointer"
          >
            {isAr ? 'إضافة دفعة' : 'Add Batch'}
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
            {isAr ? 'إضافة مسافر' : 'Add Pax'}
          </Button>
        </div>
      </div>

      {/* ── 1. PRICE BATCH INPUT BAR (شريط التسعير بالدفعات) ── */}
      <div id="field-price-batch-bar" className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/90 space-y-2.5">
        {/* Status Line */}
        <div className="flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-[#F45A0A]" />
            <span className="font-semibold text-slate-900 text-xs">
              {editingBatchId
                ? (isAr ? 'تعديل دفعة السعر المحددة:' : 'Edit Selected Price Batch:')
                : (isAr ? 'إضافة دفعة سعر جديدة:' : 'Add New Price Batch:')}
            </span>
            {editingBatchId && (
              <button
                type="button"
                onClick={() => {
                  setEditingBatchId(null);
                  setDraftBuy('');
                  setDraftSell('');
                }}
                className="text-[11px] text-red-600 hover:underline"
              >
                {isAr ? '(إلغاء التعديل Esc)' : '(Cancel Edit Esc)'}
              </button>
            )}
          </div>
        </div>

        {/* ── MOBILE 2-COLUMN GRID (sm:hidden) ── */}
        <div className="grid sm:hidden grid-cols-2 gap-2 font-sans select-none">
          {/* Type Select */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              {isAr ? 'النوع' : 'Type'}
            </label>
            <Select
              size="xs"
              radius="md"
              value={draftType}
              onChange={(v) => setDraftType(v as any)}
              data={dynamicTypeOptions}
              styles={{
                input: {
                  height: 38,
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 8,
                  borderColor: '#CBD5E1',
                },
              }}
            />
          </div>

          {/* Count Input */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1 text-center">
              {isAr ? 'العدد' : 'Count'}
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              dir="ltr"
              value={draftCount}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^0-9]/g, '');
                const num = parseInt(cleaned, 10);
                setDraftCount(isNaN(num) || num < 1 ? 1 : num);
              }}
              placeholder="1"
              className="w-full h-[38px] px-2.5 rounded-[8px] border border-slate-300 bg-white font-mono font-bold text-center text-xs text-slate-900 outline-none hover:border-slate-400 focus:border-[#F45A0A]"
            />
          </div>

          {/* Unit Buy Input */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              {isAr ? `شراء الفرد (${getCurrencySymbol(currency)})` : `Unit Buy (${getCurrencySymbol(currency)})`}
            </label>
            <input
              type="text"
              dir="ltr"
              value={draftBuy}
              onChange={(e) => {
                const text = e.target.value;
                if (!handleCommandShortcut(text)) {
                  setDraftBuy(text);
                }
              }}
              onBlur={() => {
                const val = parseNumberInput(draftBuy, currency);
                if (val > 0) setDraftBuy(val.toLocaleString());
              }}
              placeholder="0"
              className="w-full h-[38px] px-3 rounded-[8px] border border-slate-300 bg-white font-mono font-semibold text-xs text-slate-900 outline-none hover:border-slate-400 focus:border-[#F45A0A]"
            />
          </div>

          {/* Unit Sell Input */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              {isAr ? `بيع الفرد (${getCurrencySymbol(currency)}) *` : `Unit Sell (${getCurrencySymbol(currency)}) *`}
            </label>
            <input
              type="text"
              dir="ltr"
              value={draftSell}
              onChange={(e) => setDraftSell(e.target.value)}
              onBlur={() => {
                const sellNum = parseNumberInput(draftSell, currency);
                if (sellNum > 0) setDraftSell(sellNum.toLocaleString());
              }}
              placeholder="0"
              className="w-full h-[38px] px-3 rounded-[8px] border border-slate-300 bg-white font-mono font-bold text-xs text-slate-900 outline-none hover:border-slate-400 focus:border-[#F45A0A]"
            />
          </div>

          {/* Live Profit indicator */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              {isAr ? 'ربح الفرد' : 'Unit Profit'}
            </label>
            <div className="w-full h-[38px] px-2 rounded-[8px] border border-slate-200 bg-white flex items-center justify-center text-xs" dir="ltr">
              <span
                className={`font-mono font-bold text-xs truncate ${
                  draftProfit > 0 ? 'text-[#078B61]' : draftProfit < 0 ? 'text-red-600' : 'text-slate-600'
                }`}
              >
                {draftProfit >= 0 ? `+${formatCurrency(draftProfit, currency)}` : formatCurrency(draftProfit, currency)}
              </span>
            </div>
          </div>

          {/* Save / Enter button */}
          <div className="flex flex-col justify-end">
            <Button
              size="xs"
              color="orange"
              variant="filled"
              radius="md"
              fullWidth
              onClick={handleSaveBatch}
              className="bg-[#F45A0A] hover:bg-orange-600 font-bold text-xs text-white shadow-xs cursor-pointer h-[38px] min-h-[38px] max-h-[38px] rounded-[8px] flex items-center justify-center whitespace-nowrap"
            >
              {editingBatchId ? (isAr ? 'تحديث الدفعة' : 'Update') : (isAr ? 'اعتماد الدفعة ↵' : 'Enter ↵')}
            </Button>
          </div>
        </div>

        {/* ── DESKTOP SINGLE-LINE GRID (hidden sm:flex) ── */}
        <div className="hidden sm:flex items-end gap-2.5 overflow-x-auto pb-1 select-none">
          {/* 1. Type Select (145px) */}
          <div className="w-[145px] shrink-0">
            <label className="block text-[12px] font-medium text-slate-700 mb-1 whitespace-nowrap">
              {isAr ? 'النوع' : 'Type'}
            </label>
            <Select
              size="xs"
              radius="md"
              value={draftType}
              onChange={(v) => setDraftType(v as any)}
              data={dynamicTypeOptions}
              styles={{
                input: {
                  height: 38,
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderRadius: 8,
                  borderColor: '#CBD5E1',
                },
              }}
            />
          </div>

          {/* 2. Count Input (90px) */}
          <div className="w-[90px] shrink-0">
            <label className="block text-[12px] font-medium text-slate-700 mb-1 text-center whitespace-nowrap">
              {isAr ? 'العدد' : 'Count'}
            </label>
            <input
              ref={countInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              dir="ltr"
              value={draftCount}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^0-9]/g, '');
                const num = parseInt(cleaned, 10);
                setDraftCount(isNaN(num) || num < 1 ? 1 : num);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  buyInputRef.current?.focus();
                  buyInputRef.current?.select();
                }
              }}
              placeholder="1"
              style={{
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                fontVariantNumeric: 'lining-nums tabular-nums',
              }}
              className="w-full h-[38px] px-2.5 rounded-[8px] border border-slate-300 bg-white font-mono font-bold text-center text-xs text-slate-900 outline-none hover:border-slate-400 focus:border-[#F45A0A]"
            />
          </div>

          {/* 3. Buy Fare Input (160px) */}
          <div className="w-[160px] shrink-0">
            <label className="block text-[12px] font-medium text-slate-700 mb-1 whitespace-nowrap">
              {isAr ? `شراء الفرد (${getCurrencySymbol(currency)})` : `Unit Buy (${getCurrencySymbol(currency)})`}
            </label>
            <input
              ref={buyInputRef}
              type="text"
              dir="ltr"
              value={draftBuy}
              onChange={(e) => {
                const text = e.target.value;
                if (!handleCommandShortcut(text)) {
                  setDraftBuy(text);
                }
              }}
              onBlur={() => {
                const val = parseNumberInput(draftBuy, currency);
                if (val > 0) setDraftBuy(val.toLocaleString());
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  const val = parseNumberInput(draftBuy, currency);
                  if (val > 0) setDraftBuy(val.toLocaleString());
                  sellInputRef.current?.focus();
                  sellInputRef.current?.select();
                }
              }}
              placeholder="0"
              className="w-full h-[38px] px-3 rounded-[8px] border border-slate-300 bg-white font-mono font-semibold text-xs text-slate-900 outline-none hover:border-slate-400 focus:border-[#F45A0A]"
            />
          </div>

          {/* 4. Sell Fare Input (160px) */}
          <div className="w-[160px] shrink-0">
            <label className="block text-[12px] font-medium text-slate-700 mb-1 whitespace-nowrap">
              {isAr ? `بيع الفرد (${getCurrencySymbol(currency)}) *` : `Unit Sell (${getCurrencySymbol(currency)}) *`}
            </label>
            <input
              ref={sellInputRef}
              type="text"
              dir="ltr"
              value={draftSell}
              onChange={(e) => setDraftSell(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveBatch();
                }
              }}
              onBlur={() => {
                const sellNum = parseNumberInput(draftSell, currency);
                if (sellNum > 0) setDraftSell(sellNum.toLocaleString());
                if (sellNum > 0 && draftCount > 0) {
                  handleSaveBatch();
                }
              }}
              placeholder="0"
              className="w-full h-[38px] px-3 rounded-[8px] border border-slate-300 bg-white font-mono font-bold text-xs text-slate-900 outline-none hover:border-slate-400 focus:border-[#F45A0A]"
            />
          </div>

          {/* 5. Live Profit Indicator (130px) */}
          <div className="w-[130px] shrink-0">
            <label className="block text-[12px] font-medium text-slate-700 mb-1 whitespace-nowrap">
              {isAr ? 'ربح الفرد' : 'Unit Profit'}
            </label>
            <div className="w-full h-[38px] px-3 rounded-[8px] border border-slate-200 bg-white flex items-center justify-center text-xs" dir="ltr">
              <span
                className={`font-mono font-bold text-xs whitespace-nowrap ${
                  draftProfit > 0 ? 'text-[#078B61]' : draftProfit < 0 ? 'text-red-600' : 'text-slate-600'
                }`}
              >
                {draftProfit >= 0 ? `+${formatCurrency(draftProfit, currency)}` : formatCurrency(draftProfit, currency)}
              </span>
            </div>
          </div>

          {/* 6. Enter Submit Button (48px matching 38px height) */}
          <Button
            size="xs"
            color="orange"
            variant="filled"
            radius="md"
            onClick={handleSaveBatch}
            className="bg-[#F45A0A] hover:bg-orange-600 font-bold text-xs text-white shadow-xs cursor-pointer h-[38px] min-h-[38px] max-h-[38px] px-4 rounded-[8px] shrink-0 flex items-center justify-center whitespace-nowrap"
          >
            {editingBatchId ? (isAr ? 'تحديث' : 'Update') : 'Enter ↵'}
          </Button>
        </div>

        {/* ── CREATED PRICE BATCHES CHIPS & ROWS ── */}
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
                      {isAr ? 'اسم المسافر *' : 'Passenger Name *'}
                    </label>
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
                      placeholder={isAr ? 'اسم المسافر (LATIN / ARABIC)...' : 'Full Name (LATIN / ARABIC)...'}
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
                        {isAr ? 'رقم التذكرة الإلكترونية' : 'E-Ticket #'}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={p.ticketNumber}
                        onChange={(e) => handleFieldChange(idx, 'ticketNumber', e.target.value)}
                        placeholder={isAr ? 'رقم التذكرة' : 'Ticket number'}
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
              <th className="py-3 px-3 w-12 text-center font-mono whitespace-nowrap">#</th>
              <th className="py-3 px-3 min-w-[240px] whitespace-nowrap">
                {isAr ? 'اسم المسافر *' : 'Passenger Name *'}
              </th>
              <th className="py-3 px-3 min-w-[110px] whitespace-nowrap">{isAr ? 'النوع' : 'Type'}</th>
              <th className="py-3 px-3 min-w-[180px] whitespace-nowrap">{isAr ? 'رقم التذكرة الإلكترونية' : 'E-Ticket #'}</th>
              <th className="py-3 px-3 min-w-[140px] text-center whitespace-nowrap">{isAr ? 'الدفعة المسعرة' : 'Price Batch'}</th>
              <th className={`py-3 px-3 min-w-[145px] whitespace-nowrap ${isAr ? 'text-left' : 'text-right'}`}>
                {isAr ? `سعر الشراء (${getCurrencySymbol(currency)})` : `Buy Fare (${getCurrencySymbol(currency)})`}
              </th>
              <th className={`py-3 px-3 min-w-[145px] whitespace-nowrap ${isAr ? 'text-left' : 'text-right'}`}>
                {isAr ? `سعر البيع (${getCurrencySymbol(currency)}) *` : `Sell Fare (${getCurrencySymbol(currency)}) *`}
              </th>
              <th className={`py-3 px-3 min-w-[140px] whitespace-nowrap ${isAr ? 'text-left' : 'text-right'}`}>
                {isAr ? `صافي الربح (${getCurrencySymbol(currency)})` : `Net Profit (${getCurrencySymbol(currency)})`}
              </th>
              <th className="py-3 px-3 min-w-[90px] text-center whitespace-nowrap">{isAr ? 'إجراء' : 'Action'}</th>
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
                      placeholder={isAr ? 'اسم المسافر الثلاثي (LATIN / ARABIC)...' : 'Full Passenger Name (LATIN / ARABIC)...'}
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
                      placeholder={isAr ? 'رقم التذكرة' : 'Ticket number'}
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
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        {isAr ? 'غير مسعر' : 'Unpriced'}
                      </span>
                    )}
                  </td>

                  {/* Buy Fare Display */}
                  <td className={`py-2 px-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-semibold text-xs text-slate-800`} dir="ltr">
                    {formatAmount(buyVal)}
                  </td>

                  {/* Sell Fare Display */}
                  <td className={`py-2 px-3 ${isAr ? 'text-left' : 'text-right'} font-mono font-bold text-xs text-slate-900`} dir="ltr">
                    {formatAmount(sellVal)}
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
                {isAr ? `الإجمالي (${passengers.length} مسافر)` : `Total (${passengers.length} pax)`}
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
