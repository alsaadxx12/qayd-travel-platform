import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Modal,
  Badge,
  Text,
  FileButton,
  Loader,
  Select,
} from '@mantine/core';
import {
  IconUpload,
  IconCheck,
  IconSparkles,
  IconCalendar,
  IconPlane,
  IconMapPin,
  IconAlertTriangle,
  IconClipboard,
  IconLuggage,
  IconUser,
  IconFileText,
  IconPhoto,
  IconRefresh,
  IconCurrencyDollar,
  IconTrendingUp,
  IconBolt,
  IconX,
} from '@tabler/icons-react';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { API_BASE_URL } from '../../api/client';
import { prepareTicketParseFormData } from '../../utils/pdfTextExtractor';

export interface ParsedPassenger {
  name: string;
  ticketType: 'ADULT' | 'CHILD' | 'INFANT';
  ticketNumber: string;
  documentNumber?: string;
  baggage?: string;
  fareBuy: number;
  fareSell: number;
  tax1: number;
  tax2: number;
  charge: number;
}

export interface ParsedTicketData {
  pnr: string;
  bookingRef?: string;
  passengers: ParsedPassenger[];
  routeFrom?: string;
  routeTo?: string;
  routeStops?: string[];
  airline?: string;
  travelDate?: string;
  returnDate?: string;
  issueDate?: string;
  tripType?: 'ONE_WAY' | 'ROUND_TRIP';
  travelClass?: string;
  flightNumber?: string;
  baggage?: string;
  currency?: string;
  aiEngineUsed?: string;
}

interface SmartTicketImportModalProps {
  opened: boolean;
  onClose: () => void;
  onImport: (data: ParsedTicketData) => void;
  initialFile?: File | null;
}

