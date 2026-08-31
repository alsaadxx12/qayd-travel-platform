import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Bug,
  Lightbulb,
  HelpCircle,
  Upload,
  Send,
  Check,
  X,
  AlertCircle,
  AlertTriangle,
  Flame,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Trash2,
  Eye,
  Loader2,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { feedbackApi, CreateFeedbackPayload } from '../../api/feedback';
import { tenantsApi } from '../../api/tenants';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { Lottie } from 'lottie-react';
import receptionistAnimation from '../../assets/animations/receptionist.json';

interface SeverityOption {
  id: string;
  labelAr: string;
  labelEn: string;
  subAr: string;
  subEn: string;
  icon: React.ReactNode;
  iconColor: string;
}

const SEVERITY_OPTIONS: SeverityOption[] = [
  {
    id: 'LOW',
    labelAr: 'منخفض',
    labelEn: 'Low',
    subAr: 'ملاحظة بسيطة',
    subEn: 'Minor note',
    icon: <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />,
    iconColor: 'text-emerald-600',
  },
  {
    id: 'MEDIUM',
    labelAr: 'متوسط',
    labelEn: 'Medium',
    subAr: 'خلل غير معطل',
    subEn: 'Non-blocking glitch',
    icon: <AlertCircle size={16} className="text-amber-500 shrink-0" />,
    iconColor: 'text-amber-500',
  },
  {
    id: 'HIGH',
    labelAr: 'مرتفع',
    labelEn: 'High',
    subAr: 'تأثير على العمل',
    subEn: 'Affects workflow',
    icon: <AlertTriangle size={16} className="text-orange-600 shrink-0" />,
    iconColor: 'text-orange-600',
  },
  {
    id: 'CRITICAL',
    labelAr: 'حرج',
    labelEn: 'Critical',
    subAr: 'توقف كامل',
    subEn: 'Complete blocker',
    icon: <Flame size={16} className="text-red-600 shrink-0" />,
    iconColor: 'text-red-600',
  },
];

