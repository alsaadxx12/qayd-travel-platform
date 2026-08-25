import React, { useState } from 'react';
import {
  Modal,
  Button,
  Paper,
  Badge,
  Text,
  FileButton,
  ThemeIcon,
  Table,
  Loader,
} from '@mantine/core';
import {
  IconUpload,
  IconCheck,
  IconSparkles,
  IconCalendar,
  IconPlane,
  IconMapPin,
  IconCpu,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';

export interface ParsedPassenger {
  name: string;
  ticketType: 'ADULT' | 'CHILD' | 'INFANT';
  ticketNumber: string;
  documentNumber?: string;
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
  aiEngineUsed?: string;
}

interface SmartTicketImportModalProps {
  opened: boolean;
  onClose: () => void;
  onImport: (data: ParsedTicketData) => void;
}

/* ─── Client-side PDF Text Reader using PDFjs ─── */
async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Load pdfjsLib from CDN dynamically if not available on window
    if (!(window as any).pdfjsLib) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load PDF parser'));
        document.head.appendChild(script);
      });
      if ((window as any).pdfjsLib) {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
    }

    if ((window as any).pdfjsLib) {
      const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }
      if (fullText.trim().length > 10) {
        return fullText;
      }
    }
  } catch (err) {
    console.warn('PDFjs extraction warning:', err);
  }

  // Fallback to text reading if file is text/HTML/raw string
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.readAsText(file);
  });
}

