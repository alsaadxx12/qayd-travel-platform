import React, { useState, useEffect } from 'react';
import { Popover, ActionIcon, Button, Select } from '@mantine/core';
import { IconCalendar, IconX, IconChevronRight, IconChevronLeft } from '@tabler/icons-react';

interface AccountingDatePickerProps {
  value?: string; // YYYY-MM-DD or YYYY/MM/DD
  onChange?: (date: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  minDate?: string;
  maxDate?: string;
}

const MONTH_NAMES_AR = [
  'يناير (01)',
  'فبراير (02)',
  'مارس (03)',
  'أبريل (04)',
  'مايو (05)',
  'يونيو (06)',
  'يوليو (07)',
  'أغسطس (08)',
  'سبتمبر (09)',
  'أكتوبر (10)',
  'نوفمبر (11)',
  'ديسمبر (12)',
];

const WEEKDAYS_AR = ['سبت', 'أحد', 'ثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];

export const AccountingDatePicker: React.FC<AccountingDatePickerProps> = ({
  value = '',
  onChange,
  label,
  placeholder = 'سنة/شهر/يوم',
  disabled = false,
  required = false,
  error,
}) => {
  const [opened, setOpened] = useState(false);
  const [inputValue, setInputValue] = useState(value ? value.replace(/-/g, '/') : '');
  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(7); // 0-indexed (August = 7)

  useEffect(() => {
    if (value) {
      const formatted = value.replace(/-/g, '/');
      setInputValue(formatted);
      const parts = formatted.split('/');
      if (parts.length === 3) {
        setViewYear(Number(parts[0]) || 2026);
        setViewMonth((Number(parts[1]) || 8) - 1);
      }
    }
  }, [value]);

  const handleDateSelect = (dayNum: number) => {
    const m = (viewMonth + 1).toString().padStart(2, '0');
    const d = dayNum.toString().padStart(2, '0');
    const formatted = `${viewYear}/${m}/${d}`;
    const isoDate = `${viewYear}-${m}-${d}`;

    setInputValue(formatted);
    if (onChange) onChange(isoDate);
    setOpened(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // Validate format YYYY/MM/DD or YYYY-MM-DD
    if (/^\d{4}[\/\-]\d{2}[\/\-]\d{2}$/.test(val)) {
      const iso = val.replace(/\//g, '-');
      if (onChange) onChange(iso);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInputValue('');
    if (onChange) onChange('');
  };

  // Calendar matrix calculation (Starting Saturday)
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOffset = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    // Shift Sunday=0 -> Saturday=0 mapping: Sat(6)->0, Sun(0)->1, Mon(1)->2, ...
    return (day + 1) % 7;
  };

  const totalDays = getDaysInMonth(viewYear, viewMonth);
  const firstOffset = getFirstDayOffset(viewYear, viewMonth);

  const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1 < 0 ? 11 : viewMonth - 1);

  return (
    <div className="w-full text-xs select-none">
      {label && (
        <label className="block font-bold text-slate-800 mb-1">
          {label} {required && <span className="text-rose-600">*</span>}
        </label>
      )}

      <Popover opened={opened} onChange={setOpened} position="bottom-start" shadow="md" zIndex={1000}>
        <Popover.Target>
          <div className="relative w-full">
            <input
              type="text"
              readOnly={disabled}
              placeholder={placeholder}
              value={inputValue}
              onChange={handleInputChange}
              onClick={() => !disabled && setOpened(true)}
              className={`w-full h-[32px] pr-7 pl-6 text-[11px] font-bold font-mono border rounded transition-all outline-none ${
                error
                  ? 'border-rose-500 bg-rose-50/50'
                  : 'border-slate-300 hover:border-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 bg-white'
              } ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'cursor-pointer text-slate-900'}`}
            />

            {/* Left Calendar Icon */}
            <IconCalendar
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />

            {/* Clear Button */}
            {inputValue && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
              >
                <IconX size={13} />
              </button>
            )}
          </div>
        </Popover.Target>

        <Popover.Dropdown p="xs" className="w-[300px] border-slate-300 shadow-md rounded-md bg-white space-y-2 text-xs">
          {/* Header Navigation */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear((y) => y - 1);
                } else setViewMonth((m) => m - 1);
              }}
            >
              <IconChevronRight size={14} />
            </ActionIcon>

            <div className="flex items-center gap-1 font-bold text-slate-900">
              <span>{MONTH_NAMES_AR[viewMonth]}</span>
              <span className="font-mono text-orange-600 font-extrabold">{viewYear}</span>
            </div>

            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear((y) => y + 1);
                } else setViewMonth((m) => m + 1);
              }}
            >
              <IconChevronLeft size={14} />
            </ActionIcon>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 text-center font-bold text-[10px] text-slate-500 pb-1">
            {WEEKDAYS_AR.map((wd) => (
              <div key={wd}>{wd}</div>
            ))}
          </div>

          {/* Days Grid (Starting Saturday) */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono text-xs">
            {/* Prev month offset days */}
            {Array.from({ length: firstOffset }).map((_, i) => (
              <div key={`prev_${i}`} className="py-1.5 text-slate-300 text-[11px]">
                {prevMonthDays - firstOffset + i + 1}
              </div>
            ))}

            {/* Current Month Days */}
            {Array.from({ length: totalDays }).map((_, i) => {
              const dayNum = i + 1;
              const mStr = (viewMonth + 1).toString().padStart(2, '0');
              const dStr = dayNum.toString().padStart(2, '0');
              const dateStr = `${viewYear}/${mStr}/${dStr}`;

              const isSelected = inputValue === dateStr;
              const isToday = new Date().toISOString().startsWith(`${viewYear}-${mStr}-${dStr}`);

              return (
                <button
                  key={dayNum}
                  onClick={() => handleDateSelect(dayNum)}
                  className={`h-[30px] w-full rounded flex items-center justify-center font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-orange-600 text-white shadow-2xs font-extrabold'
                      : isToday
                      ? 'border border-orange-500 text-orange-950 bg-orange-50 font-bold'
                      : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Quick Today Button */}
          <div className="pt-1.5 border-t border-slate-200 flex justify-between items-center">
            <Button
              size="xs"
              variant="subtle"
              color="orange"
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                if (onChange) onChange(today);
                setInputValue(today.replace(/-/g, '/'));
                setOpened(false);
              }}
            >
              اليوم الحالي
            </Button>

            <Button size="xs" variant="subtle" color="gray" onClick={() => setOpened(false)}>
              إغلاق
            </Button>
          </div>
        </Popover.Dropdown>
      </Popover>

      {error && <span className="text-[10px] text-rose-600 block mt-0.5">{error}</span>}
    </div>
  );
};
