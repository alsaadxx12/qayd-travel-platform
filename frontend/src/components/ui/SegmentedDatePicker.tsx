import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Search,
  AlertCircle,
  X,
} from 'lucide-react';
import { useLanguageStore } from '../../store/useLanguageStore';

export interface SegmentedDatePickerProps {
  value?: Date | string | null;
  onChange?: (date: Date | null, isoString: string) => void;
  label?: React.ReactNode;
  required?: boolean;
  minDate?: Date | string;
  maxDate?: Date | string;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
  placeholder?: string;
  id?: string;
  name?: string;
  className?: string;
  clearable?: boolean;
  dropdownPosition?: 'top' | 'bottom';
}

const ARABIC_MONTHS = [
  { num: '01', name: 'يناير', alt: 'كانون الثاني' },
  { num: '02', name: 'فبراير', alt: 'شباط' },
  { num: '03', name: 'مارس', alt: 'آذار' },
  { num: '04', name: 'أبريل', alt: 'نيسان' },
  { num: '05', name: 'مايو', alt: 'أيار' },
  { num: '06', name: 'يونيو', alt: 'حزيران' },
  { num: '07', name: 'يوليو', alt: 'تموز' },
  { num: '08', name: 'أغسطس', alt: 'آب' },
  { num: '09', name: 'سبتمبر', alt: 'أيلول' },
  { num: '10', name: 'أكتوبر', alt: 'تشرين الأول' },
  { num: '11', name: 'نوفمبر', alt: 'تشرين الثاني' },
  { num: '12', name: 'ديسمبر', alt: 'كانون الأول' },
];

const ENGLISH_MONTHS = [
  { num: '01', name: 'January', alt: 'Jan' },
  { num: '02', name: 'February', alt: 'Feb' },
  { num: '03', name: 'March', alt: 'Mar' },
  { num: '04', name: 'April', alt: 'Apr' },
  { num: '05', name: 'May', alt: 'May' },
  { num: '06', name: 'June', alt: 'Jun' },
  { num: '07', name: 'July', alt: 'Jul' },
  { num: '08', name: 'August', alt: 'Aug' },
  { num: '09', name: 'September', alt: 'Sep' },
  { num: '10', name: 'October', alt: 'Oct' },
  { num: '11', name: 'November', alt: 'Nov' },
  { num: '12', name: 'December', alt: 'Dec' },
];

