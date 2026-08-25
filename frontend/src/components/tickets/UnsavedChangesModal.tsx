import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Save, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';

interface UnsavedChangesModalProps {
  opened: boolean;
  isSaving?: boolean;
  saveError?: string | null;
  onContinueEditing: () => void;
  onSaveAndExit: () => Promise<void> | void;
  onDiscardAndExit: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  opened,
  isSaving = false,
  saveError = null,
  onContinueEditing,
  onSaveAndExit,
  onDiscardAndExit,
}) => {
  const [internalError, setInternalError] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setInternalError(null);
    }
  }, [opened]);

  useEffect(() => {
    if (saveError) {
      setInternalError(saveError);
    }
  }, [saveError]);

  // Handle keyboard events (Escape to resume editing, Ctrl+Enter to save & exit)
  useEffect(() => {
    if (!opened) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onContinueEditing();
      } else if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [opened, onContinueEditing]);

  if (!opened) return null;

  const handleSave = async () => {
    try {
      setInternalError(null);
      await onSaveAndExit();
    } catch (err: any) {
      setInternalError(err?.message || 'تعذر حفظ التعديلات. تحقق من الاتصال وحاول مرة أخرى.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 select-none font-sans"
      style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}
      dir="rtl"
    >
      {/* ── 1. FULL OVERLAY WITH SOFT BLUR ── */}
      <div
        className="fixed inset-0 bg-[#0F172A]/55 backdrop-blur-[2px] transition-opacity duration-200"
        onClick={() => {
          if (!isSaving) {
            onContinueEditing();
          }
        }}
        aria-hidden="true"
      />

      {/* ── 2. MODAL DIALOG (400px Width, 16px Radius, 24px Padding) ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        className="relative z-10 w-[400px] max-w-[calc(100vw-32px)] min-h-[330px] bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_20px_40px_-15px_rgba(15,23,42,0.18)] p-6 flex flex-col items-center text-center transition-all animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button X (Top-Left in RTL, Resumes editing without losing data) */}
        <button
          type="button"
          onClick={onContinueEditing}
          disabled={isSaving}
          title="متابعة التعديل وإغلاق النافذة"
          className="absolute top-4 left-4 w-[34px] h-[34px] rounded-[8px] flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer disabled:opacity-50"
        >
          <X size={18} />
        </button>

        {/* ── 3. TOP ICON CIRCLE (56px, #FFF1EE, #F45A0A) ── */}
        <div className="w-[56px] h-[56px] rounded-full bg-[#FFF1EE] flex items-center justify-center text-[#F45A0A] shrink-0 mb-4 mt-1 shadow-xs">
          <AlertTriangle size={26} strokeWidth={2.2} />
        </div>

        {/* ── 4. TITLE (20px / 700 / #111827) ── */}
        <h3
          id="unsaved-changes-title"
          className="text-[20px] font-bold text-[#111827] leading-tight mb-2 tracking-tight"
        >
          تعديلات غير محفوظة
        </h3>

        {/* ── 5. EXPLANATION TEXT (14px / 400 / #6B7280 / Line-height 1.7) ── */}
        <p className="text-[14px] text-[#6B7280] leading-[1.7] max-w-[340px] mb-5 font-normal">
          لديك تعديلات لم يتم حفظها بعد. هل تريد حفظ التعديلات قبل مغادرة الفاتورة؟
        </p>

        {/* ── ERROR ALERT (If save fails) ── */}
        {internalError && (
          <div className="w-full p-3 mb-4 rounded-[10px] bg-red-50 border border-red-200 flex items-center gap-2 text-right text-xs text-red-700 animate-in fade-in duration-150">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span className="flex-1 font-medium">{internalError}</span>
          </div>
        )}

        {/* ── 6. PRIMARY SAVE & EXIT BUTTON (48px, #FF5A0A, 15px/600) ── */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full h-[48px] rounded-[8px] bg-[#FF5A0A] hover:bg-[#E95000] active:bg-[#D94800] text-white font-semibold text-[15px] flex items-center justify-center gap-2 shadow-[0_6px_16px_rgba(255,90,10,0.18)] transition-all cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mb-2.5"
        >
          {isSaving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>جارٍ الحفظ...</span>
            </>
          ) : internalError ? (
            <>
              <RefreshCw size={17} />
              <span>إعادة المحاولة وحفظ التعديلات</span>
            </>
          ) : (
            <>
              <Save size={17} />
              <span>حفظ التعديلات والخروج</span>
            </>
          )}
        </button>

        {/* ── 7. SECONDARY ACTIONS (متابعة التعديل / الخروج دون حفظ) ── */}
        <div className="w-full flex flex-col items-center gap-1 mt-1">
          {/* Continue Editing Button */}
          <button
            type="button"
            onClick={onContinueEditing}
            disabled={isSaving}
            className="w-full h-[36px] rounded-[8px] text-[14px] font-medium text-[#111827] hover:bg-[#F3F4F6] transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            متابعة التعديل
          </button>

          {/* Discard & Exit Button */}
          <button
            type="button"
            onClick={onDiscardAndExit}
            disabled={isSaving}
            className="w-full h-[36px] rounded-[8px] text-[14px] font-medium text-[#DC2626] hover:bg-[#FEF2F2] transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            الخروج دون حفظ
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnsavedChangesModal;
