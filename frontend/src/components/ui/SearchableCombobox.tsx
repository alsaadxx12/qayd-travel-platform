import React, { useState, useRef, useEffect, useId } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label: string;
  code?: string;
  name?: string;
  nameAr?: string;
  nameEn?: string;
  logo?: string;
  subLabel?: string;
}

interface SearchableComboboxProps {
  label?: React.ReactNode;
  value?: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  clearable?: boolean;
  allowCustomValue?: boolean;
  required?: boolean;
  leftIcon?: React.ReactNode;
  renderOption?: (option: ComboboxOption, isSelected: boolean) => React.ReactNode;
  className?: string;
  displayValue?: string;
}

export const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  label,
  value = '',
  onChange,
  options,
  placeholder = '',
  error,
  disabled = false,
  clearable = true,
  allowCustomValue = false,
  required = false,
  leftIcon,
  renderOption,
  className = '',
  displayValue,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);
  const listId = useId();

  // Find selected option (robustly matching value, label, code, ID, or name)
  const selectedOption = options.find((opt) =>
    opt.value === value ||
    opt.label === value ||
    (opt.code && opt.code === value) ||
    ((opt as any).id && (opt as any).id === value) ||
    ((opt as any).nameAr && (opt as any).nameAr === value) ||
    ((opt as any).nameEn && (opt as any).nameEn === value) ||
    ((opt as any).name && (opt as any).name === value)
  );
  // If no match found and value looks like a UUID, show displayValue or empty string instead
  const isUUID = value && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(value);
  const displayLabel = selectedOption ? selectedOption.label : (isUUID ? (displayValue || '') : value);

  // Filtered options
  const filteredOptions = options.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const l = (opt.label || '').toLowerCase();
    const c = (opt.code || '').toLowerCase();
    const v = (opt.value || '').toLowerCase();
    const n = (opt.name || '').toLowerCase();
    return l.includes(q) || c.includes(q) || v.includes(q) || n.includes(q);
  });

  // Handle clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync input value with search when open
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      inputRef.current?.focus();
    } else {
      setSearchQuery('');
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  // Check scroll position to display subtle bottom fade
  const checkScroll = () => {
    if (listboxRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = listboxRef.current;
      setCanScrollDown(scrollHeight - (scrollTop + clientHeight) > 6);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(checkScroll, 50);
      return () => clearTimeout(t);
    }
  }, [isOpen, filteredOptions]);

  // Scroll highlighted item into view during keyboard navigation
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && itemsRef.current[highlightedIndex]) {
      itemsRef.current[highlightedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [highlightedIndex, isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelectOption(filteredOptions[highlightedIndex]);
        } else if (allowCustomValue && searchQuery.trim()) {
          onChange(searchQuery.trim());
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  const handleSelectOption = (opt: ComboboxOption) => {
    onChange(opt.value);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef} dir="rtl">
      {label && (
        <label className="block text-[12.5px] font-medium text-[#6B7280] mb-[7px]">
          {label}
          {required && <span className="text-red-500 mr-0.5">*</span>}
        </label>
      )}

      {/* ── Main Trigger Field (Calm #FAFAFA, hover #FFFFFF, focus/open #FFFFFF with #F45A0A border) ── */}
      <div
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        onKeyDown={handleKeyDown}
        className={`w-full h-[46px] px-3.5 rounded-[11px] border transition-colors duration-150 flex items-center justify-between cursor-pointer select-none ${
          disabled
            ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
            : isOpen
            ? 'bg-white border-2 border-[#F45A0A]'
            : error
            ? 'bg-[#FAFAFA] border-red-400 hover:border-red-500'
            : 'bg-[#FAFAFA] border-[#E5E7EB] hover:bg-white hover:border-[#D1D5DB]'
        }`}
      >
        {/* Right side in RTL: Search / Custom icon + Display Value / Search Input */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="shrink-0 text-slate-400">
            {leftIcon || <Search size={15} />}
          </div>

          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
                if (allowCustomValue) {
                  onChange(e.target.value);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder={displayLabel || placeholder}
              className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-[#9CA3AF]"
              role="combobox"
              aria-expanded={isOpen}
              aria-controls={listId}
            />
          ) : (
            <span
              className={`text-sm font-medium truncate block ${
                displayLabel ? 'text-slate-900' : 'text-[#9CA3AF]'
              }`}
            >
              {displayLabel || placeholder}
            </span>
          )}
        </div>

        {/* Left side in RTL: Clear button + Chevron Arrow */}
        <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
          {clearable && displayLabel && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#F45A0A]' : 'text-slate-400'
            }`}
          />
        </div>
      </div>

      {error && <p className="text-[11.5px] text-red-500 mt-1 font-medium">{error}</p>}

      {/* ── 2. Floating Popover Dropdown with Hidden Scrollbar & Subtle Gradient ── */}
      {isOpen && (
        <div
          className="absolute z-50 right-0 left-0 mt-1.5 bg-white border border-[#E5E7EB] rounded-[12px] shadow-[0_10px_30px_rgba(15,23,42,0.12)] p-1.5 font-sans animate-in fade-in-50 zoom-in-95 duration-100 overflow-hidden"
          style={{ width: '100%' }}
        >
          {/* Scrollable List container with hidden scrollbar and mousewheel/touch/keyboard support */}
          <div
            id={listId}
            ref={listboxRef}
            role="listbox"
            onScroll={checkScroll}
            className="max-h-[280px] overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden space-y-0.5"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value || opt.label === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={`${opt.value}-${idx}`}
                    ref={(el) => {
                      itemsRef.current[idx] = el;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleSelectOption(opt)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-[9px] text-xs cursor-pointer transition-colors duration-100 select-none ${
                      isSelected
                        ? 'bg-[#FFF3E8] text-[#F45A0A] font-bold'
                        : isHighlighted
                        ? 'bg-[#FFF3E8]/70 text-slate-900 font-medium'
                        : 'text-slate-800 hover:bg-[#FFF3E8]/50'
                    }`}
                  >
                    {renderOption ? (
                      renderOption(opt, isSelected)
                    ) : (
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {opt.logo && (
                          <img
                            src={opt.logo}
                            alt={opt.label}
                            className="w-5 h-5 object-contain rounded shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                        <span className="truncate text-xs font-medium text-slate-900">
                          {opt.label}
                        </span>
                        {opt.subLabel && (
                          <span className="text-[10.5px] text-slate-400 truncate">
                            ({opt.subLabel})
                          </span>
                        )}
                      </div>
                    )}

                    {isSelected && (
                      <Check size={14} className="text-[#F45A0A] shrink-0 mr-2" />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-slate-500 font-medium select-none">
                لا توجد نتائج مطابقة
              </div>
            )}
          </div>

          {/* Subtle Bottom Fade Gradient indicator when additional items exist */}
          {canScrollDown && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white via-white/80 to-transparent rounded-b-[12px]" />
          )}
        </div>
      )}
    </div>
  );
};
