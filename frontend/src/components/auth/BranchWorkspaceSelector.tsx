import React, { useEffect, useRef, useState } from 'react';
import { Building2, Search, ArrowLeft, ArrowRight, MapPin, UserCheck, Check, Star, Loader2 } from 'lucide-react';

export interface BranchWorkspaceOption {
  id: string;
  name: string;
  code: string;
  city: string;
  logo?: string;
  role: string;
  lastActive?: string;
}

interface BranchWorkspaceSelectorProps {
  userName: string;
  branches: BranchWorkspaceOption[];
  onSelectBranch: (branch: BranchWorkspaceOption, rememberAsDefault?: boolean) => void;
  loading?: boolean;
  lang?: 'ar' | 'en';
}

export const BranchWorkspaceSelector: React.FC<BranchWorkspaceSelectorProps> = ({
  userName,
  branches,
  onSelectBranch,
  loading = false,
  lang = 'ar',
}) => {
  const isAr = lang === 'ar';
  const text = isAr
    ? {
        title: 'اختر مساحة العمل',
        greeting: 'مرحباً',
        subtitle: 'حدد الفرع المطلوب لمباشرة الإدارة المالية والحسابية',
        search: 'بحث باسم الفرع أو المدينة…',
        searchLabel: 'البحث في الفروع',
        remember: 'تذكر كفرع افتراضي والدخول تلقائياً في المرات القادمة',
        confirm: 'الدخول لمساحة عمل الفرع المختار',
        loading: 'جارٍ فتح مساحة العمل…',
        empty: 'لا توجد فروع مطابقة لبحثك',
      }
    : {
        title: 'Choose a workspace',
        greeting: 'Welcome',
        subtitle: 'Select the branch you want to use for financial operations',
        search: 'Search by branch or city…',
        searchLabel: 'Search branches',
        remember: 'Use as my default branch and sign in automatically next time',
        confirm: 'Open the selected branch workspace',
        loading: 'Opening workspace…',
        empty: 'No branches match your search',
      };
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string>(() => {
    const savedDefault = localStorage.getItem('default_branch_id') || localStorage.getItem('last_selected_branch_id');
    return (savedDefault && branches.some(b => b.id === savedDefault)) ? savedDefault : (branches[0]?.id || '');
  });
  const [rememberAsDefault, setRememberAsDefault] = useState<boolean>(() => {
    return localStorage.getItem('auto_select_default_branch') !== 'false';
  });

  const filteredBranches = branches.filter((b) =>
    b.name.includes(searchTerm) || b.code.toLowerCase().includes(searchTerm.toLowerCase()) || b.city.includes(searchTerm)
  );

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overlay = overlayRef.current;
    const dialog = dialogRef.current;
    if (!overlay || !dialog) return;

    const backgroundState = Array.from(overlay.parentElement?.children || [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== overlay)
      .map((element) => ({
        element,
        hadInert: element.hasAttribute('inert'),
        ariaHidden: element.getAttribute('aria-hidden'),
      }));

    backgroundState.forEach(({ element }) => {
      element.setAttribute('inert', '');
      element.setAttribute('aria-hidden', 'true');
    });

    const getFocusableElements = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);

    const focusTimer = window.setTimeout(() => {
      const preferred = dialog.querySelector<HTMLElement>(
        'input[type="text"], [data-branch-option][aria-pressed="true"], button:not([disabled])',
      );
      (preferred || dialog).focus();
    }, 0);

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', trapFocus);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', trapFocus);
      backgroundState.forEach(({ element, hadInert, ariaHidden }) => {
        if (!hadInert) element.removeAttribute('inert');
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      });
      previousFocus?.focus();
    };
  }, []);

  const handleConfirm = (overrideBranch?: BranchWorkspaceOption) => {
    const targetBranch = overrideBranch || branches.find((b) => b.id === selectedId) || branches[0];
    if (targetBranch) {
      localStorage.setItem('last_selected_branch_id', targetBranch.id);
      if (rememberAsDefault) {
        localStorage.setItem('default_branch_id', targetBranch.id);
        localStorage.setItem('auto_select_default_branch', 'true');
      } else {
        localStorage.removeItem('default_branch_id');
        localStorage.setItem('auto_select_default_branch', 'false');
      }
      onSelectBranch(targetBranch, rememberAsDefault);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
      dir={isAr ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="branch-workspace-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-xl space-y-5 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl outline-none animate-in zoom-in-95 duration-200 sm:p-8"
      >
        
        {/* HEADER */}
        <div className="text-center space-y-2 border-b border-slate-100 pb-4">
          <div className="w-16 h-16 bg-orange-50 text-[#F45A0A] border border-orange-200 rounded-2xl mx-auto flex items-center justify-center shadow-xs mb-2">
            <Building2 size={32} />
          </div>
          <h2 id="branch-workspace-title" className="text-2xl font-black text-[#0F172A]">{text.title}</h2>
          <p className="text-xs text-[#64748B] font-medium">
            {text.greeting} <span className="font-extrabold text-[#0F172A]">{userName}</span>{isAr ? '، ' : ', '}{text.subtitle}
          </p>
        </div>

        {/* SEARCH BAR (WHEN BRANCHES > 3) */}
        {branches.length > 3 && (
          <div className="relative">
            <Search size={18} className={`absolute top-1/2 -translate-y-1/2 text-slate-500 ${isAr ? 'right-3.5' : 'left-3.5'}`} aria-hidden="true" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={text.search}
              aria-label={text.searchLabel}
              className={`h-[46px] w-full rounded-xl border border-slate-400 bg-slate-50 text-base font-bold text-[#0F172A] placeholder:text-slate-600 transition-all focus:border-[#C2410C] focus:outline-none focus:ring-[3px] focus:ring-[#F45A0A]/20 sm:text-xs ${isAr ? 'pl-3 pr-11' : 'pl-11 pr-3'}`}
            />
          </div>
        )}

        {/* BRANCH CARDS LIST */}
        <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-0.5">
          {filteredBranches.map((branch) => {
            const isSelected = branch.id === selectedId;
            return (
              <button
                type="button"
                data-branch-option
                key={branch.id}
                onClick={() => setSelectedId(branch.id)}
                onDoubleClick={() => handleConfirm(branch)}
                aria-pressed={isSelected}
                className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-start transition-all focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#F45A0A]/30 ${
                  isSelected
                    ? 'bg-orange-50/80 border-[#F45A0A] ring-2 ring-[#F45A0A]/25 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-orange-300 hover:bg-orange-50/20'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  {branch.logo ? (
                    <img
                      src={branch.logo}
                      alt={branch.name}
                      width={48}
                      height={48}
                      loading="lazy"
                      decoding="async"
                      style={{ width: '48px', height: '48px', aspectRatio: '1 / 1' }}
                      className="w-12 h-12 object-contain rounded-xl border border-slate-200 bg-white p-1 shadow-2xs shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-orange-100/70 border border-orange-200 text-[#F45A0A] flex items-center justify-center font-black text-xs shrink-0 font-mono">
                      {branch.code}
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm text-[#0F172A]">{branch.name}</h3>
                      <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                        {branch.code}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[#64748B] font-medium">
                      <span className="flex items-center gap-1">
                        <MapPin size={13} className="text-slate-400" />
                        <span>{branch.city}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-[#F45A0A] font-bold">
                        <UserCheck size={13} />
                        <span>{branch.role}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isSelected && (
                    <div className="w-7 h-7 rounded-full bg-[#F45A0A] text-white flex items-center justify-center shadow-xs">
                      <Check size={16} />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
          {filteredBranches.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs font-bold text-slate-600">
              {text.empty}
            </div>
          )}
        </div>

        {/* DEFAULT BRANCH REMEMBER TOGGLE */}
        <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
          <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs font-bold text-[#0F172A]">
            <input
              type="checkbox"
              checked={rememberAsDefault}
              onChange={(e) => setRememberAsDefault(e.target.checked)}
              className="w-4 h-4 rounded text-[#F45A0A] focus:ring-[#F45A0A] accent-[#F45A0A] cursor-pointer"
            />
            <span className="flex items-center gap-1">
              <Star size={14} className={rememberAsDefault ? 'text-amber-500 fill-amber-500' : 'text-slate-400'} />
              <span>{text.remember}</span>
            </span>
          </label>
        </div>

        {/* CONFIRM BUTTON */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => handleConfirm()}
            disabled={loading}
            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#C2410C] text-sm font-black text-white shadow-md shadow-[#C2410C]/20 transition-all hover:bg-[#9A3412] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#F45A0A]/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ArrowIcon size={19} aria-hidden="true" />}
            <span>{loading ? text.loading : text.confirm}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BranchWorkspaceSelector;
