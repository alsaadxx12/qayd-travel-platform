import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import calculatorSvg from '../../assets/calculator.svg';
import {
  X,
  Minus,
  Maximize2,
  History,
  Trash2,
  Copy,
  Check,
  Delete,
  ArrowRightLeft,
  PictureInPicture2,
} from 'lucide-react';
import { Tooltip } from '@mantine/core';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useAdoptedExchangeRate } from '../../hooks/useAdoptedExchangeRate';
import { showSuccessNotification } from '../../utils/notifications';

interface HistoryItem {
  id: string;
  expression: string;
  result: string;
  timestamp: string;
}

interface DraggableCalculatorModalProps {
  opened: boolean;
  onClose: () => void;
}

export const DraggableCalculatorModal: React.FC<DraggableCalculatorModalProps> = ({
  opened,
  onClose,
}) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const adoptedExchange = useAdoptedExchangeRate();

  // Windows Calculator Engine State
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<'+' | '-' | '×' | '÷' | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  // History & UI State
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem('qayd_calculator_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPoppedOut, setIsPoppedOut] = useState(false);
  const pipWindowRef = useRef<Window | null>(null);
  const pipRootRef = useRef<ReturnType<typeof ReactDOM.createRoot> | null>(null);

  // Cleanup PiP window when calculator closes
  useEffect(() => {
    if (!opened && pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
      setIsPoppedOut(false);
    }
  }, [opened]);

  // Pop-out into Picture-in-Picture window
  const handlePopOut = useCallback(async () => {
    // If already popped out, close and bring back
    if (isPoppedOut && pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
      pipRootRef.current = null;
      setIsPoppedOut(false);
      return;
    }

    // Use Document Picture-in-Picture API (Chrome 116+ / Edge 116+)
    if ('documentPictureInPicture' in window) {
      try {
        // @ts-ignore – API not yet in TS lib
        const pip = await window.documentPictureInPicture.requestWindow({
          width: 340,
          height: 560,
          disallowReturnToOpener: false,
        });
        pipWindowRef.current = pip;
        setIsPoppedOut(true);

        // Copy all stylesheets into PiP window so Tailwind works
        [...document.styleSheets].forEach((sheet) => {
          try {
            const cssText = [...sheet.cssRules].map((r) => r.cssText).join('');
            const style = pip.document.createElement('style');
            style.textContent = cssText;
            pip.document.head.appendChild(style);
          } catch {
            if ((sheet as CSSStyleSheet).href) {
              const link = pip.document.createElement('link');
              link.rel = 'stylesheet';
              link.href = (sheet as CSSStyleSheet).href!;
              pip.document.head.appendChild(link);
            }
          }
        });

        // Add base styles
        const baseStyle = pip.document.createElement('style');
        baseStyle.textContent = `
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: transparent; font-family: 'IBM Plex Sans Arabic', system-ui, sans-serif; overflow: hidden; }
          ::-webkit-scrollbar { display: none; }
        `;
        pip.document.head.appendChild(baseStyle);

        // Create container & render calculator UI inside PiP
        const container = pip.document.createElement('div');
        pip.document.body.appendChild(container);

        // Close PiP state handler
        pip.addEventListener('pagehide', () => {
          pipRootRef.current?.unmount();
          pipRootRef.current = null;
          pipWindowRef.current = null;
          setIsPoppedOut(false);
        });

        showSuccessNotification(
          isAr ? 'تم فتح الحاسبة 🖥️' : 'Calculator Popped Out 🖥️',
          isAr ? 'الحاسبة الآن تعمل فوق جميع النوافذ' : 'Calculator is now floating above all windows',
        );
      } catch (err) {
        // Fallback: open as regular popup window
        const popup = window.open(
          '',
          'qayd-calculator',
          'width=340,height=580,resizable=no,scrollbars=no,toolbar=no,menubar=no,location=no,status=no,alwaysOnTop=1',
        );
        if (popup) {
          pipWindowRef.current = popup;
          setIsPoppedOut(true);
          popup.document.title = isAr ? 'قيد — الحاسبة الذكية' : 'QAYD Calculator';

          // Copy styles
          [...document.styleSheets].forEach((sheet) => {
            try {
              if ((sheet as CSSStyleSheet).href) {
                const link = popup.document.createElement('link');
                link.rel = 'stylesheet';
                link.href = (sheet as CSSStyleSheet).href!;
                popup.document.head.appendChild(link);
              }
            } catch { /* skip */ }
          });

          popup.addEventListener('beforeunload', () => {
            pipWindowRef.current = null;
            setIsPoppedOut(false);
          });

          showSuccessNotification(
            isAr ? 'تم فتح الحاسبة' : 'Calculator Opened',
            isAr ? 'تم فتح الحاسبة في نافذة منفصلة' : 'Calculator opened in a separate window',
          );
        }
      }
    } else {
      showSuccessNotification(
        isAr ? 'غير مدعوم' : 'Not Supported',
        isAr ? 'المتصفح الحالي لا يدعم هذه الميزة. استخدم Chrome أو Edge' : 'Use Chrome or Edge to enable this feature',
      );
    }
  }, [isPoppedOut, isAr]);

  // Dragging State (GPU accelerated)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const defaultX = Math.max(20, (window.innerWidth - 350) / 2);
    const defaultY = Math.max(40, (window.innerHeight - 560) / 2);
    return { x: defaultX, y: defaultY };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    posX: number;
    posY: number;
    currentX: number;
    currentY: number;
    animFrame: number | null;
  }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
    currentX: 0,
    currentY: 0,
    animFrame: null,
  });
  const modalRef = useRef<HTMLDivElement>(null);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('qayd_calculator_history', JSON.stringify(history.slice(0, 50)));
    } catch {}
  }, [history]);

  // Handle Dragging with RequestAnimationFrame (Instant 0ms latency)
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    setIsDragging(true);

    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.posX = position.x;
    dragRef.current.posY = position.y;
    dragRef.current.currentX = position.x;
    dragRef.current.currentY = position.y;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      const newX = Math.max(10, Math.min(window.innerWidth - 340, dragRef.current.posX + deltaX));
      const newY = Math.max(10, Math.min(window.innerHeight - 150, dragRef.current.posY + deltaY));

      dragRef.current.currentX = newX;
      dragRef.current.currentY = newY;

      if (modalRef.current) {
        modalRef.current.style.left = `${newX}px`;
        modalRef.current.style.top = `${newY}px`;
      }
    };

    const handleMouseUp = () => {
      if (!isDragging) return;
      setIsDragging(false);
      setPosition({ x: dragRef.current.currentX, y: dragRef.current.currentY });
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Format numbers for display (Western numerals with commas)
  const formatDisplay = (numStr: string) => {
    if (numStr === 'Error' || numStr === 'Infinity' || numStr === '-Infinity') return 'Error';
    const parts = numStr.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] !== undefined ? `.${parts[1]}` : '';
    const formattedInt = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return formattedInt + decimalPart;
  };

  const calculateResult = (a: number, b: number, op: '+' | '-' | '×' | '÷'): number => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b !== 0 ? a / b : 0;
      default: return b;
    }
  };

  // 1. Digits (0 - 9)
  const handleDigit = useCallback((digit: string) => {
    setDisplay((prev) => {
      if (waitingForOperand || prev === '0' || prev === 'Error') {
        setWaitingForOperand(false);
        return digit;
      }
      if (prev.replace(/,/g, '').length >= 16) return prev;
      return prev + digit;
    });
  }, [waitingForOperand]);

  // 2. Decimal Point (.)
  const handleDecimal = useCallback(() => {
    setDisplay((prev) => {
      if (waitingForOperand || prev === 'Error') {
        setWaitingForOperand(false);
        return '0.';
      }
      if (prev.includes('.')) return prev;
      return prev + '.';
    });
  }, [waitingForOperand]);

  // 3. Binary Operators (+, -, ×, ÷)
  const handleOperator = useCallback((nextOp: '+' | '-' | '×' | '÷') => {
    const inputValue = parseFloat(display.replace(/,/g, '')) || 0;

    if (prevValue === null) {
      setPrevValue(inputValue);
      setEquation(`${formatDisplay(String(inputValue))} ${nextOp}`);
    } else if (operator && !waitingForOperand) {
      const current = prevValue;
      const newValue = calculateResult(current, inputValue, operator);
      const cleanStr = String(Math.round(newValue * 1e10) / 1e10);
      setPrevValue(newValue);
      setDisplay(cleanStr);
      setEquation(`${formatDisplay(cleanStr)} ${nextOp}`);
    } else {
      setEquation(`${formatDisplay(String(prevValue))} ${nextOp}`);
    }

    setWaitingForOperand(true);
    setOperator(nextOp);
  }, [display, prevValue, operator, waitingForOperand]);

  // 4. Equals (=)
  const handleEquals = useCallback(() => {
    const inputValue = parseFloat(display.replace(/,/g, '')) || 0;

    if (prevValue !== null && operator) {
      const result = calculateResult(prevValue, inputValue, operator);
      const cleanResult = String(Math.round(result * 1e10) / 1e10);
      const fullEquation = `${formatDisplay(String(prevValue))} ${operator} ${formatDisplay(String(inputValue))} =`;
      
      setDisplay(cleanResult);
      setEquation(fullEquation);
      setPrevValue(null);
      setOperator(null);
      setWaitingForOperand(true);

      // Add to history
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const newEntry: HistoryItem = {
        id: `calc-${Date.now()}`,
        expression: fullEquation,
        result: cleanResult,
        timestamp: timeStr,
      };
      setHistory((prev) => [newEntry, ...prev.slice(0, 49)]);
    }
  }, [display, prevValue, operator]);

  // 5. Clear Entry (CE) - Clears current display only
  const handleClearEntry = useCallback(() => {
    setDisplay('0');
  }, []);

  // 6. Clear All (C) - Full Reset
  const handleClearAll = useCallback(() => {
    setDisplay('0');
    setEquation('');
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  }, []);

  // 7. Backspace (⌫)
  const handleBackspace = useCallback(() => {
    if (waitingForOperand) return;
    setDisplay((prev) => {
      if (prev === 'Error' || prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  }, [waitingForOperand]);

  // 8. Percentage (%) - Windows behavior
  const handlePercentage = useCallback(() => {
    const current = parseFloat(display.replace(/,/g, '')) || 0;
    if (prevValue !== null && operator) {
      const pct = prevValue * (current / 100);
      setDisplay(String(Math.round(pct * 1e10) / 1e10));
    } else {
      setDisplay(String(current / 100));
    }
  }, [display, prevValue, operator]);

  // 9. Square (x²)
  const handleSquare = useCallback(() => {
    const current = parseFloat(display.replace(/,/g, '')) || 0;
    const res = current * current;
    const clean = String(Math.round(res * 1e10) / 1e10);
    setEquation(`sqr(${formatDisplay(String(current))})`);
    setDisplay(clean);
    setWaitingForOperand(true);
  }, [display]);

  // 10. Square Root (²√x)
  const handleSquareRoot = useCallback(() => {
    const current = parseFloat(display.replace(/,/g, '')) || 0;
    if (current < 0) {
      setDisplay('Error');
    } else {
      const res = Math.sqrt(current);
      const clean = String(Math.round(res * 1e10) / 1e10);
      setEquation(`√(${formatDisplay(String(current))})`);
      setDisplay(clean);
      setWaitingForOperand(true);
    }
  }, [display]);

  // 11. Reciprocal (1/x)
  const handleReciprocal = useCallback(() => {
    const current = parseFloat(display.replace(/,/g, '')) || 0;
    if (current === 0) {
      setDisplay('Error');
    } else {
      const res = 1 / current;
      const clean = String(Math.round(res * 1e10) / 1e10);
      setEquation(`1/(${formatDisplay(String(current))})`);
      setDisplay(clean);
      setWaitingForOperand(true);
    }
  }, [display]);

  // 12. Toggle Sign (+/-)
  const handleToggleSign = useCallback(() => {
    setDisplay((prev) => {
      if (prev === '0' || prev === 'Error') return prev;
      return prev.startsWith('-') ? prev.slice(1) : `-${prev}`;
    });
  }, []);

  // Quick Currency Conversions (Multiplication with adopted rate)
  const handleConvertToIQD = useCallback(() => {
    const current = parseFloat(display.replace(/,/g, '')) || 0;
    const rate = adoptedExchange.adoptedRate || 1500;
    const res = current * rate;
    const clean = String(Math.round(res));
    setEquation(`${formatDisplay(String(current))}$ × ${rate.toLocaleString()} IQD`);
    setDisplay(clean);
    setWaitingForOperand(true);
  }, [display, adoptedExchange.adoptedRate]);

  const handleConvertToUSD = useCallback(() => {
    const current = parseFloat(display.replace(/,/g, '')) || 0;
    const rate = adoptedExchange.adoptedRate || 1500;
    if (rate === 0) return;
    const res = current / rate;
    const clean = String(Math.round(res * 100) / 100);
    setEquation(`${formatDisplay(String(current))} IQD ÷ ${rate.toLocaleString()}`);
    setDisplay(clean);
    setWaitingForOperand(true);
  }, [display, adoptedExchange.adoptedRate]);

  // Copy result to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(display.replace(/,/g, ''));
    setCopied(true);
    showSuccessNotification(
      isAr ? 'تم النسخ' : 'Copied',
      isAr ? `تم نسخ الناتج (${display}) إلى الحافظة بنجاح` : `Result ${display} copied to clipboard`
    );
    setTimeout(() => setCopied(false), 2000);
  };

  // Keyboard Event Listener
  useEffect(() => {
    if (!opened) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        handleDecimal();
      } else if (e.key === '+') {
        e.preventDefault();
        handleOperator('+');
      } else if (e.key === '-') {
        e.preventDefault();
        handleOperator('-');
      } else if (e.key === '*') {
        e.preventDefault();
        handleOperator('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleOperator('÷');
      } else if (e.key === '%') {
        e.preventDefault();
        handlePercentage();
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClearAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [opened, handleDigit, handleDecimal, handleOperator, handlePercentage, handleEquals, handleBackspace, handleClearAll]);

  if (!opened) return null;

  return (
    <div
      ref={modalRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
        willChange: isDragging ? 'left, top' : 'auto',
      }}
      className={`font-sans select-none ${
        isMinimized ? 'w-[280px]' : 'w-[340px]'
      }`}
      dir="ltr"
    >
      {/* ─── MAIN CONTAINER WITH ULTRA-PREMIUM CURVATURE & SHADOWS ─── */}
      <div className="bg-white/98 backdrop-blur-2xl border border-slate-200/90 rounded-[26px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.06),0_10px_25px_-5px_rgba(244,90,10,0.12)] overflow-hidden">
        {/* ─── 1. DRAGGABLE HEADER BAR ─── */}
        <div
          onMouseDown={handleMouseDown}
          className={`h-11 px-3.5 bg-gradient-to-r from-slate-50 via-white to-orange-50/50 border-b border-slate-200/80 flex items-center justify-between cursor-grab active:cursor-grabbing ${
            isDragging ? 'cursor-grabbing select-none' : ''
          }`}
          dir={direction}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-orange-50 text-[#F45A0A] border border-orange-200/80 flex items-center justify-center shadow-2xs shrink-0">
              <img src={calculatorSvg} alt="Calculator" className="w-[18px] h-[18px] object-contain" />
            </div>
            <span className="text-xs font-black text-slate-900 tracking-tight">
              {isAr ? 'الحاسبة الذكية' : 'Smart Calculator'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* History Toggle */}
            {!isMinimized && (
              <Tooltip label={isAr ? 'سجل العمليات' : 'History'} withArrow position="top">
                <button
                  type="button"
                  onClick={() => setShowHistory((p) => !p)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                    showHistory
                      ? 'bg-orange-100 text-[#F45A0A] shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <History size={14} />
                </button>
              </Tooltip>
            )}

            {/* Pop-Out to Floating Window */}
            <Tooltip
              label={isPoppedOut ? (isAr ? 'إعادة الدمج' : 'Bring Back') : (isAr ? 'فتح فوق كل النوافذ' : 'Float Above All Windows')}
              withArrow
              position="top"
            >
              <button
                type="button"
                onClick={handlePopOut}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                  isPoppedOut
                    ? 'bg-blue-100 text-blue-600 shadow-2xs'
                    : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                }`}
                title={isPoppedOut ? 'إعادة الدمج' : 'فتح فوق كل النوافذ'}
              >
                <PictureInPicture2 size={14} />
              </button>
            </Tooltip>

            {/* Minimize / Maximize Button */}
            <button
              type="button"
              onClick={() => setIsMinimized((p) => !p)}
              className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              title={isMinimized ? (isAr ? 'تكبير' : 'Expand') : (isAr ? 'تصغير' : 'Minimize')}
            >
              {isMinimized ? <Maximize2 size={13} /> : <Minus size={14} />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              title={isAr ? 'إغلاق' : 'Close'}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ─── 2. CALCULATOR BODY (WHEN NOT MINIMIZED) ─── */}
        {!isMinimized && (
          <div className="p-3.5 space-y-2.5">
            {/* Display Screen: Refined gradient card with inner shadow */}
            <div className="bg-gradient-to-b from-slate-50 to-slate-100/50 border border-slate-200/80 rounded-[20px] p-3 text-right relative group min-h-[92px] flex flex-col justify-between shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
              {/* Equation Line with active indicator */}
              <div className="text-xs font-mono text-slate-400 font-bold min-h-[18px] flex items-center justify-end gap-1.5" dir="ltr">
                <span className="truncate">{equation || ' '}</span>
                {operator && waitingForOperand && (
                  <span className="px-1.5 py-0.5 bg-orange-100 text-[#F45A0A] rounded-md text-[10px] font-black shrink-0">
                    {operator}
                  </span>
                )}
              </div>

              {/* Main Number Display (Bold Western Numerals) */}
              <div
                className="text-4xl font-black font-mono tracking-tight text-slate-950 overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-none"
                dir="ltr"
              >
                {formatDisplay(display)}
              </div>

              {/* Copy Button */}
              <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-[#F45A0A] hover:border-orange-200 shadow-2xs transition-colors cursor-pointer"
                  title={isAr ? 'نسخ الناتج' : 'Copy result'}
                >
                  {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                </button>
              </div>
            </div>

            {/* Quick Currency Conversions Pill */}
            <div className="p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 grid grid-cols-2 gap-1 text-[11px]" dir={direction}>
              <button
                type="button"
                onClick={handleConvertToIQD}
                className="h-7 rounded-lg bg-white hover:bg-orange-50/80 text-slate-700 hover:text-[#F45A0A] font-bold border border-slate-200/60 transition-all text-center flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
              >
                <span>تحويل للدينار ($ ➔ د.ع)</span>
              </button>
              <button
                type="button"
                onClick={handleConvertToUSD}
                className="h-7 rounded-lg bg-white hover:bg-blue-50/80 text-slate-700 hover:text-blue-700 font-bold border border-slate-200/60 transition-all text-center flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
              >
                <span>تحويل للدولار (د.ع ➔ $)</span>
              </button>
            </div>

            {/* History Panel (Accordion / Toggle View) */}
            {showHistory && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-1.5 max-h-[140px] overflow-y-auto" dir={direction}>
                <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-600 border-b border-slate-200 pb-1">
                  <span>{isAr ? 'سجل العمليات الأخير' : 'Recent Calculations'}</span>
                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setHistory([])}
                      className="text-rose-600 hover:underline flex items-center gap-1 text-[9.5px] cursor-pointer"
                    >
                      <Trash2 size={11} />
                      <span>{isAr ? 'مسح' : 'Clear'}</span>
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <div className="text-[10px] text-slate-400 text-center py-2">
                    {isAr ? 'لا توجد عمليات سابقة' : 'No history yet'}
                  </div>
                ) : (
                  history.slice(0, 10).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setDisplay(item.result);
                        setWaitingForOperand(true);
                      }}
                      className="w-full text-start p-1.5 rounded-lg bg-white hover:bg-orange-50/60 border border-slate-200/70 text-xs transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <div className="min-w-0 pr-1">
                        <span className="text-[10px] font-mono text-slate-400 block truncate" dir="ltr">
                          {item.expression}
                        </span>
                        <span className="text-xs font-mono font-black text-slate-900" dir="ltr">
                          {formatDisplay(item.result)}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-400 shrink-0 font-mono">{item.timestamp}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* ─── 3. WINDOWS CALCULATOR KEYPAD (TACTILE BUTTONS, ROUNDED-2XL) ─── */}
            <div className="grid grid-cols-4 gap-1.5 pt-0.5" dir="ltr">
              {/* Row 1: [ % ] [ CE ] [ C ] [ ⌫ ] */}
              <button
                type="button"
                onClick={handlePercentage}
                className="h-10 rounded-[14px] bg-slate-100/90 hover:bg-slate-200/90 text-slate-800 font-bold text-xs transition-all active:scale-95 cursor-pointer font-mono border border-slate-200/60 shadow-2xs"
              >
                %
              </button>
              <button
                type="button"
                onClick={handleClearEntry}
                className="h-10 rounded-[14px] bg-slate-100/90 hover:bg-slate-200/90 text-slate-800 font-bold text-xs transition-all active:scale-95 cursor-pointer font-mono border border-slate-200/60 shadow-2xs"
              >
                CE
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="h-10 rounded-[14px] bg-slate-100/90 hover:bg-slate-200/90 text-slate-800 font-bold text-xs transition-all active:scale-95 cursor-pointer font-mono border border-slate-200/60 shadow-2xs"
              >
                C
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="h-10 rounded-[14px] bg-slate-100/90 hover:bg-slate-200/90 text-slate-800 font-bold text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center border border-slate-200/60 shadow-2xs"
                title="Backspace"
              >
                <Delete size={17} />
              </button>

              {/* Row 2: [ 1/x ] [ x² ] [ ²√x ] [ ÷ ] */}
              <button
                type="button"
                onClick={handleReciprocal}
                className="h-10 rounded-[14px] bg-slate-100/90 hover:bg-slate-200/90 text-slate-800 font-bold text-xs transition-all active:scale-95 cursor-pointer font-mono border border-slate-200/60 shadow-2xs"
              >
                ¹/x
              </button>
              <button
                type="button"
                onClick={handleSquare}
                className="h-10 rounded-[14px] bg-slate-100/90 hover:bg-slate-200/90 text-slate-800 font-bold text-xs transition-all active:scale-95 cursor-pointer font-mono border border-slate-200/60 shadow-2xs"
              >
                x²
              </button>
              <button
                type="button"
                onClick={handleSquareRoot}
                className="h-10 rounded-[14px] bg-slate-100/90 hover:bg-slate-200/90 text-slate-800 font-bold text-xs transition-all active:scale-95 cursor-pointer font-mono border border-slate-200/60 shadow-2xs"
              >
                ²√x
              </button>
              <button
                type="button"
                onClick={() => handleOperator('÷')}
                className={`h-10 rounded-[14px] font-black text-sm transition-all active:scale-95 cursor-pointer border font-mono ${
                  operator === '÷' && waitingForOperand
                    ? 'bg-[#F45A0A] text-white border-[#F45A0A] shadow-[0_4px_12px_rgba(244,90,10,0.35)] ring-2 ring-orange-200'
                    : 'bg-[#FFF6EE] hover:bg-[#FFEBDC] text-[#F45A0A] border-orange-200/80 shadow-2xs'
                }`}
              >
                ÷
              </button>

              {/* Row 3: [ 7 ] [ 8 ] [ 9 ] [ × ] */}
              <button
                type="button"
                onClick={() => handleDigit('7')}
                className="h-11 rounded-[14px] bg-white hover:bg-slate-50 text-slate-900 font-black text-[17px] transition-all active:scale-95 cursor-pointer border border-slate-200/90 shadow-[0_2px_4px_rgba(0,0,0,0.03)] font-mono"
              >
                7
              </button>
              <button
                type="button"
                onClick={() => handleDigit('8')}
                className="h-11 rounded-[14px] bg-white hover:bg-slate-50 text-slate-900 font-black text-[17px] transition-all active:scale-95 cursor-pointer border border-slate-200/90 shadow-[0_2px_4px_rgba(0,0,0,0.03)] font-mono"
              >
                8
              </button>
              <button
                type="button"
                onClick={() => handleDigit('9')}
                className="h-11 rounded-[14px] bg-white hover:bg-slate-50 text-slate-900 font-black text-[17px] transition-all active:scale-95 cursor-pointer border border-slate-200/90 shadow-[0_2px_4px_rgba(0,0,0,0.03)] font-mono"
              >
                9
              </button>
              <button
                type="button"
                onClick={() => handleOperator('×')}
                className={`h-11 rounded-[14px] font-black text-sm transition-all active:scale-95 cursor-pointer border font-mono ${
                  operator === '×' && waitingForOperand
                    ? 'bg-[#F45A0A] text-white border-[#F45A0A] shadow-[0_4px_12px_rgba(244,90,10,0.35)] ring-2 ring-orange-200'
                    : 'bg-[#FFF6EE] hover:bg-[#FFEBDC] text-[#F45A0A] border-orange-200/80 shadow-2xs'
                }`}
              >
                ×
              </button>

              {/* Row 4: [ 4 ] [ 5 ] [ 6 ] [ - ] */}
              <button
                type="button"
                onClick={() => handleDigit('4')}
                className="h-11 rounded-[14px] bg-white hover:bg-slate-50 text-slate-900 font-black text-[17px] transition-all active:scale-95 cursor-pointer border border-slate-200/90 shadow-[0_2px_4px_rgba(0,0,0,0.03)] font-mono"
              >
                4
              </button>
              <button
                type="button"
                onClick={() => handleDigit('5')}
                className="h-11 rounded-[14px] bg-white hover:bg-slate-50 text-slate-900 font-black text-[17px] transition-all active:scale-95 cursor-pointer border border-slate-200/90 shadow-[0_2px_4px_rgba(0,0,0,0.03)] font-mono"
              >
                5
              </button>
              <button
                type="button"
                onClick={() => handleDigit('6')}
                className="h-11 rounded-[14px] bg-white hover:bg-slate-50 text-slate-900 font-black text-[17px] transition-all active:scale-95 cursor-pointer border border-slate-200/90 shadow-[0_2px_4px_rgba(0,0,0,0.03)] font-mono"
              >
                6
              </button>
              <button
                type="button"
                onClick={() => handleOperator('-')}
                className={`h-11 rounded-[14px] font-black text-base transition-all active:scale-95 cursor-pointer border font-mono ${
                  operator === '-' && waitingForOperand
                    ? 'bg-[#F45A0A] text-white border-[#F45A0A] shadow-[0_4px_12px_rgba(244,90,10,0.35)] ring-2 ring-orange-200'
                    : 'bg-[#FFF6EE] hover:bg-[#FFEBDC] text-[#F45A0A] border-orange-200/80 shadow-2xs'
                }`}
              >
                -
              </button>

              {/* Row 5: [ 1 ] [ 2 ] [ 3 ] [ + ] */}
              <button
                type="button"
                onClick={() => handleDigit('1')}
                className="h-11 rounded-[14px] bg-white hover:bg-slate-50 text-slate-900 font-black text-[17px] transition-all active:scale-95 cursor-pointer border border-slate-200/90 shadow-[0_2px_4px_rgba(0,0,0,0.03)] font-mono"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => handleDigit('2')}
                className="h-11 rounded-[14px] bg-white hover:bg-slate-50 text-slate-900 font-black text-[17px] transition-all active:scale-95 cursor-pointer border border-slate-200/90 shadow-[0_2px_4px_rgba(0,0,0,0.03)] font-mono"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => handleDigit('3')}
                className="h-11 rounded-[14px] bg-white hover:bg-slate-50 text-slate-900 font-black text-[17px] transition-all active:scale-95 cursor-pointer border border-slate-200/90 shadow-[0_2px_4px_rgba(0,0,0,0.03)] font-mono"
              >
                3
              </button>
              <button
                type="button"
                onClick={() => handleOperator('+')}
                className={`h-11 rounded-[14px] font-black text-base transition-all active:scale-95 cursor-pointer border font-mono ${
                  operator === '+' && waitingForOperand
                    ? 'bg-[#F45A0A] text-white border-[#F45A0A] shadow-[0_4px_12px_rgba(244,90,10,0.35)] ring-2 ring-orange-200'
                    : 'bg-[#FFF6EE] hover:bg-[#FFEBDC] text-[#F45A0A] border-orange-200/80 shadow-2xs'
                }`}
              >
                +
              </button>

              {/* Row 6: [ +/- ] [ 0 ] [ . ] [ = ] */}
              <button
                type="button"
                onClick={handleToggleSign}
                className="h-11 rounded-[14px] bg-white hover:bg-slate-50 text-slate-900 font-bold text-sm transition-all active:scale-95 cursor-pointer border border-slate-200/90 shadow-[0_2px_4px_rgba(0,0,0,0.03)] font-mono"
              >
                ⁺/₋
              </button>
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="h-11 rounded-[14px] bg-white hover:bg-slate-50 text-slate-900 font-black text-[17px] transition-all active:scale-95 cursor-pointer border border-slate-200/90 shadow-[0_2px_4px_rgba(0,0,0,0.03)] font-mono"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDecimal}
                className="h-11 rounded-[14px] bg-white hover:bg-slate-50 text-slate-900 font-black text-lg transition-all active:scale-95 cursor-pointer border border-slate-200/90 shadow-[0_2px_4px_rgba(0,0,0,0.03)] font-mono"
              >
                .
              </button>
              <button
                type="button"
                onClick={handleEquals}
                className="h-11 rounded-[14px] bg-gradient-to-r from-[#F45A0A] to-[#DD4F05] hover:from-[#FF6519] hover:to-[#E54800] text-white font-black text-xl shadow-[0_6px_20px_-2px_rgba(244,90,10,0.45)] active:scale-95 transition-all cursor-pointer flex items-center justify-center font-mono"
              >
                =
              </button>
            </div>
          </div>
        )}

        {/* Minimized View Header */}
        {isMinimized && (
          <div className="p-2.5 px-3.5 flex items-center justify-between bg-slate-50 text-xs" dir="ltr">
            <span className="font-mono font-black text-slate-900 text-sm">
              {formatDisplay(display)}
            </span>
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="text-[11px] text-[#F45A0A] font-bold hover:underline cursor-pointer"
            >
              {isAr ? 'فتح الحاسبة' : 'Expand'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DraggableCalculatorModal;
