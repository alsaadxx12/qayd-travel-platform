import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconCalendarEvent, IconChevronLeft, IconChevronRight, IconClock } from '@tabler/icons-react';

interface Props {
  value: Date;
  onChange: (next: Date) => void;
  label?: React.ReactNode;
  labelAction?: React.ReactNode;
  isArabic?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
/** Sunday-first, matching the Iraqi working week. */
const WEEKDAYS_AR = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const WEEKDAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Arabic UI fonts ship a `locl` feature that rewrites ASCII digits as Arabic-Indic
 * (٠١٢…) whenever the surrounding text language is Arabic. Accountants read ledgers
 * in Latin digits, so every numeric surface here switches that feature off and
 * declares itself English.
 */
const LATIN_DIGITS: React.CSSProperties = {
  fontFeatureSettings: '"locl" 0',
  fontVariantNumeric: 'lining-nums tabular-nums',
};

const ARABIC_INDIC = /[٠-٩۰-۹]/g;
/** Accepts a keypad that types ٣ and stores 3. */
const toLatinDigits = (raw: string) =>
  raw.replace(ARABIC_INDIC, (d) => {
    const code = d.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });

const pad = (n: number) => String(n).padStart(2, '0');
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * One field for a date AND a time.
 *
 * It replaces a pair of segmented pickers (YEAR/MONTH/DAY beside HOUR/MIN/AM) that
 * asked for six separate edits to set one moment. Here the whole value reads as a
 * single line, and a single popover carries the calendar and the clock together.
 */
export const DateTimeField: React.FC<Props> = ({
  value,
  onChange,
  label,
  labelAction,
  isArabic = true,
  disabled = false,
  required = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  // While a field is mid-edit the raw keystrokes live here, so clearing it to type
  // a new number doesn't snap back to 12 on the first empty render.
  const [hourDraft, setHourDraft] = useState<string | null>(null);
  const [minuteDraft, setMinuteDraft] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const months = isArabic ? MONTHS_AR : MONTHS_EN;
  const weekdays = isArabic ? WEEKDAYS_AR : WEEKDAYS_EN;

  useEffect(() => {
    if (open) setView(new Date(value.getFullYear(), value.getMonth(), 1));
  }, [open, value]);

  useEffect(() => {
    if (open) return;
    setHourDraft(null);
    setMinuteDraft(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const lead = first.getDay();
    const out: Array<Date | null> = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(view.getFullYear(), view.getMonth(), d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view]);

  const hours24 = value.getHours();
  const isPm = hours24 >= 12;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const today = new Date();

  const commit = (next: Date) => {
    if (disabled) return;
    onChange(next);
  };

  const pickDay = (day: Date) => {
    const next = new Date(day);
    next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    commit(next);
  };

  const setHour12 = (raw: number) => {
    const h12 = Math.min(12, Math.max(1, raw));
    const next = new Date(value);
    next.setHours(isPm ? (h12 % 12) + 12 : h12 % 12, value.getMinutes(), 0, 0);
    commit(next);
  };

  const setMinute = (raw: number) => {
    const m = Math.min(59, Math.max(0, raw));
    const next = new Date(value);
    next.setMinutes(m, 0, 0);
    commit(next);
  };

  const setMeridiem = (pm: boolean) => {
    if (pm === isPm) return;
    const next = new Date(value);
    next.setHours(pm ? hours24 + 12 : hours24 - 12, value.getMinutes(), 0, 0);
    commit(next);
  };

  const onHourInput = (raw: string) => {
    const digits = toLatinDigits(raw).replace(/\D/g, '').slice(0, 2);
    setHourDraft(digits);
    if (digits !== '') setHour12(Number(digits));
  };

  const onMinuteInput = (raw: string) => {
    const digits = toLatinDigits(raw).replace(/\D/g, '').slice(0, 2);
    setMinuteDraft(digits);
    if (digits !== '') setMinute(Number(digits));
  };

  const shiftMonth = (delta: number) =>
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));

  const meridiemLabel = isArabic ? (isPm ? 'مساءً' : 'صباحاً') : isPm ? 'PM' : 'AM';
  const numberInputClass =
    'w-12 h-9 text-center rounded-lg border border-[#E5E7EB] bg-white font-mono text-[13.5px] font-extrabold text-[#111827] outline-none focus:border-[#F45A0A] focus:ring-2 focus:ring-orange-100 transition-colors';

  return (
    <div className={`relative w-full ${className}`} ref={boxRef} dir={isArabic ? 'rtl' : 'ltr'}>
      {(label || labelAction) && (
        <div className="flex items-center justify-between gap-2 min-h-[20px] mb-[7px]">
          <label className="block text-[12.5px] font-medium text-[#6B7280] leading-[20px] truncate">
            {label}
            {required && <span className="text-red-500 mr-0.5">*</span>}
          </label>
          {labelAction ? <span className="shrink-0 flex items-center">{labelAction}</span> : null}
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full h-[42px] flex items-center gap-2.5 px-3 rounded-xl border text-right transition-colors ${
          open ? 'bg-white border-[#F45A0A] ring-2 ring-orange-100' : 'bg-[#FAFAFA] border-[#E5E7EB] hover:bg-white'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <IconCalendarEvent size={17} className={open ? 'text-[#F45A0A]' : 'text-[#9CA3AF]'} />
        <span
          dir="ltr"
          lang="en"
          style={LATIN_DIGITS}
          className="font-mono text-[13.5px] font-extrabold text-[#111827]"
        >
          {pad(value.getDate())}/{pad(value.getMonth() + 1)}/{value.getFullYear()}
        </span>
        <span className="w-px h-4 bg-[#E5E7EB]" />
        <span
          dir="ltr"
          lang="en"
          style={LATIN_DIGITS}
          className="font-mono text-[13.5px] font-extrabold text-[#111827]"
        >
          {pad(hours12)}:{pad(value.getMinutes())}
        </span>
        <span className="text-[11px] font-bold text-[#6B7280] whitespace-nowrap">{meridiemLabel}</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-[318px] rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_12px_32px_-12px_rgba(15,23,42,0.28)] overflow-hidden">
          <div className="flex items-center justify-between px-2.5 py-2 border-b border-slate-100 bg-[#FFFAF6]">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="w-7 h-7 grid place-items-center rounded-lg text-slate-500 hover:bg-orange-50 hover:text-[#F45A0A] cursor-pointer"
              aria-label="previous month"
            >
              <IconChevronRight size={16} />
            </button>
            <div className="text-[12.5px] font-bold text-[#111827]">
              {months[view.getMonth()]}{' '}
              <span dir="ltr" lang="en" style={LATIN_DIGITS} className="font-mono">
                {view.getFullYear()}
              </span>
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="w-7 h-7 grid place-items-center rounded-lg text-slate-500 hover:bg-orange-50 hover:text-[#F45A0A] cursor-pointer"
              aria-label="next month"
            >
              <IconChevronLeft size={16} />
            </button>
          </div>

          <div className="px-2.5 pt-2">
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {weekdays.map((w) => (
                <div key={w} className="h-6 grid place-items-center text-[9.5px] font-bold text-[#9CA3AF]">
                  {w.slice(0, 3)}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5 pb-2">
              {cells.map((day, i) => {
                if (!day) return <div key={`x${i}`} className="h-8" />;
                const selected = sameDay(day, value);
                const isToday = sameDay(day, value) === false && sameDay(day, today);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    lang="en"
                    style={LATIN_DIGITS}
                    onClick={() => pickDay(day)}
                    className={`h-8 rounded-lg font-mono text-[12px] font-bold transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#F45A0A] text-white'
                        : isToday
                          ? 'bg-[#FFF3E8] text-[#C2410C]'
                          : 'text-[#374151] hover:bg-slate-100'
                    }`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-100 px-2.5 py-2.5 bg-[#FCFCFC] space-y-2">
            <div className="flex items-center gap-2">
              <IconClock size={15} className="text-[#9CA3AF] shrink-0" />

              <div dir="ltr" className="flex items-center gap-1 shrink-0">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  lang="en"
                  style={LATIN_DIGITS}
                  value={hourDraft ?? pad(hours12)}
                  onChange={(e) => onHourInput(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={() => setHourDraft(null)}
                  aria-label={isArabic ? 'الساعة' : 'Hour'}
                  className={numberInputClass}
                />
                <span className="font-mono font-extrabold text-[#9CA3AF]">:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  lang="en"
                  style={LATIN_DIGITS}
                  value={minuteDraft ?? pad(value.getMinutes())}
                  onChange={(e) => onMinuteInput(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={() => setMinuteDraft(null)}
                  aria-label={isArabic ? 'الدقيقة' : 'Minute'}
                  className={numberInputClass}
                />
              </div>

              <div className="flex rounded-lg border border-[#E5E7EB] overflow-hidden shrink-0 ms-auto">
                {[false, true].map((pm) => (
                  <button
                    key={String(pm)}
                    type="button"
                    onClick={() => setMeridiem(pm)}
                    className={`h-9 px-2.5 min-w-[52px] text-[11px] font-bold whitespace-nowrap leading-none transition-colors cursor-pointer ${
                      isPm === pm
                        ? 'bg-[#F45A0A] text-white'
                        : 'bg-white text-[#6B7280] hover:bg-slate-50'
                    }`}
                  >
                    {isArabic ? (pm ? 'مساءً' : 'صباحاً') : pm ? 'PM' : 'AM'}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                commit(new Date());
                setOpen(false);
              }}
              className="w-full h-8 rounded-lg bg-white border border-orange-200 text-[11.5px] font-bold text-[#C2410C] hover:bg-[#FFF3E8] transition-colors cursor-pointer"
            >
              {isArabic ? 'الآن' : 'Now'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
