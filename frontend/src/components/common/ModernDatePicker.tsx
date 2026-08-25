import React, { useState } from 'react';
import { Popover, TextInput } from '@mantine/core';
import { IconCalendar, IconChevronRight, IconChevronLeft, IconX } from '@tabler/icons-react';

interface ModernDatePickerProps {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  required?: boolean;
  className?: string;
}

const MONTH_NAMES_AR = [
  'يناير (1)',
  'فبراير (2)',
  'مارس (3)',
  'أبريل (4)',
  'مايو (5)',
  'يونيو (6)',
  'يوليو (7)',
  'أغسطس (8)',
  'سبتمبر (9)',
  'أكتوبر (10)',
  'نوفمبر (11)',
  'ديسمبر (12)',
];

const DAY_NAMES_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export const ModernDatePicker: React.FC<ModernDatePickerProps> = ({
  label,
  value,
  onChange,
  placeholder = 'اختر التاريخ YYYY-MM-DD',
  required = false,
  className = '',
}) => {
  const [opened, setOpened] = useState(false);

  // Parse initial date or default to current date
  const parsedDate = value ? new Date(value) : new Date();
  const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  const [viewYear, setViewYear] = useState(validDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(validDate.getMonth());

  // Generate days in month
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const formattedMonth = String(viewMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const newDateStr = `${viewYear}-${formattedMonth}-${formattedDay}`;
    onChange(newDateStr);
    setOpened(false);
  };

  const handleSetToday = () => {
    const today = new Date();
    const formattedMonth = String(today.getMonth() + 1).padStart(2, '0');
    const formattedDay = String(today.getDate()).padStart(2, '0');
    const newDateStr = `${today.getFullYear()}-${formattedMonth}-${formattedDay}`;
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    onChange(newDateStr);
    setOpened(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  // Format readable Arabic display text
  const getDisplayValue = () => {
    if (!value) return '';
    const parts = value.split('-');
    if (parts.length === 3) {
      return `${parts[0]}-${parts[1]}-${parts[2]}`;
    }
    return value;
  };

  return (
    <div className={`space-y-1 font-['IBM_Plex_Sans_Arabic',sans-serif] ${className}`} dir="rtl">
      {label && (
        <label className="block text-[11px] font-bold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <Popover
        opened={opened}
        onChange={setOpened}
        position="bottom-start"
        withArrow
        shadow="xl"
        radius="lg"
      >
        <Popover.Target>
          <div
            onClick={() => setOpened((o) => !o)}
            className="w-full flex items-center justify-between px-3 h-9 bg-white border border-slate-300 rounded-lg cursor-pointer hover:border-orange-400 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-100 transition-all text-xs select-none"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <IconCalendar size={15} className="text-orange-600 shrink-0" />
              {value ? (
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {getDisplayValue()}
                </span>
              ) : (
                <span className="text-slate-400 text-xs">{placeholder}</span>
              )}
            </div>

            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-full transition-colors"
                title="مسح التاريخ"
              >
                <IconX size={12} />
              </button>
            )}
          </div>
        </Popover.Target>

        <Popover.Dropdown className="p-3 w-[290px] text-xs bg-white select-none border border-slate-200 shadow-2xl rounded-2xl">
          {/* Calendar Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 font-bold">
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="الشهر التالي"
            >
              <IconChevronRight size={15} />
            </button>

            <div className="flex items-center gap-1">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs font-bold text-slate-800 focus:outline-hidden"
              >
                {MONTH_NAMES_AR.map((m, idx) => (
                  <option key={idx} value={idx}>
                    {m}
                  </option>
                ))}
              </select>

              <input
                type="number"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="w-16 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-slate-800 text-center focus:outline-hidden"
              />
            </div>

            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="الشهر السابق"
            >
              <IconChevronLeft size={15} />
            </button>
          </div>

          {/* Weekday Names */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-slate-400 mb-1">
            {DAY_NAMES_AR.map((day, i) => (
              <span key={i}>{day}</span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-mono font-bold">
            {/* Empty slots for previous month */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <span key={`prev-${i}`} className="text-slate-300 py-1 text-[10px]">
                {prevMonthDays - firstDayIndex + i + 1}
              </span>
            ))}

            {/* Days of current month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const formattedMonth = String(viewMonth + 1).padStart(2, '0');
              const formattedDay = String(dayNum).padStart(2, '0');
              const currentDayStr = `${viewYear}-${formattedMonth}-${formattedDay}`;
              const isSelected = value === currentDayStr;
              const isToday =
                new Date().toISOString().split('T')[0] === currentDayStr;

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => handleSelectDay(dayNum)}
                  className={`py-1 rounded-lg transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-orange-500 text-white font-black shadow-xs'
                      : isToday
                      ? 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
                      : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Calendar Quick Actions */}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 text-[11px]">
            <button
              type="button"
              onClick={handleSetToday}
              className="text-orange-600 font-bold hover:underline cursor-pointer"
            >
              اليوم ({new Date().toISOString().split('T')[0]})
            </button>
            <button
              type="button"
              onClick={() => setOpened(false)}
              className="text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </Popover.Dropdown>
      </Popover>
    </div>
  );
};