export const SmartTicketImportModal: React.FC<SmartTicketImportModalProps> = ({
  opened,
  onClose,
  onImport,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedTicketData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  /* ─── Send file directly to Backend AI API ─── */
  const handleFileUpload = async (file: File | null) => {
    if (!file) return;
    setSelectedFile(file);
    setParsedResult(null);
    setAiError(null);
    setIsAnalyzing(true);

    try {
      // Extract text from PDF for sending alongside the file
      const text = await extractTextFromPdf(file);

      // Send to Backend AI Parser (OpenAI GPT-4o)
      const formData = new FormData();
      formData.append('ticketFile', file);
      formData.append('textContent', text);

      const token = localStorage.getItem('token');
      const res = await fetch('/api/smart-parser/parse-ticket', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (res.ok) {
        const apiResult = await res.json();
        if (apiResult) {
          // Ensure passengers have default financial fields
          if (apiResult.passengers) {
            apiResult.passengers = apiResult.passengers.map((p: any) => ({
              ...p,
              fareBuy: p.fareBuy ?? 0,
              fareSell: p.fareSell ?? 0,
              tax1: p.tax1 ?? 0,
              tax2: p.tax2 ?? 0,
              charge: p.charge ?? 0,
            }));
          }
          setParsedResult(apiResult);
        } else {
          setAiError('لم يتمكن الذكاء الاصطناعي من استخراج البيانات من هذا الملف. تأكد من أن الملف يحتوي على تذكرة طيران صالحة.');
        }
      } else {
        const errBody = await res.text();
        console.error('AI Parser API Error:', res.status, errBody);
        if (res.status === 401) {
          setAiError('خطأ في المصادقة. يرجى تسجيل الدخول مرة أخرى.');
        } else {
          setAiError('فشل الاتصال بمحرك الذكاء الاصطناعي. تأكد من أن مفتاح OpenAI API صالح وفيه رصيد كافٍ.');
        }
      }
    } catch (err) {
      console.error('AI Parser connection error:', err);
      setAiError('تعذر الاتصال بالسيرفر. تأكد من أن الخادم يعمل بشكل صحيح.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (!parsedResult) return;
    onImport(parsedResult);
    showSuccessNotification(
      'تم الاستيراد الذكي بنجاح',
      `تم استخراج ${parsedResult.passengers?.length || 0} مسافرين والرمز (${parsedResult.pnr}) وتطبيقها على المبيعات.`
    );
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs">
          <ThemeIcon color="emerald" variant="light" size="sm" radius="xs">
            <IconCpu size={14} className="text-emerald-700" />
          </ThemeIcon>
          <span>الاستيراد والتحليل الذكي للتذاكر (AI Ticket Parser)</span>
        </div>
      }
      size="1100px"
      centered
      dir="rtl"
      radius="xs"
      styles={{
        header: { backgroundColor: '#ffffff', borderBottom: '1px solid #cbd5e1', padding: '12px 16px' },
        body: { padding: '16px', backgroundColor: '#f8fafc' },
      }}
    >
      <div className="space-y-3">
        {/* Sleek Minimalist Inline Dropzone Bar */}
        <Paper
          p="sm"
          radius="xs"
          withBorder
          className="bg-white border border-dashed border-emerald-400 hover:border-emerald-600 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ThemeIcon color="emerald" size="md" radius="xs" variant="light">
                <IconUpload size={18} className="text-emerald-700" />
              </ThemeIcon>
              <div>
                <Text size="xs" fw={800} className="text-slate-900">
                  إرفاق ملف التذكرة (PDF / صورة)
                </Text>
                <Text size="10px" className="text-slate-500">
                  اسحب الملف هنا أو انقر لاختيار التذكرة
                </Text>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedFile && (
                <Badge color="emerald" variant="outline" size="sm" radius="xs" className="font-mono">
                  📄 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </Badge>
              )}
              <FileButton onChange={handleFileUpload} accept="application/pdf,image/*,.txt,.doc,.docx">
                {(props) => (
                  <Button {...props} size="xs" color="emerald" radius="xs" leftSection={<IconUpload size={13} />} className="font-bold px-4">
                    اختيار التذكرة
                  </Button>
                )}
              </FileButton>
            </div>
          </div>
        </Paper>

        {/* Loading State */}
        {isAnalyzing && (
          <Paper p="md" radius="xs" withBorder className="bg-white border-slate-300 flex flex-col items-center gap-3 py-8">
            <Loader color="emerald" size="md" type="bars" />
            <Text size="sm" fw={700} className="text-slate-700">
              جاري تحليل التذكرة بواسطة الذكاء الاصطناعي...
            </Text>
            <Text size="xs" className="text-slate-500">
              يتم إرسال الملف إلى محرك GPT-4o لاستخراج جميع البيانات
            </Text>
          </Paper>
        )}

        {/* AI Error State */}
        {aiError && !isAnalyzing && (
          <Paper p="md" radius="xs" withBorder className="bg-red-50 border-red-300">
            <div className="flex items-start gap-3">
              <ThemeIcon color="red" size="lg" radius="xs" variant="light">
                <IconAlertTriangle size={20} />
              </ThemeIcon>
              <div className="space-y-1">
                <Text size="sm" fw={800} className="text-red-800">
                  فشل تحليل التذكرة
                </Text>
                <Text size="xs" className="text-red-700">
                  {aiError}
                </Text>
                <Text size="xs" className="text-red-600 mt-2">
                  💡 تأكد من إضافة رصيد في حساب OpenAI عبر: platform.openai.com/settings/organization/billing
                </Text>
              </div>
            </div>
          </Paper>
        )}

        {/* Structured Results Card */}
        {parsedResult && !isAnalyzing && (
          <div className="space-y-3 animate-fade-in">
            {/* Header Status Bar */}
            <Paper p="xs" radius="xs" withBorder className="bg-white border-slate-300 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <IconSparkles size={14} className="text-emerald-600" />
                <span className="font-bold text-slate-800 text-xs">البيانات المستخرجة بنجاح:</span>
              </div>
              <div className="flex items-center gap-2">
                {parsedResult.bookingRef && (
                  <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-xs border border-slate-200">
                    مرجع: {parsedResult.bookingRef}
                  </span>
                )}
                {parsedResult.pnr && (
                  <Badge color="emerald" size="md" radius="xs" variant="filled" className="font-mono font-bold">
                    PNR: {parsedResult.pnr}
                  </Badge>
                )}
                {parsedResult.aiEngineUsed && (
                  <Badge color="blue" size="xs" radius="xs" variant="light" className="font-mono">
                    🤖 {parsedResult.aiEngineUsed}
                  </Badge>
                )}
              </div>
            </Paper>

            {/* Sharp Grid Layout for Ticket Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <Paper p="xs" radius="xs" withBorder className="bg-white border-slate-300 space-y-1">
                <div className="flex items-center gap-1 text-slate-500 text-[10px] font-bold">
                  <IconPlane size={12} className="text-emerald-600" />
                  <span>شركة الطيران</span>
                </div>
                <div className="font-bold text-slate-900 text-xs">{parsedResult.airline || 'غير محدد'}</div>
              </Paper>

              <Paper p="xs" radius="xs" withBorder className="bg-white border-slate-300 space-y-1">
                <div className="flex items-center gap-1 text-slate-500 text-[10px] font-bold">
                  <IconMapPin size={12} className="text-emerald-600" />
                  <span>خط الرحلة والمسار</span>
                </div>
                <div className="font-bold text-slate-900 text-xs">
                  {parsedResult.routeFrom && parsedResult.routeTo 
                    ? parsedResult.tripType === 'ROUND_TRIP'
                      ? `${parsedResult.routeFrom} ➔ ${parsedResult.routeTo} ➔ ${parsedResult.routeFrom} (ذهاب وعودة)`
                      : `${parsedResult.routeFrom} ➔ ${parsedResult.routeTo} (ذهاب فقط)`
                    : 'غير محدد'}
                </div>
              </Paper>

              <Paper p="xs" radius="xs" withBorder className="bg-white border-slate-300 space-y-1">
                <div className="flex items-center gap-1 text-slate-500 text-[10px] font-bold">
                  <IconCalendar size={12} className="text-purple-600" />
                  <span>تاريخ الإصدار</span>
                </div>
                <div className="font-mono font-bold text-slate-900 text-xs">{parsedResult.issueDate || 'غير محدد'}</div>
              </Paper>

              <Paper p="xs" radius="xs" withBorder className="bg-white border-slate-300 space-y-1">
                <div className="flex items-center gap-1 text-slate-500 text-[10px] font-bold">
                  <IconCalendar size={12} className="text-emerald-600" />
                  <span>تاريخ السفر (الذهاب)</span>
                </div>
                <div className="font-mono font-bold text-slate-900 text-xs">{parsedResult.travelDate || 'غير محدد'}</div>
              </Paper>
            </div>

            {/* Sharp Passenger Table */}
            {parsedResult.passengers && parsedResult.passengers.length > 0 && (
              <Paper p="xs" radius="xs" withBorder className="bg-slate-300 space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="font-bold text-slate-800 text-xs">قائمة المسافرين ({parsedResult.passengers.length}):</span>
                </div>
                <div className="border border-slate-300 rounded-xs overflow-x-auto">
                  <Table verticalSpacing="xs">
                    <Table.Thead className="bg-slate-100">
                      <Table.Tr>
                        <Table.Th className="text-center py-1.5 w-10">#</Table.Th>
                        <Table.Th className="text-right py-1.5">اسم المسافر الكامل</Table.Th>
                        <Table.Th className="text-center py-1.5 w-24">النوع</Table.Th>
                        <Table.Th className="text-right py-1.5 w-36">رقم التذكرة الإلكترونية</Table.Th>
                        <Table.Th className="text-right py-1.5 w-36">رقم الوثيقة / الجواز</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {parsedResult.passengers.map((p, idx) => (
                        <Table.Tr key={idx} className="hover:bg-slate-50">
                          <Table.Td className="font-bold text-slate-500 text-center">{idx + 1}</Table.Td>
                          <Table.Td className="font-bold text-slate-900 text-xs">{p.name}</Table.Td>
                          <Table.Td className="text-center">
                            <Badge size="xs" radius="xs" color={p.ticketType === 'ADULT' ? 'blue' : p.ticketType === 'CHILD' ? 'teal' : 'orange'}>
                              {p.ticketType === 'ADULT' ? 'بالغ' : p.ticketType === 'CHILD' ? 'طفل' : 'رضيع'}
                            </Badge>
                          </Table.Td>
                          <Table.Td className="font-mono font-bold text-emerald-800 text-xs">{p.ticketNumber || '-'}</Table.Td>
                          <Table.Td className="font-mono text-slate-600 text-xs">{p.documentNumber || '-'}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              </Paper>
            )}

            <Button
              fullWidth
              size="xs"
              color="emerald"
              radius="xs"
              leftSection={<IconCheck size={14} />}
              onClick={handleApply}
              className="font-bold py-2"
            >
              تطبيق واستيراد كافة البيانات للفاتورة
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
