import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Select } from '@mantine/core';
import {
  IconCalendar,
  IconX,
  IconChevronRight,
  IconChevronLeft,
  IconClock,
  IconCheck,
  IconSunrise,
  IconSunset,
  IconMoon,
} from '@tabler/icons-react';
import { useLanguageStore } from '../../../store/useLanguageStore';

interface AccountingDateRangePickerProps {
  startDate: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm
  endDate: string;   // YYYY-MM-DD or YYYY-MM-DDTHH:mm
  onChange: (start: string, end: string) => void;
  label?: string;
  placeholder?: string;
  withTime?: boolean;
}

const MONTH_NAMES_AR = [
  'يناير (01)', 'فبراير (02)', 'مارس (03)', 'أبريل (04)', 'مايو (05)', 'يونيو (06)',
  'يوليو (07)', 'أغسطس (08)', 'سبتمبر (09)', 'أكتوبر (10)', 'نوفمبر (11)', 'ديسمبر (12)'
];

const MONTH_NAMES_EN = [
  'January (01)', 'February (02)', 'March (03)', 'April (04)', 'May (05)', 'June (06)',
  'July (07)', 'August (08)', 'September (09)', 'October (10)', 'November (11)', 'December (12)'
];

const WEEKDAYS_AR = ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];
const WEEKDAYS_EN = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// Hours 00..23
const HOURS_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const val = i.toString().padStart(2, '0');
  return { value: val, label: val };
});

// Minutes 00..59 (steps of 5 or all)
const MINUTES_OPTIONS = [
  '00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', '59'
].map((m) => ({ value: m, label: m }));