const WEEKDAYS_HEADER = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Convert Arabic-Indic digits (٠-٩) to Latin (0-9)
function normalizeArabicDigits(str: string): string {
  return str.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

// Days in month helper (with leap year calculations)
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export const SegmentedDatePicker: React.FC<SegmentedDatePickerProps> = ({
  value,
  onChange,
  label,
  required = false,
  minDate,
  maxDate,
  disabled = false,
  readOnly = false,
  error,
  id,
  name,
  className = '',
  clearable = true,
  dropdownPosition = 'bottom',
}) => {
  const { language } = useLanguageStore();

  // Parse incoming value into YYYY, MM, DD
  const parsedIncoming = useMemo(() => {
    if (!value) return { y: '', m: '', d: '' };
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return { y: '', m: '', d: '' };
      return {
        y: String(value.getFullYear()),
        m: String(value.getMonth() + 1).padStart(2, '0'),
        d: String(value.getDate()).padStart(2, '0'),
      };
    }
    const clean = normalizeArabicDigits(String(value).trim());
    const iso = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (iso) {
      return {
        y: iso[1],
        m: iso[2].padStart(2, '0'),
        d: iso[3].padStart(2, '0'),
      };
    }
    const dmy = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmy) {
      return {
        y: dmy[3],
        m: dmy[2].padStart(2, '0'),
        d: dmy[1].padStart(2, '0'),
      };
    }
    return { y: '', m: '', d: '' };
  }, [value]);

  const [yearStr, setYearStr] = useState<string>(parsedIncoming.y);
  const [monthStr, setMonthStr] = useState<string>(parsedIncoming.m);
  const [dayStr, setDayStr] = useState<string>(parsedIncoming.d);

  useEffect(() => {
    setYearStr(parsedIncoming.y);
    setMonthStr(parsedIncoming.m);
    setDayStr(parsedIncoming.d);
  }, [parsedIncoming]);

  // Popover State
  const [isOpen, setIsOpen] = useState(false);
  const [activeSegment, setActiveSegment] = useState<'year' | 'month' | 'day' | null>(null);
  const [view, setView] = useState<'year' | 'month' | 'day'>('year');

  const currentYear = new Date().getFullYear();
  const [navYear, setNavYear] = useState<number>(() => {
    return parsedIncoming.y ? parseInt(parsedIncoming.y, 10) : currentYear;
  });
  const [navMonth, setNavMonth] = useState<number>(() => {
    return parsedIncoming.m ? parseInt(parsedIncoming.m, 10) : new Date().getMonth() + 1;
  });

  useEffect(() => {
    if (parsedIncoming.y) setNavYear(parseInt(parsedIncoming.y, 10));
    if (parsedIncoming.m) setNavMonth(parseInt(parsedIncoming.m, 10));
  }, [parsedIncoming.y, parsedIncoming.m]);

  // Search filter inside dropdown views
  const [searchQuery, setSearchQuery] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const yearInputRef = useRef<HTMLInputElement>(null);
  const monthInputRef = useRef<HTMLInputElement>(null);
  const dayInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Outside click handler
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveSegment(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Auto-focus search input on dropdown open / view switch
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }
  }, [isOpen, view]);

  // Emit completed date
  const emitDate = useCallback(
    (y: string, m: string, d: string) => {
      if (y && m && d) {
        const yNum = parseInt(y, 10);
        const mNum = parseInt(m, 10);
        const dNum = parseInt(d, 10);
        if (yNum >= 1900 && yNum <= 2100 && mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
          const maxDays = getDaysInMonth(yNum, mNum);
          const finalDay = Math.min(dNum, maxDays);
          const dt = new Date(yNum, mNum - 1, finalDay);
          const iso = `${yNum}-${String(mNum).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
          onChange?.(dt, iso);
          return;
        }
      }
      if (!y && !m && !d) {
        onChange?.(null, '');
      }
    },
    [onChange]
  );

  // Segment Handlers
  const handleOpenYear = () => {
    if (disabled || readOnly) return;
    setActiveSegment('year');
    setView('year');
    setIsOpen(true);
    setTimeout(() => yearInputRef.current?.select(), 40);
  };

  const handleOpenMonth = () => {
    if (disabled || readOnly) return;
    setActiveSegment('month');
    setView('month');
    setIsOpen(true);
    setTimeout(() => monthInputRef.current?.select(), 40);
  };

  const handleOpenDay = () => {
    if (disabled || readOnly) return;
    setActiveSegment('day');
    setView('day');
    setIsOpen(true);
    setTimeout(() => dayInputRef.current?.select(), 40);
  };

  const handleToggleCalendarIcon = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || readOnly) return;
    if (isOpen) {
      setIsOpen(false);
      setActiveSegment(null);
    } else {
      setActiveSegment('day');
      setView('day');
      setIsOpen(true);
    }
  };

  // Keyboard typing handlers
  const handleYearInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = normalizeArabicDigits(e.target.value).replace(/\D/g, '').slice(0, 4);
    setYearStr(raw);
    if (raw.length === 4) {
      const num = parseInt(raw, 10);
      setNavYear(num);
      emitDate(raw, monthStr, dayStr);
      monthInputRef.current?.focus();
      handleOpenMonth();
    }
  };

  const handleMonthInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = normalizeArabicDigits(e.target.value).replace(/\D/g, '').slice(0, 2);
    setMonthStr(raw);
    if (raw.length === 2) {
      const num = parseInt(raw, 10);
      if (num >= 1 && num <= 12) {
        setNavMonth(num);
        emitDate(yearStr, raw, dayStr);
        dayInputRef.current?.focus();
        handleOpenDay();
      }
    }
  };

  const handleDayInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = normalizeArabicDigits(e.target.value).replace(/\D/g, '').slice(0, 2);
    setDayStr(raw);
    if (raw.length === 2) {
      const num = parseInt(raw, 10);
      if (num >= 1 && num <= 31) {
        emitDate(yearStr, monthStr, raw);
        setIsOpen(false);
        setActiveSegment(null);
      }
    }
  };

  // Dropdown selections
  const handleSelectYear = (y: number) => {
    const yStr = String(y);
    setYearStr(yStr);
    setNavYear(y);
    emitDate(yStr, monthStr, dayStr);
    setActiveSegment('month');
    setView('month');
  };

  const handleSelectMonth = (m: number) => {
    const mStr = String(m).padStart(2, '0');
    setMonthStr(mStr);
    setNavMonth(m);
    emitDate(yearStr, mStr, dayStr);
    setActiveSegment('day');
    setView('day');
  };

  const handleSelectDay = (d: number) => {
    const dStr = String(d).padStart(2, '0');
    setDayStr(dStr);
    emitDate(yearStr || String(navYear), monthStr || String(navMonth).padStart(2, '0'), dStr);
    setIsOpen(false);
    setActiveSegment(null);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setYearStr('');
    setMonthStr('');
    setDayStr('');
    onChange?.(null, '');
    setIsOpen(false);
    setActiveSegment(null);
  };

  // Years generation for Grid (2000 - 2035)
  const allYears = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear + 4; y >= 2000; y--) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  const filteredYears = useMemo(() => {
    if (!searchQuery.trim()) return allYears;
    const q = searchQuery.trim();
    return allYears.filter((y) => String(y).includes(q));
  }, [allYears, searchQuery]);

  const filteredMonths = useMemo(() => {
    const list = language === 'ar' ? ARABIC_MONTHS : ENGLISH_MONTHS;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((m) => m.name.toLowerCase().includes(q) || m.num.includes(q) || m.alt.toLowerCase().includes(q));
  }, [language, searchQuery]);

  // Calendar days grid calculations
  const daysInMonth = useMemo(() => getDaysInMonth(navYear, navMonth), [navYear, navMonth]);
  const firstDayOfMonth = useMemo(() => {
    return new Date(navYear, navMonth - 1, 1).getDay(); // 0 = Sunday
  }, [navYear, navMonth]);

  const hasValue = Boolean(yearStr || monthStr || dayStr);

  return (
    <div ref={containerRef} className={`relative inline-block w-full min-w-0 ${className}`}>
      {/* ── Strict Isolation CSS to eliminate browser native indicators, spinners & clear buttons ── */}
      <style>{`
        .custom-seg-picker input::-webkit-outer-spin-button,
        .custom-seg-picker input::-webkit-inner-spin-button,
        .custom-seg-picker input::-webkit-calendar-picker-indicator,
        .custom-seg-picker input::-webkit-search-cancel-button,
        .custom-seg-picker input::-webkit-clear-button {
          display: none !important;
          -webkit-appearance: none !important;
          margin: 0 !important;
        }
        /* Segments behave like a picker trigger: keep type-to-replace, hide caret and selection highlight */
        .custom-seg-picker input {
          caret-color: transparent !important;
        }
        .custom-seg-picker input::selection {
          background: transparent !important;
          color: inherit !important;
        }
        .custom-seg-picker input::-moz-selection {
          background: transparent !important;
          color: inherit !important;
        }
      `}</style>

      {/* Top Label */}
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-700 mb-1 select-none"
        >
          {label}
          {required && <span className="text-red-500 ms-1">*</span>}
        </label>
      )}

      {/* ── 1. MAIN DATE PICKER INPUT CONTAINER (YEAR / MONTH / DAY | × | 📅) ── */}
      <div
        dir="ltr"
        className={`custom-seg-picker w-full h-[46px] px-3.5 rounded-[11px] flex items-center justify-between transition-colors duration-150 border cursor-pointer select-none box-border overflow-hidden ${
          disabled
            ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
            : isOpen
            ? 'bg-white border-2 border-[#F45A0A]'
            : error
            ? 'bg-[#FAFAFA] border-red-500'
            : 'bg-[#FAFAFA] border-[#E5E7EB] hover:bg-white hover:border-[#D1D5DB]'
        }`}
      >
        {/* LTR Segments Area: [ YEAR / YYYY ]  /  [ MONTH / MM ]  /  [ DAY / DD ] */}
        <div className="flex items-center gap-1 shrink-0">
          
          {/* Segment 1: YEAR */}
          <div
            onClick={handleOpenYear}
            className={`w-[48px] h-[36px] rounded-[8px] flex flex-col items-center justify-between py-1 px-0.5 transition-all box-border shrink-0 ${
              activeSegment === 'year' && isOpen
                ? 'text-[#F45A0A]'
                : 'hover:bg-slate-100/70 text-[#8A9BA8]'
            }`}
          >
            <span
              className={`text-[8px] font-extrabold tracking-wider leading-none select-none text-center block ${
                activeSegment === 'year' && isOpen ? 'text-[#F45A0A]' : 'text-[#8A9BA8]'
              }`}
            >
              YEAR
            </span>
            <input
              ref={yearInputRef}
              type="text"
              inputMode="numeric"
              placeholder="YYYY"
              value={yearStr}
              onChange={handleYearInput}
              onFocus={handleOpenYear}
              disabled={disabled || readOnly}
              className={`w-full text-center bg-transparent border-none outline-none font-mono font-bold text-[13px] leading-tight cursor-pointer p-0 m-0 ${
                activeSegment === 'year' && isOpen ? 'text-[#F45A0A]' : yearStr ? 'text-slate-900' : 'text-[#8A9BA8]'
              }`}
            />
          </div>

          <span className="text-[#CBD0D8] font-light text-sm select-none px-0.5">/</span>

          {/* Segment 2: MONTH */}
          <div
            onClick={handleOpenMonth}
            className={`w-[40px] h-[36px] rounded-[8px] flex flex-col items-center justify-between py-1 px-0.5 transition-all box-border shrink-0 ${
              activeSegment === 'month' && isOpen
                ? 'text-[#F45A0A]'
                : 'hover:bg-slate-100/70 text-[#8A9BA8]'
            }`}
          >
            <span
              className={`text-[8px] font-extrabold tracking-wider leading-none select-none text-center block ${
                activeSegment === 'month' && isOpen ? 'text-[#F45A0A]' : 'text-[#8A9BA8]'
              }`}
            >
              MONTH
            </span>
            <input
              ref={monthInputRef}
              type="text"
              inputMode="numeric"
              placeholder="MM"
              value={monthStr}
              onChange={handleMonthInput}
              onFocus={handleOpenMonth}
              disabled={disabled || readOnly}
              className={`w-full text-center bg-transparent border-none outline-none font-mono font-bold text-[13px] leading-tight cursor-pointer p-0 m-0 ${
                activeSegment === 'month' && isOpen ? 'text-[#F45A0A]' : monthStr ? 'text-slate-900' : 'text-[#8A9BA8]'
              }`}
            />
          </div>

          <span className="text-[#CBD0D8] font-light text-sm select-none px-0.5">/</span>

          {/* Segment 3: DAY */}
          <div
            onClick={handleOpenDay}
            className={`w-[40px] h-[36px] rounded-[8px] flex flex-col items-center justify-between py-1 px-0.5 transition-all box-border shrink-0 ${
              activeSegment === 'day' && isOpen
                ? 'text-[#F45A0A]'
                : 'hover:bg-slate-100/70 text-[#8A9BA8]'
            }`}
          >
            <span
              className={`text-[8px] font-extrabold tracking-wider leading-none select-none text-center block ${
                activeSegment === 'day' && isOpen ? 'text-[#F45A0A]' : 'text-[#8A9BA8]'
              }`}
            >
              DAY
            </span>
            <input
              ref={dayInputRef}
              type="text"
              inputMode="numeric"
              placeholder="DD"
              value={dayStr}
              onChange={handleDayInput}
              onFocus={handleOpenDay}
              disabled={disabled || readOnly}
              className={`w-full text-center bg-transparent border-none outline-none font-mono font-bold text-[13px] leading-tight cursor-pointer p-0 m-0 ${
                activeSegment === 'day' && isOpen ? 'text-[#F45A0A]' : dayStr ? 'text-slate-900' : 'text-[#8A9BA8]'
              }`}
            />
          </div>
        </div>

        {/* ── Completely Independent Right Buttons Area: [ × Clear ] [ 📅 Calendar ] ── */}
        <div className="flex items-center justify-end gap-1.5 shrink-0 ms-auto ps-2">
          {clearable && hasValue && !disabled && !readOnly && (
            <button
              type="button"
              onClick={handleClear}
              aria-label={language === 'ar' ? 'مسح التاريخ' : 'Clear date'}
              className="w-5 h-5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title={language === 'ar' ? 'مسح التاريخ' : 'Clear date'}
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleCalendarIcon}
            disabled={disabled || readOnly}
            aria-label={language === 'ar' ? 'فتح التقويم' : 'Open calendar'}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#F45A0A] hover:bg-orange-50/70 transition-colors cursor-pointer shrink-0"
            title={language === 'ar' ? 'فتح التقويم' : 'Open calendar'}
          >
            <CalendarIcon size={16} />
          </button>
        </div>
      </div>

      {/* Inline Error */}
      {error && (
        <p className="text-[11px] font-medium text-red-600 mt-1 flex items-center gap-1">
          <AlertCircle size={12} />
          <span>{error}</span>
        </p>
      )}

      {/* ── 2. POPOVER DROPDOWN (100% MATCH TO IMAGE 5 REFERENCE) ── */}
      {isOpen && (
        <div
          dir="ltr"
          className={`absolute z-[1000] w-[320px] bg-white rounded-[20px] border border-slate-200 shadow-2xl p-4 text-slate-900 animate-dropdown-pop ${
            dropdownPosition === 'top' ? 'bottom-[56px] mb-2' : 'mt-2'
          }`}
        >
          {/* ═════════ 1. SELECT YEAR VIEW (IMAGE 5) ═════════ */}
          {view === 'year' && (
            <div className="space-y-3">
              {/* Header Title */}
              <div className="flex items-center justify-between">
                <h4 className="text-[14px] font-bold text-slate-800">Select year</h4>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search year..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-[36px] pl-9 pr-3 rounded-[12px] bg-slate-50/70 border border-slate-200 text-xs font-mono text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#F45A0A] focus:bg-white transition-colors"
                />
              </div>

              {/* 4-Column Grid of Years */}
              <div className="grid grid-cols-4 gap-2 max-h-[230px] overflow-y-auto pt-1 pr-1">
                {filteredYears.map((yr) => {
                  const isSelected = String(yr) === yearStr;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => handleSelectYear(yr)}
                      className={`h-[38px] rounded-[10px] text-[13.5px] font-mono font-medium transition-all cursor-pointer flex items-center justify-center ${
                        isSelected
                          ? 'border-2 border-[#F45A0A] text-[#F45A0A] font-bold bg-white shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                      }`}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═════════ 2. SELECT MONTH VIEW ═════════ */}
          {view === 'month' && (
            <div className="space-y-3">
              {/* Header Title */}
              <div className="flex items-center justify-between">
                <h4 className="text-[14px] font-bold text-slate-800">Select month</h4>
                <button
                  type="button"
                  onClick={() => setView('year')}
                  className="text-xs font-bold text-[#F45A0A] hover:underline cursor-pointer"
                >
                  {yearStr || navYear} ▾
                </button>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search month..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-[36px] pl-9 pr-3 rounded-[12px] bg-slate-50/70 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#F45A0A] focus:bg-white transition-colors"
                />
              </div>

              {/* 3-Column Grid of Months */}
              <div className="grid grid-cols-3 gap-2 max-h-[230px] overflow-y-auto pt-1 pr-1">
                {filteredMonths.map((m) => {
                  const mNum = parseInt(m.num, 10);
                  const isSelected = m.num === monthStr;
                  return (
                    <button
                      key={m.num}
                      type="button"
                      onClick={() => handleSelectMonth(mNum)}
                      className={`h-[42px] rounded-[10px] px-2 py-1 flex flex-col items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-2 border-[#F45A0A] text-[#F45A0A] font-bold bg-white shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-100 border border-slate-100 bg-slate-50/50'
                      }`}
                    >
                      <span className="text-xs font-bold leading-none">{m.name}</span>
                      <span className="text-[9.5px] font-mono text-slate-400 mt-0.5">{m.num}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═════════ 3. SELECT DAY VIEW ═════════ */}
          {view === 'day' && (
            <div className="space-y-2.5">
              {/* Header Title with month/year navigation */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <div className="flex items-center gap-2 font-bold text-[13px] text-slate-800">
                  <button
                    type="button"
                    onClick={() => setView('month')}
                    className="hover:text-[#F45A0A] cursor-pointer"
                  >
                    {ENGLISH_MONTHS[navMonth - 1]?.name || 'Month'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('year')}
                    className="font-mono hover:text-[#F45A0A] cursor-pointer"
                  >
                    {navYear}
                  </button>
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (navMonth === 1) {
                        setNavMonth(12);
                        setNavYear((prev) => prev - 1);
                      } else {
                        setNavMonth((prev) => prev - 1);
                      }
                    }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500 cursor-pointer"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (navMonth === 12) {
                        setNavMonth(1);
                        setNavYear((prev) => prev + 1);
                      } else {
                        setNavMonth((prev) => prev + 1);
                      }
                    }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500 cursor-pointer"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>

              {/* Weekday Row */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS_HEADER.map((wd) => (
                  <span key={wd} className="text-[10px] font-bold text-slate-400 py-0.5 select-none">
                    {wd}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-8" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dStr = String(dayNum).padStart(2, '0');
                  const isSelected =
                    String(navYear) === yearStr &&
                    String(navMonth).padStart(2, '0') === monthStr &&
                    dStr === dayStr;

                  return (
                    <button
                      key={dayNum}
                      type="button"
                      onClick={() => handleSelectDay(dayNum)}
                      className={`h-8 rounded-[8px] text-xs font-mono transition-all cursor-pointer flex items-center justify-center ${
                        isSelected
                          ? 'border-2 border-[#F45A0A] text-[#F45A0A] font-bold bg-[#FFF3E8] shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SegmentedDatePicker;