export const SmartTicketImportModal: React.FC<SmartTicketImportModalProps> = ({
  opened,
  onClose,
  onImport,
  initialFile,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedTicketData | null>(null);
  const [passengersList, setPassengersList] = useState<ParsedPassenger[]>([]);
  const [currency, setCurrency] = useState<string>('IQD');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Quick Batch Pricing State (نظام التسعير السريع للشراء والمبيع)
  const [batchType, setBatchType] = useState<string>('ALL');
  const [batchBuy, setBatchBuy] = useState<string>('');
  const [batchSell, setBatchSell] = useState<string>('');

  /* ─── Send file directly to Backend AI API ─── */
  const handleFileUpload = useCallback(async (file: File | null) => {
    if (!file) return;
    setSelectedFile(file);
    setParsedResult(null);
    setPassengersList([]);
    setAiError(null);
    setIsAnalyzing(true);

    try {
      const formData = await prepareTicketParseFormData(file);

      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/smart-parser/parse-ticket`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (res.ok) {
        const apiResult = await res.json();
        if (apiResult && (apiResult.pnr || (apiResult.passengers && apiResult.passengers.length > 0) || apiResult.airline)) {
          const formattedPassengers: ParsedPassenger[] = (apiResult.passengers || []).map((p: any) => ({
            name: p.name || '',
            ticketType: p.ticketType || 'ADULT',
            ticketNumber: p.ticketNumber || '',
            documentNumber: p.documentNumber || '',
            fareBuy: Number(p.fareBuy) > 0 ? Number(p.fareBuy) : 0,
            fareSell: Number(p.fareSell) > 0 ? Number(p.fareSell) : 0,
            tax1: Number(p.tax1) > 0 ? Number(p.tax1) : 0,
            tax2: Number(p.tax2) > 0 ? Number(p.tax2) : 0,
            charge: Number(p.charge) > 0 ? Number(p.charge) : 0,
            baggage: p.baggage || apiResult.baggage || '',
          }));

          setParsedResult(apiResult);
          setPassengersList(formattedPassengers);
          setCurrency((apiResult.currency || 'IQD').toUpperCase());
        } else {
          setAiError('لم يتمكن الذكاء الاصطناعي من استخراج البيانات. تأكد من أن الملف يحتوي على تذكرة طيران صالحة.');
        }
      } else {
        const errBody = await res.text();
        console.error('AI Parser API Error:', res.status, errBody);
        if (res.status === 401) {
          setAiError('خطأ في المصادقة. يرجى تسجيل الدخول مجدداً.');
        } else {
          setAiError('تعذر التحليل عبر الذكاء الاصطناعي. تأكد من إعدادات المفتاح وسعة الرصيد.');
        }
      }
    } catch (err) {
      console.error('AI Parser connection error:', err);
      setAiError('تعذر الاتصال بالخادم. يرجى التحقق من اتصال الشبكة.');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // When initialFile changes and modal opens, start analysis immediately!
  useEffect(() => {
    if (opened && initialFile) {
      handleFileUpload(initialFile);
    }
  }, [opened, initialFile, handleFileUpload]);

  /* ─── Global Paste Listener (Ctrl+V for Screenshots) ─── */
  useEffect(() => {
    if (!opened) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.indexOf('image') !== -1 || item.type === 'application/pdf') {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            const pastedFile = new File([blob], `ticket-screenshot-${Date.now()}.${item.type.includes('png') ? 'png' : 'jpg'}`, {
              type: blob.type || 'image/jpeg',
            });
            handleFileUpload(pastedFile);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [opened, handleFileUpload]);

  // ── Quick Batch Pricing Application (تطبيق التسعير السريع على المسافرين) ──
  const handleApplyBatchPricing = () => {
    const buyVal = parseFloat(batchBuy.replace(/[^0-9.]/g, '')) || 0;
    const sellVal = parseFloat(batchSell.replace(/[^0-9.]/g, '')) || 0;

    if (buyVal === 0 && sellVal === 0) return;

    setPassengersList((prev) =>
      prev.map((p) => {
        if (batchType === 'ALL' || p.ticketType === batchType) {
          return {
            ...p,
            fareBuy: buyVal > 0 ? buyVal : p.fareBuy,
            fareSell: sellVal > 0 ? sellVal : p.fareSell,
          };
        }
        return p;
      })
    );

    showSuccessNotification(
      'تم تطبيق التسعير السريع',
      `تم تسعير ${batchType === 'ALL' ? 'جميع المسافرين' : `فئة ${batchType}`} (شراء: ${buyVal.toLocaleString()} | مبيع: ${sellVal.toLocaleString()})`
    );
  };

  // ── Financial Totals Calculation ──
  const totals = useMemo(() => {
    const totalBuy = passengersList.reduce((sum, p) => sum + (Number(p.fareBuy) || 0), 0);
    const totalSell = passengersList.reduce((sum, p) => sum + (Number(p.fareSell) || 0), 0);
    const profit = totalSell - totalBuy;
    return { totalBuy, totalSell, profit };
  }, [passengersList]);

  // Reset when modal closes
  const handleClose = () => {
    setSelectedFile(null);
    setParsedResult(null);
    setPassengersList([]);
    setAiError(null);
    setIsAnalyzing(false);
    setBatchBuy('');
    setBatchSell('');
    onClose();
  };

  const handleApplyToInvoice = () => {
    if (!parsedResult) return;
    const finalData: ParsedTicketData = {
      ...parsedResult,
      currency,
      passengers: passengersList,
    };
    onImport(finalData);
    showSuccessNotification(
      'تم تجهيز الفاتورة بنجاح',
      `تم استخراج ${passengersList.length} مسافرين والرمز (${finalData.pnr || '—'}) وإدراجها في محرّر الفواتير.`
    );
    handleClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2.5 text-slate-900">
          <div className="w-8 h-8 rounded-lg bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center shrink-0 border border-orange-100">
            <IconSparkles size={18} strokeWidth={2.2} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-900 font-black text-[15px]">قارئ ومحلل التذاكر</span>
            <Badge color="orange" variant="light" size="sm" radius="md" className="font-mono font-bold">
              AI OCR
            </Badge>
          </div>
        </div>
      }
      size="1340px"
      centered
      dir="rtl"
      radius="20px"
      styles={{
        header: { backgroundColor: '#ffffff', borderBottom: '1px solid #E5E7EB', padding: '12px 24px' },
        body: { padding: '0', backgroundColor: '#F8FAFC', display: 'flex', flexDirection: 'column', height: 'calc(88vh - 65px)' },
        content: { height: '88vh', maxHeight: '920px', minHeight: '640px', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
      }}
    >
      <div className="flex flex-col h-full font-sans text-right select-none" dir="rtl">
        {/* ── 1. SCROLLABLE BODY AREA ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Top Dropzone & File Action Bar */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileUpload(file);
            }}
            className={`relative rounded-xl border border-dashed p-3 transition-all duration-200 text-center ${
              isDragOver
                ? 'border-[#F45A0A] bg-[#FFF8F3] shadow-md scale-[1.005]'
                : 'border-slate-300 bg-white hover:border-[#F45A0A]/70'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-right flex-1">
                <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center shrink-0 border border-orange-100">
                  <IconPhoto size={18} strokeWidth={2} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-bold text-slate-800">
                    الصق لقطة الشاشة أو اسحب التذكرة هنا
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[10.5px] font-mono font-bold">
                    <IconClipboard size={11} />
                    Ctrl + V
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selectedFile && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-[11.5px] font-mono font-bold text-slate-700 max-w-[240px] truncate">
                    <IconFileText size={13} className="text-[#F45A0A] shrink-0" />
                    <span className="truncate">{selectedFile.name}</span>
                  </div>
                )}
                <FileButton onChange={handleFileUpload} accept="application/pdf,image/*,.txt,.doc,.docx">
                  {(props) => (
                    <button
                      {...props}
                      type="button"
                      className="h-[32px] px-3 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-[12px] shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <IconUpload size={13} strokeWidth={2.4} />
                      <span>تغيير الملف</span>
                    </button>
                  )}
                </FileButton>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {isAnalyzing && (
            <div className="bg-white border border-slate-200 rounded-xl p-10 flex flex-col items-center justify-center gap-2.5 shadow-2xs my-4">
              <Loader color="orange" size="lg" type="dots" />
              <span className="text-[14px] font-bold text-slate-800">
                جاري قراءة واستخراج بيانات التذكرة...
              </span>
            </div>
          )}

          {/* Error State */}
          {aiError && !isAnalyzing && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5 shadow-2xs">
              <IconAlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-[13px] font-bold text-red-900 block">فشل قراءة التذكرة</span>
                <p className="text-[11.5px] text-red-700 leading-relaxed font-medium">{aiError}</p>
              </div>
            </div>
          )}

          {/* Extracted Data + Quick Pricing + Passenger Table */}
          {parsedResult && !isAnalyzing && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* Header Cards Grid (PNR, Airline, Route, Flight, Travel Date, Return Date, Baggage) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {/* PNR */}
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-2.5 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">رمز الحجز (PNR)</span>
                  <span className="text-[15px] font-black font-mono text-[#F45A0A] block truncate">
                    {parsedResult.pnr || '—'}
                  </span>
                </div>

                {/* Airline */}
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-2.5 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">شركة الطيران</span>
                  <span className="text-[13px] font-bold text-slate-900 block truncate">
                    {parsedResult.airline || '—'}
                  </span>
                </div>

                {/* Route */}
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-2.5 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">المسار</span>
                  <span className="text-[13px] font-bold font-mono text-slate-900 block truncate">
                    {parsedResult.routeFrom && parsedResult.routeTo
                      ? `${parsedResult.routeFrom} ➔ ${parsedResult.routeTo}`
                      : '—'}
                  </span>
                </div>

                {/* Flight No */}
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-2.5 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">رقم الرحلة / الدرجة</span>
                  <span className="text-[12.5px] font-bold font-mono text-slate-800 block truncate">
                    {parsedResult.flightNumber || '—'} {parsedResult.travelClass ? `(${parsedResult.travelClass})` : ''}
                  </span>
                </div>

                {/* Travel Date */}
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-2.5 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">تاريخ السفر</span>
                  <span className="text-[13px] font-bold font-mono text-[#078B61] block truncate">
                    {parsedResult.travelDate || '—'}
                  </span>
                </div>

                {/* Baggage */}
                <div className="bg-white border border-[#E5E7EB] rounded-xl p-2.5 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">الأمتعة والوزن</span>
                  <span className="text-[13px] font-bold font-mono text-slate-900 block truncate">
                    {parsedResult.baggage || '—'}
                  </span>
                </div>
              </div>

              {/* ── 2. QUICK BATCH PRICING BAR (حاوية بيضاء نظيفة بدون بوردر برتقالي عريض وزر برتقالي) ── */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-3 shadow-2xs space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <IconBolt size={15} className="text-[#F45A0A]" />
                    <span className="text-[12.5px] font-bold text-slate-800">
                      التسعير السريع:
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400">العملة:</span>
                    <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                      <button
                        type="button"
                        onClick={() => setCurrency('IQD')}
                        className={`px-2.5 py-0.5 text-xs font-bold rounded-md transition-all ${currency === 'IQD' ? 'bg-[#F45A0A] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                      >
                        IQD (د.ع)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrency('USD')}
                        className={`px-2.5 py-0.5 text-xs font-bold rounded-md transition-all ${currency === 'USD' ? 'bg-[#F45A0A] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                      >
                        USD ($)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Batch Inputs Row */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                  {/* Apply To Type */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">تطبيق على:</label>
                    <Select
                      size="xs"
                      radius="md"
                      value={batchType}
                      onChange={(v) => setBatchType(v || 'ALL')}
                      data={[
                        { value: 'ALL', label: `جميع المسافرين (${passengersList.length})` },
                        { value: 'ADULT', label: `البالغين (${passengersList.filter((p) => p.ticketType === 'ADULT').length})` },
                        { value: 'CHILD', label: `الأطفال (${passengersList.filter((p) => p.ticketType === 'CHILD').length})` },
                        { value: 'INFANT', label: `الرضع (${passengersList.filter((p) => p.ticketType === 'INFANT').length})` },
                      ]}
                      styles={{
                        input: { height: 38, fontWeight: 700, fontSize: 12, borderColor: '#E2E8F0', backgroundColor: '#FAFAFA' },
                      }}
                    />
                  </div>

                  {/* Unit Buy Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      سعر الشراء الفردي ({currency === 'IQD' ? 'د.ع' : '$'})
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={batchBuy}
                      onChange={(e) => setBatchBuy(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleApplyBatchPricing();
                      }}
                      placeholder="0"
                      className="w-full h-[38px] px-3 rounded-lg border border-slate-200 bg-[#FAFAFA] font-mono font-black text-xs text-slate-900 outline-none hover:border-slate-300 focus:border-[#F45A0A] focus:bg-white transition-colors"
                    />
                  </div>

                  {/* Unit Sell Input */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      سعر المبيع الفردي ({currency === 'IQD' ? 'د.ع' : '$'})
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={batchSell}
                      onChange={(e) => setBatchSell(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleApplyBatchPricing();
                      }}
                      placeholder="0"
                      className="w-full h-[38px] px-3 rounded-lg border border-slate-200 bg-[#FAFAFA] font-mono font-black text-xs text-slate-900 outline-none hover:border-slate-300 focus:border-[#F45A0A] focus:bg-white transition-colors"
                    />
                  </div>

                  {/* Apply Button (Orange) */}
                  <div>
                    <button
                      type="button"
                      onClick={handleApplyBatchPricing}
                      className="w-full h-[38px] px-4 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
                    >
                      <IconCheck size={16} strokeWidth={2.4} />
                      <span>تطبيق الأسعار (Enter)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* ── 3. PASSENGERS TABLE (مع إمكانية التعديل المباشر والتمرير) ── */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-2xs overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-[#E5E7EB] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconUser size={15} className="text-[#F45A0A]" />
                    <span className="font-bold text-slate-800 text-[12.5px]">
                      المسافرون ({passengersList.length})
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                  <table className="w-full text-right border-collapse text-[13px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="h-10 bg-slate-100 border-b border-[#E5E7EB] text-slate-700 font-bold text-[12px]">
                        <th className="px-3.5 py-1 text-center w-12 bg-slate-100">#</th>
                        <th className="px-3.5 py-1 bg-slate-100">اسم المسافر الكامل</th>
                        <th className="px-3.5 py-1 text-center w-24 bg-slate-100">النوع</th>
                        <th className="px-3.5 py-1 bg-slate-100">رقم التذكرة الإلكترونية (E-Ticket)</th>
                        <th className="px-3.5 py-1 bg-slate-100">رقم الوثيقة / الجواز</th>
                        <th className="px-3.5 py-1 text-center w-24 bg-slate-100">الوزن</th>
                        <th className="px-3.5 py-1 text-center w-36 bg-slate-100">سعر الشراء ({currency === 'IQD' ? 'د.ع' : '$'})</th>
                        <th className="px-3.5 py-1 text-center w-36 bg-slate-100">سعر المبيع ({currency === 'IQD' ? 'د.ع' : '$'})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {passengersList.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="px-3.5 py-2 font-mono font-bold text-slate-400 text-center">{idx + 1}</td>
                          <td className="px-3.5 py-2">
                            <input
                              type="text"
                              value={p.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPassengersList((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, name: val } : item))
                                );
                              }}
                              className="w-full h-8 px-2 rounded-md border border-transparent hover:border-slate-300 focus:border-[#F45A0A] font-bold text-slate-900 text-[13px] outline-none transition-all"
                            />
                          </td>
                          <td className="px-3.5 py-2 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                                p.ticketType === 'ADULT'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : p.ticketType === 'CHILD'
                                  ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                  : 'bg-orange-50 text-orange-700 border border-orange-200'
                              }`}
                            >
                              {p.ticketType === 'ADULT' ? 'بالغ' : p.ticketType === 'CHILD' ? 'طفل' : 'رضيع'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2">
                            <input
                              type="text"
                              value={p.ticketNumber}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPassengersList((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, ticketNumber: val } : item))
                                );
                              }}
                              placeholder="—"
                              className="w-full h-8 px-2 rounded-md border border-transparent hover:border-slate-300 focus:border-[#F45A0A] font-mono font-black text-[#078B61] text-[13px] outline-none transition-all"
                            />
                          </td>
                          <td className="px-3.5 py-2">
                            <input
                              type="text"
                              value={p.documentNumber || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPassengersList((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, documentNumber: val } : item))
                                );
                              }}
                              placeholder="—"
                              className="w-full h-8 px-2 rounded-md border border-transparent hover:border-slate-300 focus:border-[#F45A0A] font-mono text-slate-700 text-[12.5px] outline-none transition-all"
                            />
                          </td>
                          <td className="px-3.5 py-2 text-center">
                            <span className="font-mono text-slate-600 text-[12px] font-bold">
                              {p.baggage || parsedResult.baggage || '—'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2 text-center">
                            <input
                              type="text"
                              dir="ltr"
                              value={p.fareBuy ? p.fareBuy.toLocaleString() : ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0;
                                setPassengersList((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, fareBuy: val } : item))
                                );
                              }}
                              placeholder="0"
                              className="w-full h-8 px-2 rounded-md border border-slate-200 hover:border-slate-300 focus:border-[#F45A0A] font-mono font-black text-center text-slate-900 text-[13px] outline-none transition-all"
                            />
                          </td>
                          <td className="px-3.5 py-2 text-center">
                            <input
                              type="text"
                              dir="ltr"
                              value={p.fareSell ? p.fareSell.toLocaleString() : ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0;
                                setPassengersList((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, fareSell: val } : item))
                                );
                              }}
                              placeholder="0"
                              className="w-full h-8 px-2 rounded-md border border-slate-200 hover:border-slate-300 focus:border-[#F45A0A] font-mono font-black text-center text-slate-900 text-[13px] outline-none transition-all"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 2. STICKY FIXED FOOTER BAR (شريط سفلي ثابت يظهر دائماً في أسفل النافذة) ── */}
        <div className="bg-white border-t border-[#E5E7EB] p-4 px-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 z-10 shrink-0">
          {/* Totals Summary */}
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي الشراء:</span>
              <span className="text-[17px] font-black font-mono text-slate-900 tabular-nums">
                {totals.totalBuy.toLocaleString()} <span className="text-[11px] font-sans font-bold text-slate-500">{currency === 'IQD' ? 'د.ع' : '$'}</span>
              </span>
            </div>

            <div className="w-[1px] h-8 bg-slate-200 hidden sm:block" />

            <div>
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي المبيعات:</span>
              <span className="text-[17px] font-black font-mono text-slate-900 tabular-nums">
                {totals.totalSell.toLocaleString()} <span className="text-[11px] font-sans font-bold text-slate-500">{currency === 'IQD' ? 'د.ع' : '$'}</span>
              </span>
            </div>

            <div className="w-[1px] h-8 bg-slate-200 hidden sm:block" />

            <div>
              <span className="text-[11px] font-bold text-slate-500 block">صافي الأرباح المتوقع:</span>
              <span className={`text-[17px] font-black font-mono tabular-nums ${totals.profit >= 0 ? 'text-[#078B61]' : 'text-[#DC2626]'}`}>
                {totals.profit >= 0 ? `+${totals.profit.toLocaleString()}` : totals.profit.toLocaleString()} <span className="text-[11px] font-sans font-bold text-slate-500">{currency === 'IQD' ? 'د.ع' : '$'}</span>
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              disabled={!parsedResult || isAnalyzing}
              onClick={handleApplyToInvoice}
              className="flex-1 sm:flex-none h-[44px] px-7 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-[13.5px] shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              <IconCheck size={18} strokeWidth={2.4} />
              <span>تجهيز وفتح الفاتورة للإدخال</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setParsedResult(null);
                setPassengersList([]);
                setSelectedFile(null);
              }}
              className="h-[44px] px-4 rounded-xl bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 font-bold text-[12.5px] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="تذكرة جديدة"
            >
              <IconRefresh size={16} />
              <span>تذكرة أخرى</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