export const AccountingDateRangePicker: React.FC<AccountingDateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  label,
  withTime = true,
}) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [opened, setOpened] = useState(false);

  // We show 2 months: Month 1 (left/start) and Month 2 (right/end)
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth()); // 0-indexed

  // Internal date strings (YYYY-MM-DD)
  const [selStart, setSelStart] = useState(() => (startDate ? startDate.split('T')[0] : ''));
  const [selEnd, setSelEnd] = useState(() => (endDate ? endDate.split('T')[0] : ''));
  
  // Custom Time Pickers
  const [startHour, setStartHour] = useState('00');
  const [startMinute, setStartMinute] = useState('00');
  const [endHour, setEndHour] = useState('23');
  const [endMinute, setEndMinute] = useState('59');

  const [hoverDate, setHoverDate] = useState<string | null>(null);

  useEffect(() => {
    if (startDate) {
      const parts = startDate.split('T');
      setSelStart(parts[0]);
      if (parts[1]) {
        const timeParts = parts[1].split(':');
        if (timeParts[0]) setStartHour(timeParts[0].padStart(2, '0'));
        if (timeParts[1]) setStartMinute(timeParts[1].substring(0, 2).padStart(2, '0'));
      }
      const d = new Date(parts[0]);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
    if (endDate) {
      const parts = endDate.split('T');
      setSelEnd(parts[0]);
      if (parts[1]) {
        const timeParts = parts[1].split(':');
        if (timeParts[0]) setEndHour(timeParts[0].padStart(2, '0'));
        if (timeParts[1]) setEndMinute(timeParts[1].substring(0, 2).padStart(2, '0'));
      }
    }
  }, [startDate, endDate]);

  const startTimeStr = `${startHour}:${startMinute}`;
  const endTimeStr = `${endHour}:${endMinute}`;

  // Second month calculations (viewMonth + 1)
  const secondMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const secondYear = viewMonth === 11 ? viewYear + 1 : viewYear;

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const formatDisplay = (d: string, time: string) => {
    if (!d) return '';
    const formatted = d.replace(/-/g, '/');
    return withTime ? `${formatted} ${time}` : formatted;
  };

  const displayText =
    selStart && selEnd
      ? `${formatDisplay(selStart, startTimeStr)}  ➔  ${formatDisplay(selEnd, endTimeStr)}`
      : (isAr ? 'اختر النطاق الزمني...' : 'Select Date Range...');

  // Calendar matrix calculation helpers
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOffset = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return (day + 1) % 7; // Saturday = 0
  };

  const handleDayClick = (year: number, month: number, dayNum: number) => {
    const mStr = (month + 1).toString().padStart(2, '0');
    const dStr = dayNum.toString().padStart(2, '0');
    const clickedIso = `${year}-${mStr}-${dStr}`;

    if (!selStart || (selStart && selEnd)) {
      setSelStart(clickedIso);
      setSelEnd('');
    } else {
      if (new Date(clickedIso) < new Date(selStart)) {
        setSelEnd(selStart);
        setSelStart(clickedIso);
      } else {
        setSelEnd(clickedIso);
      }
    }
  };

  const isDaySelected = (iso: string) => {
    if (iso === selStart) return 'START';
    if (iso === selEnd) return 'END';
    if (selStart && selEnd && iso > selStart && iso < selEnd) return 'BETWEEN';
    if (selStart && !selEnd && hoverDate && iso > selStart && iso <= hoverDate) return 'HOVER_BETWEEN';
    return 'NONE';
  };

  // Quick Preset Handlers
  const applyPreset = (presetKey: string) => {
    const now = new Date();
    const todayStr = formatDateIso(now);

    let start = todayStr;
    let end = todayStr;

    if (presetKey === 'TODAY') {
      start = todayStr;
      end = todayStr;
    } else if (presetKey === 'YESTERDAY') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start = formatDateIso(y);
      end = start;
    } else if (presetKey === 'THIS_WEEK') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = (day + 1) % 7;
      d.setDate(d.getDate() - diff);
      start = formatDateIso(d);
      end = todayStr;
    } else if (presetKey === 'THIS_MONTH') {
      start = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;
      end = todayStr;
    } else if (presetKey === 'LAST_MONTH') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lme = new Date(now.getFullYear(), now.getMonth(), 0);
      start = formatDateIso(lm);
      end = formatDateIso(lme);
    } else if (presetKey === 'LAST_30_DAYS') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      start = formatDateIso(d);
      end = todayStr;
    } else if (presetKey === 'THIS_YEAR') {
      start = `${now.getFullYear()}-01-01`;
      end = todayStr;
    }

    setSelStart(start);
    setSelEnd(end);

    const sd = new Date(start);
    if (!isNaN(sd.getTime())) {
      setViewYear(sd.getFullYear());
      setViewMonth(sd.getMonth());
    }
  };

  const handleApply = () => {
    const finalStart = selStart || new Date().toISOString().split('T')[0];
    const finalEnd = selEnd || finalStart;

    const outStart = withTime ? `${finalStart}T${startTimeStr}:00` : finalStart;
    const outEnd = withTime ? `${finalEnd}T${endTimeStr}:59` : finalEnd;

    onChange(outStart, outEnd);
    setOpened(false);
  };

  const renderMonthGrid = (year: number, month: number) => {
    const totalDays = getDaysInMonth(year, month);
    const firstOffset = getFirstDayOffset(year, month);
    const monthName = isAr ? MONTH_NAMES_AR[month] : MONTH_NAMES_EN[month];

    const days = [];
    for (let i = 0; i < firstOffset; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
    }

    for (let d = 1; d <= totalDays; d++) {
      const mStr = (month + 1).toString().padStart(2, '0');
      const dStr = d.toString().padStart(2, '0');
      const iso = `${year}-${mStr}-${dStr}`;
      const state = isDaySelected(iso);

      let dayStyle = 'bg-transparent text-slate-700 hover:bg-orange-100/60 font-semibold';
      if (state === 'START') {
        dayStyle = 'bg-[#F45A0A] text-white font-bold rounded-s-xl shadow-xs';
      } else if (state === 'END') {
        dayStyle = 'bg-[#F45A0A] text-white font-bold rounded-e-xl shadow-xs';
      } else if (state === 'BETWEEN') {
        dayStyle = 'bg-orange-100 text-[#9A3412] font-bold rounded-none';
      } else if (state === 'HOVER_BETWEEN') {
        dayStyle = 'bg-orange-50 text-orange-900 rounded-none';
      }

      if (selStart === selEnd && iso === selStart) {
        dayStyle = 'bg-[#F45A0A] text-white font-black rounded-xl shadow-xs';
      }

      days.push(
        <button
          key={`day-${d}`}
          type="button"
          onClick={() => handleDayClick(year, month, d)}
          onMouseEnter={() => setHoverDate(iso)}
          className={`h-8 w-8 text-xs flex items-center justify-center transition-all cursor-pointer select-none font-mono ${dayStyle}`}
        >
          {d}
        </button>
      );
    }

    return (
      <div className="space-y-2 p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="text-center font-extrabold text-xs text-slate-900 py-1 bg-slate-50/80 rounded-xl border border-slate-100">
          {monthName} {year}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 pb-1 border-b border-slate-100">
          {(isAr ? WEEKDAYS_AR : WEEKDAYS_EN).map((w, idx) => (
            <span key={idx}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 text-center">{days}</div>
      </div>
    );
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpened(true)}
        className="h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-[#F45A0A]/60 text-slate-800 text-xs font-bold transition-all shadow-2xs flex items-center gap-2.5 cursor-pointer select-none outline-none focus:ring-3 focus:ring-[#F45A0A]/10"
        dir="ltr"
      >
        <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200/80 flex items-center justify-center text-[#F45A0A]">
          <IconCalendar size={15} />
        </div>
        <span className="font-mono text-[11.5px] text-slate-900 tracking-tight">{displayText}</span>
      </button>

      {/* Advanced Dual-Month Modal */}
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        size="840px"
        radius="24px"
        padding="lg"
        withCloseButton={false}
        centered
        overlayProps={{ opacity: 0.45, blur: 4 }}
      >
        <div className="space-y-4 font-sans select-none" dir={direction}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#F45A0A] border border-orange-200 flex items-center justify-center font-bold shadow-xs">
                <IconCalendar size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  {isAr ? 'تحديد النطاق الزمني والتاريخ' : 'Select Date Range & Period'}
                </h3>
                <span className="text-[11px] text-slate-500 font-mono font-bold" dir="ltr">
                  {selStart || '—'} ➔ {selEnd || selStart || '—'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpened(false)}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <IconX size={16} />
            </button>
          </div>

          {/* Quick Preset Pills */}
          <div className="flex items-center gap-1.5 flex-wrap bg-slate-100/90 p-1.5 rounded-xl border border-slate-200">
            {[
              { id: 'TODAY', label: isAr ? 'اليوم' : 'Today' },
              { id: 'YESTERDAY', label: isAr ? 'أمس' : 'Yesterday' },
              { id: 'THIS_WEEK', label: isAr ? 'هذا الأسبوع' : 'This Week' },
              { id: 'THIS_MONTH', label: isAr ? 'هذا الشهر' : 'This Month' },
              { id: 'LAST_MONTH', label: isAr ? 'الشهر السابق' : 'Last Month' },
              { id: 'LAST_30_DAYS', label: isAr ? 'آخر 30 يوم' : 'Last 30 Days' },
              { id: 'THIS_YEAR', label: isAr ? 'هذا العام' : 'This Year' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className="px-3 py-1 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-white transition-all cursor-pointer shadow-2xs"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Dual Month Calendars Container */}
          <div className="relative">
            {/* Navigation Arrows */}
            <div className="flex items-center justify-between mb-2 px-1">
              <button
                type="button"
                onClick={prevMonth}
                className="h-8 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                {direction === 'rtl' ? <IconChevronRight size={15} /> : <IconChevronLeft size={15} />}
                <span>{isAr ? 'الشهر السابق' : 'Previous Month'}</span>
              </button>

              <button
                type="button"
                onClick={nextMonth}
                className="h-8 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <span>{isAr ? 'الشهر التالي' : 'Next Month'}</span>
                {direction === 'rtl' ? <IconChevronLeft size={15} /> : <IconChevronRight size={15} />}
              </button>
            </div>

            {/* 2 Months Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderMonthGrid(viewYear, viewMonth)}
              {renderMonthGrid(secondYear, secondMonth)}
            </div>
          </div>

          {/* ── ADVANCED CUSTOM TIME PICKER SECTION (NO BROWSER WIDGET) ── */}
          {withTime && (
            <div className="p-3.5 bg-gradient-to-r from-slate-50 to-orange-50/30 border border-slate-200 rounded-2xl space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Time Picker Controls (Start & End) */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-slate-700 font-extrabold">
                    <IconClock size={16} className="text-[#F45A0A]" />
                    <span>{isAr ? 'النطاق الزمني:' : 'Time Interval:'}</span>
                  </div>

                  {/* Start Time Box */}
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs font-mono" dir="ltr">
                    <span className="text-[10px] font-bold text-slate-400 ps-1.5 pe-1 font-sans">{isAr ? 'من' : 'From'}</span>
                    <Select
                      size="xs"
                      data={HOURS_OPTIONS}
                      value={startHour}
                      onChange={(v) => setStartHour(v || '00')}
                      className="w-[54px]"
                      styles={{ input: { height: 28, fontSize: 12, fontWeight: 800, paddingInline: 6, textAlign: 'center' } }}
                    />
                    <span className="font-bold text-slate-400">:</span>
                    <Select
                      size="xs"
                      data={MINUTES_OPTIONS}
                      value={startMinute}
                      onChange={(v) => setStartMinute(v || '00')}
                      className="w-[54px]"
                      styles={{ input: { height: 28, fontSize: 12, fontWeight: 800, paddingInline: 6, textAlign: 'center' } }}
                    />
                  </div>

                  <span className="text-slate-400 font-bold">➔</span>

                  {/* End Time Box */}
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs font-mono" dir="ltr">
                    <span className="text-[10px] font-bold text-slate-400 ps-1.5 pe-1 font-sans">{isAr ? 'إلى' : 'To'}</span>
                    <Select
                      size="xs"
                      data={HOURS_OPTIONS}
                      value={endHour}
                      onChange={(v) => setEndHour(v || '23')}
                      className="w-[54px]"
                      styles={{ input: { height: 28, fontSize: 12, fontWeight: 800, paddingInline: 6, textAlign: 'center' } }}
                    />
                    <span className="font-bold text-slate-400">:</span>
                    <Select
                      size="xs"
                      data={MINUTES_OPTIONS}
                      value={endMinute}
                      onChange={(v) => setEndMinute(v || '59')}
                      className="w-[54px]"
                      styles={{ input: { height: 28, fontSize: 12, fontWeight: 800, paddingInline: 6, textAlign: 'center' } }}
                    />
                  </div>
                </div>

                {/* Quick Time Preset Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setStartHour('00');
                      setStartMinute('00');
                      setEndHour('23');
                      setEndMinute('59');
                    }}
                    className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                      startHour === '00' && startMinute === '00' && endHour === '23' && endMinute === '59'
                        ? 'bg-[#F45A0A] text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
                    }`}
                  >
                    <IconMoon size={13} />
                    <span>{isAr ? 'يوم كامل (00:00 - 23:59)' : 'Full Day'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStartHour('08');
                      setStartMinute('00');
                      setEndHour('17');
                      setEndMinute('00');
                    }}
                    className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                      startHour === '08' && startMinute === '00' && endHour === '17' && endMinute === '00'
                        ? 'bg-[#F45A0A] text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
                    }`}
                  >
                    <IconSunrise size={13} />
                    <span>{isAr ? 'ساعات العمل (08:00 - 17:00)' : 'Business Hours'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="font-mono text-xs font-bold text-slate-700 truncate flex items-center gap-1.5" dir="ltr">
              <span className="bg-slate-100 px-2 py-1 rounded-md">
                {selStart ? `${selStart} ${withTime ? startTimeStr : ''}` : '—'}
              </span>
              <span>➔</span>
              <span className="bg-slate-100 px-2 py-1 rounded-md">
                {selEnd ? `${selEnd} ${withTime ? endTimeStr : ''}` : '—'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpened(false)}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="h-10 px-6 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer hover:shadow-md active:scale-98"
              >
                <IconCheck size={15} />
                <span>{isAr ? 'تطبيق النطاق المحدد' : 'Apply Date Range'}</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

function formatDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default AccountingDateRangePicker;
