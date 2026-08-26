import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { useLanguageStore } from '../../store/useLanguageStore';

export interface SegmentedTimePickerProps {
  value?: Date | null;
  onChange?: (date: Date) => void;
  label?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
  id?: string;
  className?: string;
}

export const SegmentedTimePicker: React.FC<SegmentedTimePickerProps> = ({
  value,
  onChange,
  label,
  required = false,
  disabled = false,
  readOnly = false,
  error,
  id,
  className = '',
}) => {
  const { language } = useLanguageStore();
  const isAr = language === 'ar';

  // Parse incoming value into HH, MM
  const parsedIncoming = useMemo(() => {
    if (!value || !(value instanceof Date) || isNaN(value.getTime())) {
      const now = new Date();
      return {
        h: String(now.getHours()).padStart(2, '0'),
        m: String(now.getMinutes()).padStart(2, '0'),
      };
    }
    return {
      h: String(value.getHours()).padStart(2, '0'),
      m: String(value.getMinutes()).padStart(2, '0'),
    };
  }, [value]);

  const [hourStr, setHourStr] = useState<string>(parsedIncoming.h);
  const [minuteStr, setMinuteStr] = useState<string>(parsedIncoming.m);
  const [activeSegment, setActiveSegment] = useState<'hour' | 'minute' | null>(null);

  const hourInputRef = useRef<HTMLInputElement>(null);
  const minuteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHourStr(parsedIncoming.h);
    setMinuteStr(parsedIncoming.m);
  }, [parsedIncoming]);

  // Emit time change
  const emitTime = useCallback(
    (h: string, m: string) => {
      const hNum = parseInt(h, 10);
      const mNum = parseInt(m, 10);
      if (isNaN(hNum) || isNaN(mNum)) return;
      if (hNum < 0 || hNum > 23 || mNum < 0 || mNum > 59) return;

      const base = value && value instanceof Date && !isNaN(value.getTime()) ? new Date(value) : new Date();
      base.setHours(hNum, mNum, 0, 0);
      onChange?.(base);
    },
    [value, onChange]
  );

  // Keyboard typing handlers
  const handleHourInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setHourStr(raw);
    if (raw.length === 2) {
      const num = parseInt(raw, 10);
      if (num >= 0 && num <= 23) {
        emitTime(raw, minuteStr);
        minuteInputRef.current?.focus();
        setActiveSegment('minute');
      }
    }
  };

  const handleMinuteInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setMinuteStr(raw);
    if (raw.length === 2) {
      const num = parseInt(raw, 10);
      if (num >= 0 && num <= 59) {
        emitTime(hourStr, raw);
        minuteInputRef.current?.blur();
        setActiveSegment(null);
      }
    }
  };

  const handleHourBlur = () => {
    if (hourStr.length === 1) {
      const padded = hourStr.padStart(2, '0');
      setHourStr(padded);
      emitTime(padded, minuteStr);
    }
    if (activeSegment === 'hour') setActiveSegment(null);
  };

  const handleMinuteBlur = () => {
    if (minuteStr.length === 1) {
      const padded = minuteStr.padStart(2, '0');
      setMinuteStr(padded);
      emitTime(hourStr, padded);
    }
    if (activeSegment === 'minute') setActiveSegment(null);
  };

  const handleSetNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || readOnly) return;
    const now = new Date();
    const hStr = String(now.getHours()).padStart(2, '0');
    const mStr = String(now.getMinutes()).padStart(2, '0');
    setHourStr(hStr);
    setMinuteStr(mStr);
    emitTime(hStr, mStr);
  };

  // AM/PM display helper
  const getTimePeriod = (h: number) => {
    if (h < 6) return { label: isAr ? 'فجر' : 'Night', color: 'text-indigo-500' };
    if (h < 12) return { label: isAr ? 'صباحاً' : 'AM', color: 'text-amber-600' };
    if (h < 18) return { label: isAr ? 'مساءً' : 'PM', color: 'text-orange-600' };
    return { label: isAr ? 'مساءً' : 'PM', color: 'text-violet-600' };
  };

  const hourNum = parseInt(hourStr, 10) || 0;
  const period = getTimePeriod(hourNum);

  return (
    <div className={`relative inline-block w-full ${className}`}>
      {/* ── Strict Isolation CSS ── */}
      <style>{`
        .custom-time-picker input::-webkit-outer-spin-button,
        .custom-time-picker input::-webkit-inner-spin-button {
          display: none !important;
          -webkit-appearance: none !important;
          margin: 0 !important;
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

      {/* ── MAIN TIME INPUT ── */}
      <div
        dir="ltr"
        className={`custom-time-picker w-full h-[48px] px-3 rounded-[14px] flex items-center justify-between transition-all bg-white border cursor-text select-none box-border overflow-hidden ${
          disabled
            ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
            : activeSegment
            ? 'border-[#F45A0A] ring-2 ring-[#F45A0A]/10'
            : error
            ? 'border-red-500'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {/* Segments: [ HH ] : [ MM ] + Period */}
        <div className="flex items-center gap-0.5 shrink-0">

          {/* HOUR */}
          <div
            onClick={() => {
              if (disabled || readOnly) return;
              hourInputRef.current?.focus();
              hourInputRef.current?.select();
              setActiveSegment('hour');
            }}
            className={`w-[38px] h-[36px] rounded-[8px] flex flex-col items-center justify-between py-1 px-0.5 transition-all box-border shrink-0 cursor-text ${
              activeSegment === 'hour'
                ? 'bg-[#FFF3E8]'
                : 'hover:bg-slate-50'
            }`}
          >
            <span
              className={`text-[7px] font-extrabold tracking-wider leading-none select-none text-center block ${
                activeSegment === 'hour' ? 'text-[#F45A0A]' : 'text-[#8A9BA8]'
              }`}
            >
              HOUR
            </span>
            <input
              ref={hourInputRef}
              type="text"
              inputMode="numeric"
              placeholder="HH"
              value={hourStr}
              onChange={handleHourInput}
              onFocus={() => {
                setActiveSegment('hour');
                hourInputRef.current?.select();
              }}
              onBlur={handleHourBlur}
              disabled={disabled || readOnly}
              className={`w-full text-center bg-transparent border-none outline-none font-mono font-black text-[15px] leading-tight cursor-text p-0 m-0 ${
                activeSegment === 'hour' ? 'text-[#F45A0A]' : hourStr ? 'text-slate-900' : 'text-[#8A9BA8]'
              }`}
            />
          </div>

          <span className="text-slate-300 font-black text-[15px] select-none px-px animate-pulse">:</span>

          {/* MINUTE */}
          <div
            onClick={() => {
              if (disabled || readOnly) return;
              minuteInputRef.current?.focus();
              minuteInputRef.current?.select();
              setActiveSegment('minute');
            }}
            className={`w-[38px] h-[36px] rounded-[8px] flex flex-col items-center justify-between py-1 px-0.5 transition-all box-border shrink-0 cursor-text ${
              activeSegment === 'minute'
                ? 'bg-[#FFF3E8]'
                : 'hover:bg-slate-50'
            }`}
          >
            <span
              className={`text-[7px] font-extrabold tracking-wider leading-none select-none text-center block ${
                activeSegment === 'minute' ? 'text-[#F45A0A]' : 'text-[#8A9BA8]'
              }`}
            >
              MIN
            </span>
            <input
              ref={minuteInputRef}
              type="text"
              inputMode="numeric"
              placeholder="MM"
              value={minuteStr}
              onChange={handleMinuteInput}
              onFocus={() => {
                setActiveSegment('minute');
                minuteInputRef.current?.select();
              }}
              onBlur={handleMinuteBlur}
              disabled={disabled || readOnly}
              className={`w-full text-center bg-transparent border-none outline-none font-mono font-black text-[15px] leading-tight cursor-text p-0 m-0 ${
                activeSegment === 'minute' ? 'text-[#F45A0A]' : minuteStr ? 'text-slate-900' : 'text-[#8A9BA8]'
              }`}
            />
          </div>

          {/* AM/PM label */}
          <span className={`text-[9px] font-bold ms-1 select-none ${period.color}`}>
            {period.label}
          </span>
        </div>

        {/* Right: Now button */}
        <div className="flex items-center justify-end gap-1 shrink-0 ms-auto ps-1">
          {!disabled && !readOnly && (
            <button
              type="button"
              onClick={handleSetNow}
              aria-label={isAr ? 'الوقت الحالي' : 'Set to now'}
              title={isAr ? 'الوقت الحالي' : 'Set to now'}
              className="h-6 px-1.5 rounded-md text-[10px] font-bold text-[#F45A0A] bg-orange-50/70 hover:bg-orange-100 border border-orange-200/60 flex items-center gap-1 transition-all cursor-pointer shrink-0"
            >
              <RotateCcw size={10} strokeWidth={2.5} />
              <span>{isAr ? 'الآن' : 'Now'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Error */}
      {error && (
        <p className="text-[11px] font-medium text-red-600 mt-1 flex items-center gap-1">
          <AlertCircle size={12} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

export default SegmentedTimePicker;
