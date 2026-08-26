import React, { useState } from 'react';
import {
  Select,
  Tooltip,
  ActionIcon,
  FileButton,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  User,
  Trash2,
  Copy,
  FileText,
  Upload,
} from 'lucide-react';
import { FormattedNumberInput } from '../common/FormattedNumberInput';
import { PassengerLine } from './TicketPassengersTable';
import { showSuccessNotification } from '../../utils/notifications';

interface PassengerCardItemProps {
  passenger: PassengerLine;
  index: number;
  currency: string;
  globalPnr?: string;
  onChangeField: (field: keyof PassengerLine, value: any) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  error?: string;
}

export const PassengerCardItem: React.FC<PassengerCardItemProps> = ({
  passenger,
  index,
  currency,
  globalPnr = '',
  onChangeField,
  onDuplicate,
  onDelete,
  error,
}) => {
  const [passportFileName, setPassportFileName] = useState<string | null>(null);

  const totalBuy = (passenger.fareBuy || 0) + (passenger.tax1 || 0) + (passenger.tax2 || 0) + (passenger.charge || 0);
  const totalSell = (passenger.fareSell || 0) + (passenger.tax1 || 0) + (passenger.tax2 || 0) + (passenger.charge || 0);
  const profit = totalSell - totalBuy;

  const formatAmount = (val: number) => {
    return `${val.toLocaleString()} IQD`;
  };

  const handleUploadPassport = (file: File | null) => {
    if (!file) return;
    setPassportFileName(file.name);
    showSuccessNotification('تم إرفاق جواز السفر', `تم حفظ ملف ${file.name} للمسافر`);
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-2xs font-sans">
      {/* ── CARD HEADER (Always Open & Clear) ── */}
      <div className="px-5 py-3.5 bg-slate-50/80 border-b border-[#E5E7EB] flex items-center justify-between gap-3 select-none">
        {/* Right side: Index in circle, Name + Badge, Ticket number */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-full bg-[#FFF3E8] text-[#F45A0A] font-bold text-xs flex items-center justify-center shrink-0 border border-orange-200">
            {index + 1}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-900 truncate">
                {passenger.name.trim() || `بيانات المسافر #${index + 1}`}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-white text-slate-700 border border-slate-200">
                {passenger.ticketType === 'ADULT' ? 'بالغ' : passenger.ticketType === 'CHILD' ? 'طفل' : 'رضيع'}
              </span>
            </div>

            {passenger.ticketNumber ? (
              <span className="text-[11.5px] text-slate-500 font-mono block mt-0.5" dir="ltr">
                TKT: {passenger.ticketNumber}
              </span>
            ) : null}
          </div>
        </div>

        {/* Left side: Price, Profit, Actions (Copy & Delete) */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-left hidden sm:block">
            <span className="text-[11.5px] text-slate-500 block font-normal">سعر البيع</span>
            <span className="font-mono font-bold text-xs text-slate-900" dir="ltr">
              {formatAmount(totalSell)}
            </span>
          </div>

          <div className="text-left hidden md:block">
            <span className="text-[11.5px] text-slate-500 block font-normal">صافي الربح</span>
            <span
              className={`font-mono font-bold text-xs ${
                profit > 0 ? 'text-[#078B61]' : profit < 0 ? 'text-red-600' : 'text-slate-700'
              }`}
              dir="ltr"
            >
              {profit >= 0 ? `+${formatAmount(profit)}` : formatAmount(profit)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip label="تكرار المسافر" position="top" withArrow>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                radius="md"
                onClick={onDuplicate}
                className="text-slate-500 hover:text-slate-900 h-8 w-8"
              >
                <Copy size={15} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="حذف المسافر" position="top" withArrow>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="red"
                radius="md"
                onClick={onDelete}
                className="text-slate-400 hover:text-red-600 h-8 w-8"
              >
                <Trash2 size={15} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* ── CARD BODY (Always Open & Directly Visible) ── */}
      <div className="p-5 space-y-4 font-sans text-xs bg-white">
        {/* Row 1: Name, Type, Ticket Number, PNR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          <div>
            <label className="block text-[12.5px] font-medium text-slate-600 mb-[7px]">
              اسم المسافر الثلاثي *
            </label>
            <input
              type="text"
              value={passenger.name}
              onChange={(e) => onChangeField('name', e.target.value)}
              placeholder="كما في جواز السفر (LATIN / ARABIC)..."
              className={`w-full h-[46px] px-3.5 rounded-[9px] border text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-[#A0A7B2] ${
                error
                  ? 'border-red-500 bg-red-50/20 focus:border-red-600'
                  : 'border-[#E2E6EA] bg-white hover:border-slate-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20'
              }`}
            />
            {error && <span className="text-[11px] font-medium text-red-600 block mt-1">{error}</span>}
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-slate-600 mb-[7px]">
              نوع المسافر
            </label>
            <Select
              value={passenger.ticketType}
              onChange={(val) => onChangeField('ticketType', val || 'ADULT')}
              data={[
                { value: 'ADULT', label: 'بالغ (Adult)' },
                { value: 'CHILD', label: 'طفل (Child)' },
                { value: 'INFANT', label: 'رضيع (Infant)' },
              ]}
              size="xs"
              radius="md"
              styles={{
                input: {
                  height: 46,
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 9,
                  borderColor: '#E2E6EA',
                },
              }}
            />
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-slate-600 mb-[7px]">
              رقم التذكرة الإلكترونية
            </label>
            <input
              type="text"
              dir="ltr"
              value={passenger.ticketNumber}
              onChange={(e) => onChangeField('ticketNumber', e.target.value)}
              placeholder="رقم التذكرة"
              className="w-full h-[46px] px-3.5 rounded-[9px] border border-[#E2E6EA] text-xs font-mono font-medium text-slate-900 outline-none hover:border-slate-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 placeholder:text-[#A0A7B2]"
            />
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-slate-600 mb-[7px]">
              رمز الحجز PNR
            </label>
            <input
              type="text"
              dir="ltr"
              value={passenger.pnr || ''}
              onChange={(e) => onChangeField('pnr', e.target.value.toUpperCase())}
              placeholder={globalPnr || 'PNR'}
              className="w-full h-[46px] px-3.5 rounded-[9px] border border-[#E2E6EA] text-xs font-mono font-semibold text-slate-900 uppercase outline-none hover:border-slate-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 placeholder:text-[#A0A7B2]"
            />
          </div>
        </div>

        {/* Row 2: Document / Passport, Nationality, Birthdate, Expiry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          <div>
            <label className="block text-[12.5px] font-medium text-slate-600 mb-[7px]">
              رقم الجواز / الوثيقة
            </label>
            <input
              type="text"
              dir="ltr"
              value={passenger.documentNumber || ''}
              onChange={(e) => onChangeField('documentNumber', e.target.value)}
              placeholder="A12345678"
              className="w-full h-[46px] px-3.5 rounded-[9px] border border-[#E2E6EA] text-xs font-mono font-medium text-slate-900 outline-none hover:border-slate-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 placeholder:text-[#A0A7B2]"
            />
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-slate-600 mb-[7px]">
              الجنسية
            </label>
            <input
              type="text"
              placeholder="عراقي / Iraqi"
              className="w-full h-[46px] px-3.5 rounded-[9px] border border-[#E2E6EA] text-xs font-medium text-slate-900 outline-none hover:border-slate-300 focus:border-orange-500 placeholder:text-[#A0A7B2]"
            />
          </div>

          <div>
            <DatePickerInput
              label={<span className="text-[12.5px] font-medium text-slate-600">تاريخ الميلاد</span>}
              placeholder="DD/MM/YYYY"
              valueFormat="DD/MM/YYYY"
              size="xs"
              radius="md"
              styles={{
                input: {
                  height: 46,
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 9,
                  borderColor: '#E2E6EA',
                },
              }}
            />
          </div>

          <div>
            <DatePickerInput
              label={<span className="text-[12.5px] font-medium text-slate-600">تاريخ انتهاء الجواز</span>}
              placeholder="DD/MM/YYYY"
              valueFormat="DD/MM/YYYY"
              size="xs"
              radius="md"
              styles={{
                input: {
                  height: 46,
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 9,
                  borderColor: '#E2E6EA',
                },
              }}
            />
          </div>
        </div>

        {/* Row 3: Pricing (Fare Buy, Taxes, Charge, Fare Sell) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 p-3.5 bg-slate-50/60 rounded-xl border border-slate-100">
          <div>
            <label className="block text-[12.5px] font-medium text-slate-600 mb-[7px]">
              سعر الشراء الأساسي
            </label>
            <FormattedNumberInput
              value={passenger.fareBuy ?? 0}
              onChange={(v) => onChangeField('fareBuy', Number(v) || 0)}
              size="xs"
              placeholder="0"
              className="w-full font-mono text-left font-semibold"
              styles={{
                input: {
                  height: 46,
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 9,
                  borderColor: '#E2E6EA',
                },
              }}
            />
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-slate-600 mb-[7px]">
              الضرائب والرسوم
            </label>
            <FormattedNumberInput
              value={(passenger.tax1 || 0) + (passenger.tax2 || 0)}
              onChange={(v) => onChangeField('tax1', Number(v) || 0)}
              size="xs"
              placeholder="0"
              className="w-full font-mono text-left font-semibold"
              styles={{
                input: {
                  height: 46,
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 9,
                  borderColor: '#E2E6EA',
                },
              }}
            />
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-slate-600 mb-[7px]">
              العمولة والخدمات
            </label>
            <FormattedNumberInput
              value={passenger.charge || 0}
              onChange={(v) => onChangeField('charge', Number(v) || 0)}
              size="xs"
              placeholder="0"
              className="w-full font-mono text-left font-semibold"
              styles={{
                input: {
                  height: 46,
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 9,
                  borderColor: '#E2E6EA',
                },
              }}
            />
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-slate-600 mb-[7px]">
              سعر البيع النهائي *
            </label>
            <FormattedNumberInput
              value={passenger.fareSell ?? 0}
              onChange={(v) => onChangeField('fareSell', Number(v) || 0)}
              size="xs"
              placeholder="0"
              className="w-full font-mono text-left font-semibold"
              styles={{
                input: {
                  height: 46,
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 9,
                  borderColor: '#E2E6EA',
                },
              }}
            />
          </div>
        </div>

        {/* Row 4: Passport Upload Compact Bar */}
        <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <FileText size={16} />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-800 block">حمّل جواز السفر</span>
              <span className="text-[11.5px] text-slate-500 block">
                {passportFileName ? `المرفق الحالي: ${passportFileName}` : 'إرفاق صورة ضوئية أو ملف PDF لجواز المسافر'}
              </span>
            </div>
          </div>

          <FileButton accept="image/*,application/pdf" onChange={handleUploadPassport}>
            {(props) => (
              <button
                {...props}
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Upload size={14} />
                <span>{passportFileName ? 'تغيير الملف' : 'رفع الجواز'}</span>
              </button>
            )}
          </FileButton>
        </div>
      </div>
    </div>
  );
};

export default PassengerCardItem;