export const FeedbackFloatingDrawer: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [opened, setOpened] = useState(false);
  const [type, setType] = useState<string>('BUG');
  const [severity, setSeverity] = useState<string>('MEDIUM');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string>('');
  const [screenshotSize, setScreenshotSize] = useState<string>('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string>('');
  const [showTechInfo, setShowTechInfo] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; description?: string; screenshot?: string }>({});

  const titleInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data: currentTenant } = useQuery({
    queryKey: ['current-tenant'],
    queryFn: () => tenantsApi.getCurrentTenant(),
    staleTime: 60000,
  });

  const activeCompanyName = currentTenant?.name || user?.companyName || (isAr ? 'شركة الروضتين للسياحة والسفر' : 'Al-Rawdatain Travel & Tourism');

  // Listen for global open drawer trigger
  useEffect(() => {
    const handleOpen = () => {
      setOpened(true);
      setSubmitted(false);
      setErrors({});
    };
    window.addEventListener('open-feedback-drawer', handleOpen);
    return () => window.removeEventListener('open-feedback-drawer', handleOpen);
  }, []);

  // Lock body scroll and handle Escape key when modal is open
  useEffect(() => {
    if (!opened) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !feedbackMutation.isPending) {
        setOpened(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [opened]);

  // Focus title input on drawer open
  useEffect(() => {
    if (opened && !submitted) {
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 250);
    }
  }, [opened, submitted]);

  const feedbackMutation = useMutation({
    mutationFn: (payload: CreateFeedbackPayload) => feedbackApi.submitFeedback(payload),
    onSuccess: (res: any) => {
      setSubmitted(true);
      setSubmittedRef(res?.id ? `FB-${res.id.slice(-6).toUpperCase()}` : `FB-${Math.floor(100000 + Math.random() * 900000)}`);
      showSuccessNotification(
        isAr ? 'تم إرسال البلاغ بنجاح' : 'Feedback Submitted Successfully',
        isAr ? 'سيقوم فريق الدعم الفني بمتابعة البلاغ ومعالجته فوراً.' : 'Our technical support team will review and process your ticket immediately.'
      );
      queryClient.invalidateQueries({ queryKey: ['all-feedbacks'] });
      queryClient.invalidateQueries({ queryKey: ['my-support-tickets'] });
    },
    onError: (err: any) => {
      showErrorNotification(
        isAr ? 'فشل الإرسال' : 'Submission Failed',
        err?.message || (isAr ? 'تعذر إرسال البلاغ. يرجى المحاولة مرة أخرى.' : 'Failed to submit feedback. Please try again.')
      );
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({
        ...prev,
        screenshot: isAr ? 'نوع الملف غير مدعوم. يرجى اختيار صورة PNG أو JPG.' : 'Unsupported file type. Please select a PNG or JPG image.',
      }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        screenshot: isAr ? 'حجم الصورة كبير جداً. الحد الأقصى المسموح به هو 5 ميغابايت.' : 'Image size is too large. Maximum allowed size is 5MB.',
      }));
      return;
    }

    setErrors((prev) => ({ ...prev, screenshot: undefined }));
    setScreenshotName(file.name);
    setScreenshotSize((file.size / 1024).toFixed(1) + ' KB');

    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const validateForm = (): boolean => {
    const errs: { title?: string; description?: string } = {};

    if (!title.trim()) {
      errs.title = isAr ? 'عنوان المشكلة أو الملاحظة مطلوب' : 'Issue or feedback title is required';
    }
    if (!description.trim()) {
      errs.description = isAr ? 'يرجى كتابة التفاصيل وخطوات حدوث المشكلة' : 'Please explain the details and steps to reproduce';
    }

    setErrors(errs);

    if (errs.title) {
      titleInputRef.current?.focus();
      return false;
    }
    if (errs.description) {
      descInputRef.current?.focus();
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    feedbackMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      type,
      severity,
      screenshotUrl: screenshotBase64 || undefined,
      pageUrl: window.location.href,
      userName: user?.name,
      userEmail: user?.email,
      userPhone: user?.phone,
      tenantName: activeCompanyName,
    });
  };

  const handleResetAndClose = () => {
    setOpened(false);
    setTimeout(() => {
      setSubmitted(false);
      setTitle('');
      setDescription('');
      setScreenshotBase64(null);
      setScreenshotName('');
      setScreenshotSize('');
      setType('BUG');
      setSeverity('MEDIUM');
      setErrors({});
      setShowTechInfo(false);
    }, 250);
  };

  return (
    <>
      {/* ── 1. ULTRA SLIM DOCKED SUPPORT TAB (Compact 24px wide -> Expands on hover) ── */}
      <div
        className={`fixed top-1/2 -translate-y-1/2 ${
          direction === 'rtl' ? 'left-0' : 'right-0'
        } z-[40]`}
      >
        <button
          type="button"
          onClick={() => {
            setOpened((prev) => !prev);
            setSubmitted(false);
            setErrors({});
          }}
          title={isAr ? 'مركز الملاحظات والدعم الفني' : 'Feedback & Support'}
          className={`h-8 w-6 hover:w-auto hover:px-2.5 flex items-center justify-center hover:gap-1.5 bg-[#F45A0A] hover:bg-[#DD4F05] text-white shadow-sm hover:shadow-[0_4px_16px_rgba(244,90,10,0.4)] transition-all duration-200 ease-out cursor-pointer select-none group border-y border-white/30 overflow-hidden ${
            direction === 'rtl'
              ? 'rounded-r-lg border-r'
              : 'rounded-l-lg border-l flex-row-reverse'
          }`}
          aria-label={isAr ? 'الدعم الفني' : 'Support'}
        >
          <MessageSquare
            size={14}
            className="text-white shrink-0 group-hover:scale-105 transition-transform"
          />
          <span className="hidden group-hover:inline-block whitespace-nowrap text-[11px] font-black tracking-wide text-white leading-none">
            {isAr ? 'الدعم الفني' : 'Support'}
          </span>
        </button>
      </div>

      {/* ── 2. BACKDROP OVERLAY ── */}
      {opened && (
        <div
          className="fixed inset-0 bg-[#0F172A]/48 backdrop-blur-[3px] z-[10000] transition-opacity duration-300"
          onClick={() => !feedbackMutation.isPending && setOpened(false)}
        />
      )}

      {/* ── 3. SMOOTH SLIDING SIDE DRAWER ── */}
      <div
        className={`fixed inset-y-0 ${direction === 'rtl' ? 'left-0 border-r' : 'right-0 border-l'} z-[10001] w-full max-w-[480px] bg-white border-[#E5E7EB] shadow-[0_20px_60px_rgba(15,23,42,0.25)] flex flex-col transition-transform duration-300 ease-out font-sans ${
          opened
            ? 'translate-x-0 pointer-events-auto'
            : (direction === 'rtl' ? '-translate-x-full' : 'translate-x-full') + ' pointer-events-none'
        }`}
        dir={direction}
        style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
      >
        {/* ── A. STICKY HEADER ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] bg-white shrink-0 sticky top-0 z-10 min-h-[72px]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 p-1 relative">
              <Lottie src={receptionistAnimation} loop={true} autoplay={true} className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="font-bold text-[18px] text-[#111827] leading-tight">
                {isAr ? 'مركز الملاحظات والدعم' : 'Feedback & Support Center'}
              </h3>
              <p className="text-[12.5px] font-normal text-[#6B7280] mt-0.5">
                {isAr ? 'أرسل مشكلة أو اقتراحًا ليتمكن فريق الدعم من معالجته' : 'Submit an issue or suggestion for our support team to resolve'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => !feedbackMutation.isPending && setOpened(false)}
            disabled={feedbackMutation.isPending}
            className="w-9 h-9 rounded-[9px] flex items-center justify-center text-[#64748B] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer disabled:opacity-50"
            title={isAr ? 'إغلاق (Esc)' : 'Close (Esc)'}
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        {/* ── B. CONTENT AREA ── */}
        <div
          className="flex-1 overflow-y-auto px-5 py-[18px] space-y-[18px] bg-white support-dialog-content"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {submitted ? (
            /* ── SUCCESS STATE (IN-DRAWER) ── */
            <div className="py-12 px-2 text-center space-y-4 font-sans">
              <div className="w-14 h-14 rounded-full bg-[#ECFDF5] border border-emerald-200 text-emerald-600 mx-auto flex items-center justify-center shadow-xs">
                <Check size={28} strokeWidth={3} />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-bold text-[18px] text-[#111827]">
                  {isAr ? 'تم إرسال البلاغ بنجاح' : 'Feedback Submitted Successfully'}
                </h4>
                <p className="text-[13px] font-normal text-[#6B7280] leading-relaxed max-w-[340px] mx-auto">
                  {isAr
                    ? 'تم تسجيل ملاحظتك برقم مرجعي وتوجيهها للفريق الفني المختص، وسيصلك إشعار فور المعالجة.'
                    : 'Your ticket has been recorded with a reference number and sent to our technical team for immediate processing.'}
                </p>
              </div>

              {submittedRef && (
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono font-semibold text-slate-700">
                  <span>{isAr ? 'الرقم المرجعي:' : 'Reference #:'}</span>
                  <span className="text-[#F45A0A] font-bold">{submittedRef}</span>
                </div>
              )}

              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="w-full h-11 bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-semibold text-[14px] rounded-[10px] transition-colors cursor-pointer shadow-xs"
                >
                  {isAr ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          ) : (
            /* ── FORM CONTENT ── */
            <form id="feedback-form" onSubmit={handleSubmit} className="space-y-[18px]">
              {/* 1. TYPE SELECTOR */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-[7px]">
                  {isAr ? 'نوع الملاحظة' : 'Feedback Type'} <span className="text-red-500">*</span>
                </label>
                <div className="h-[42px] bg-[#F3F4F6] border border-[#E5E7EB] p-[3px] rounded-[10px] grid grid-cols-3 gap-1">
                  {[
                    { id: 'BUG', label: isAr ? 'مشكلة تقنية' : 'Technical Issue', icon: <Bug size={14} /> },
                    { id: 'FEEDBACK', label: isAr ? 'اقتراح' : 'Suggestion', icon: <Lightbulb size={14} /> },
                    { id: 'INQUIRY', label: isAr ? 'استفسار' : 'Inquiry', icon: <HelpCircle size={14} /> },
                  ].map((item) => {
                    const isActive = type === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setType(item.id)}
                        className={`flex items-center justify-center gap-1.5 h-full rounded-[8px] text-[12.5px] font-semibold transition-all cursor-pointer select-none ${
                          isActive
                            ? 'bg-white text-[#C94A05] border border-[#FED7AA] shadow-2xs font-semibold'
                            : 'bg-transparent text-[#64748B] hover:bg-white/60 hover:text-slate-900 font-medium'
                        }`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. SEVERITY GRID (2 Columns for BUG type) */}
              {type === 'BUG' && (
                <div>
                  <label className="block text-[13px] font-medium text-[#374151] mb-[7px]">
                    {isAr ? 'مستوى الخطورة' : 'Severity Level'} <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SEVERITY_OPTIONS.map((opt) => {
                      const isSelected = severity === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSeverity(opt.id)}
                          className={`flex items-center gap-2.5 p-2.5 h-[60px] text-start rounded-[10px] border transition-all cursor-pointer select-none ${
                            isSelected
                              ? 'bg-[#FFF7ED] border-[#F45A0A] ring-2 ring-[#F45A0A]/20'
                              : 'bg-[#FAFAFA] border-[#E5E7EB] hover:bg-white hover:border-[#D1D5DB]'
                          }`}
                        >
                          <div className="shrink-0">{opt.icon}</div>
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-[13px] text-[#111827] block leading-tight">
                              {isAr ? opt.labelAr : opt.labelEn}
                            </span>
                            <span className="text-[11.5px] font-normal text-[#6B7280] block truncate">
                              {isAr ? opt.subAr : opt.subEn}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-[#F45A0A] text-white flex items-center justify-center shrink-0">
                              <Check size={10} strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. TITLE FIELD */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-[7px]">
                  {isAr ? 'عنوان المشكلة أو الملاحظة' : 'Issue or Feedback Title'} <span className="text-red-500">*</span>
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                  }}
                  placeholder={isAr ? 'اكتب عنواناً مختصراً وواضحاً...' : 'Write a clear, concise title...'}
                  className={`w-full h-[46px] px-3.5 rounded-[10px] text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none transition-all duration-150 ${
                    errors.title
                      ? 'bg-red-50/50 border-2 border-red-500 focus:ring-3 focus:ring-red-500/10'
                      : 'bg-[#FAFAFA] border border-[#E5E7EB] hover:bg-white hover:border-[#D1D5DB] focus:bg-white focus:border-[#F45A0A] focus:ring-3 focus:ring-[#F45A0A]/10'
                  }`}
                  disabled={feedbackMutation.isPending}
                />
                {errors.title && (
                  <p className="text-[12px] font-medium text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{errors.title}</span>
                  </p>
                )}
              </div>

              {/* 4. DETAILS / DESCRIPTION FIELD */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-[7px]">
                  {isAr ? 'التفاصيل وخطوات الحدوث' : 'Details & Steps to Reproduce'} <span className="text-red-500">*</span>
                </label>
                <textarea
                  ref={descInputRef}
                  rows={4}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
                  }}
                  placeholder={isAr ? 'اشرح المشكلة بالتفصيل والخطوات التي قمت بها قبل ظهورها...' : 'Explain the issue in detail and the steps performed before it occurred...'}
                  className={`w-full min-h-[110px] max-h-[140px] p-3.5 rounded-[10px] text-[14px] text-[#111827] placeholder-[#9CA3AF] outline-none resize-none transition-all duration-150 ${
                    errors.description
                      ? 'bg-red-50/50 border-2 border-red-500 focus:ring-3 focus:ring-red-500/10'
                      : 'bg-[#FAFAFA] border border-[#E5E7EB] hover:bg-white hover:border-[#D1D5DB] focus:bg-white focus:border-[#F45A0A] focus:ring-3 focus:ring-[#F45A0A]/10'
                  }`}
                  disabled={feedbackMutation.isPending}
                />
                {errors.description && (
                  <p className="text-[12px] font-medium text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{errors.description}</span>
                  </p>
                )}
              </div>

              {/* 5. SCREENSHOT DROPZONE */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-[7px]">
                  {isAr ? 'إرفاق لقطة شاشة — اختياري' : 'Attach Screenshot — Optional'}
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {screenshotBase64 ? (
                  /* Uploaded Preview Card */
                  <div className="border border-[#E5E7EB] bg-[#FAFAFA] rounded-[10px] p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={screenshotBase64}
                        alt="Screenshot Preview"
                        className="w-12 h-12 object-cover rounded-lg border border-[#E5E7EB] shrink-0 bg-white"
                      />
                      <div className="min-w-0">
                        <span className="font-semibold text-[13px] text-[#111827] block truncate">
                          {screenshotName}
                        </span>
                        <span className="text-[11.5px] text-[#6B7280] block font-mono">
                          {screenshotSize}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewOpen(true)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
                        title={isAr ? 'معاينة الصورة' : 'Preview Image'}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScreenshotBase64(null);
                          setScreenshotName('');
                          setScreenshotSize('');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
                        title={isAr ? 'حذف الصورة' : 'Delete Image'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Dropzone Button */
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full min-h-[76px] p-3.5 border-[1.5px] border-dashed border-[#D7DCE3] hover:border-[#F45A0A] bg-[#FAFAFA] hover:bg-white rounded-[10px] flex items-center justify-center gap-3 transition-colors cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-orange-50 text-slate-500 group-hover:text-[#F45A0A] flex items-center justify-center shrink-0 transition-colors">
                      <Upload size={18} />
                    </div>
                    <div className="text-start">
                      <span className="font-semibold text-[13px] text-[#374151] group-hover:text-[#F45A0A] block transition-colors">
                        {isAr ? 'اسحب لقطة الشاشة هنا أو اختر ملفًا' : 'Drag screenshot here or browse file'}
                      </span>
                      <span className="text-[11.5px] text-[#9CA3AF] block mt-0.5">
                        {isAr ? 'PNG أو JPG — الحد الأقصى 5 ميغابايت' : 'PNG or JPG — Max 5MB'}
                      </span>
                    </div>
                  </button>
                )}

                {errors.screenshot && (
                  <p className="text-[12px] font-medium text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{errors.screenshot}</span>
                  </p>
                )}
              </div>

              {/* 6. TECHNICAL METADATA */}
              <div className="border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTechInfo((prev) => !prev)}
                  className="flex items-center justify-between w-full text-[12px] font-medium text-[#6B7280] hover:text-slate-900 transition-colors cursor-pointer py-1"
                >
                  <div className="flex items-center gap-1.5">
                    <Info size={13} className="text-[#F45A0A]" />
                    <span>{isAr ? 'معلومات تقنية' : 'Technical Details'}</span>
                  </div>
                  {showTechInfo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showTechInfo && (
                  <div className="mt-2 p-3 bg-[#FAFAFA] rounded-[9px] border border-[#E5E7EB] text-[11px] font-mono text-slate-600 space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex justify-between">
                      <span className="text-slate-400">{isAr ? 'الصفحة:' : 'Page:'}</span>
                      <span className="font-bold text-slate-700 truncate max-w-[280px]" title={window.location.href}>
                        {window.location.pathname}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{isAr ? 'المستخدم:' : 'User:'}</span>
                      <span className="font-bold text-slate-700">{user?.name || (isAr ? 'مستخدم مسجل' : 'Registered User')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{isAr ? 'الشركة:' : 'Company:'}</span>
                      <span className="font-bold text-slate-700">{activeCompanyName}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Error banner if mutation failed */}
              {feedbackMutation.isError && (
                <div className="p-3 bg-red-50 rounded-[10px] border border-red-200 text-xs text-red-700 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0 text-red-600" />
                    <span>{isAr ? 'تعذر إرسال البلاغ. يرجى إعادة المحاولة.' : 'Failed to submit feedback. Please retry.'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="text-xs font-bold text-red-700 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <RefreshCw size={12} />
                    <span>{isAr ? 'إعادة المحاولة' : 'Retry'}</span>
                  </button>
                </div>
              )}
            </form>
          )}
        </div>

        {/* ── C. STICKY FOOTER ACTION BAR ── */}
        {!submitted && (
          <div className="px-5 py-4 border-t border-[#E5E7EB] bg-white shrink-0 sticky bottom-0 z-10">
            <button
              type="submit"
              form="feedback-form"
              disabled={feedbackMutation.isPending}
              className="w-full h-12 bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-semibold text-[14px] rounded-[10px] flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {feedbackMutation.isPending ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  <span>{isAr ? 'جارٍ إرسال البلاغ...' : 'Submitting ticket...'}</span>
                </>
              ) : (
                <>
                  <Send size={17} />
                  <span>{isAr ? 'إرسال البلاغ والملاحظة' : 'Submit Feedback & Ticket'}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── 4. FULLSCREEN SCREENSHOT PREVIEW MODAL ── */}
      {previewOpen && screenshotBase64 && (
        <div
          className="fixed inset-0 z-[10002] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-white rounded-xl p-2 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-800 shadow-md flex items-center justify-center font-bold hover:bg-slate-100 cursor-pointer"
            >
              <X size={16} />
            </button>
            <img
              src={screenshotBase64}
              alt="Full Preview"
              className="max-h-[85vh] w-auto max-w-full rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackFloatingDrawer;
