import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, invalidateApiCache } from '../api/client';
import { branchesApi, Branch } from '../api/branches';
import { useAuthStore } from '../store/useAuthStore';
import { BranchWorkspaceSelector, BranchWorkspaceOption } from '../components/auth/BranchWorkspaceSelector';
import { PasswordField } from '../components/auth/PasswordField';
import { LoginStatusMessage, LoginStatusType } from '../components/auth/LoginStatusMessage';
import { showSuccessNotification } from '../utils/notifications';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Languages,
  Loader2,
  Lock,
  Mail,
  Plane,
  QrCode,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';

type LoginLanguage = 'ar' | 'en';
type LoginMethod = 'email' | 'username';
type ScanState = 'idle' | 'loading' | 'success' | 'error';

const COPY = {
  ar: {
    pageTitle: 'تسجيل الدخول | QAYD Travel Accounting',
    switchLanguage: 'Switch to English',
    switchLanguageShort: 'EN',
    switchLanguageFull: 'English',
    secureBadge: 'دخول آمن إلى مساحة شركتك',
    title: 'مرحباً بعودتك',
    subtitle: 'سجّل الدخول لإدارة الحجوزات والحسابات من مساحة عمل واحدة.',
    emailTab: 'البريد الإلكتروني',
    usernameTab: 'اسم المستخدم',
    emailLabel: 'البريد الإلكتروني',
    usernameLabel: 'اسم المستخدم',
    emailPlaceholder: 'name@company.com',
    usernamePlaceholder: 'أدخل اسم المستخدم',
    rememberMe: 'تذكر البريد أو اسم المستخدم',
    submit: 'تسجيل الدخول',
    verifying: 'جارٍ التحقق…',
    authenticated: 'تمت المصادقة بنجاح',
    requiredFields: 'أدخل بيانات الدخول للمتابعة',
    emailRequired: 'أدخل البريد الإلكتروني',
    usernameRequired: 'أدخل اسم المستخدم',
    passwordRequired: 'أدخل كلمة المرور',
    invalidEmail: 'تحقق من صيغة البريد الإلكتروني',
    shortPassword: 'كلمة المرور يجب أن تتكون من 6 أحرف على الأقل',
    authenticatedMessage: 'تمت المصادقة بنجاح…',
    offline: 'تعذر الاتصال بالخادم — تحقق من اتصال الشبكة ثم أعد المحاولة',
    disabled: 'هذا الحساب معطّل — تواصل مع مدير النظام',
    invalidCredentials: 'البريد الإلكتروني أو اسم المستخدم أو كلمة المرور غير صحيحة',
    genericError: 'تعذر تسجيل الدخول. تحقق من البيانات ثم حاول مجدداً',
    noBranches: 'لا توجد فروع نشطة متاحة لهذا الحساب — تواصل مع مدير النظام',
    forgotHelp: 'لإعادة ضبط كلمة المرور، تواصل مع مدير النظام في شركتك.',
    trial: 'ابدأ فترة تجريبية مجانية لمدة 14 يوماً',
    security: 'اتصال مشفّر وآمن بمعايير مؤسسية',
    visualEyebrow: 'بوابة العمليات المالية',
    visualTitle: 'من الحجز إلى القيد، في مساحة واحدة.',
    visualSubtitle: 'إدارة حسابات السفر والفروع والصلاحيات بوضوح ودقة.',
    visualSystem: 'منظومة QAYD لإدارة وحسابات السفر',
    visualAlt: '',
    branchSelectedTitle: 'تم اختيار الفرع',
    signedDirectly: 'تم تسجيل الدخول مباشرة',
    signedSuccessfully: 'تم تسجيل الدخول بنجاح',
    welcome: 'مرحباً بك',
  },
  en: {
    pageTitle: 'Sign in | QAYD Travel Accounting',
    switchLanguage: 'التحويل إلى العربية',
    switchLanguageShort: 'AR',
    switchLanguageFull: 'العربية',
    secureBadge: 'Secure access to your company workspace',
    title: 'Welcome back',
    subtitle: 'Sign in to manage bookings and accounts from one workspace.',
    emailTab: 'Email address',
    usernameTab: 'Username',
    emailLabel: 'Email address',
    usernameLabel: 'Username',
    emailPlaceholder: 'name@company.com',
    usernamePlaceholder: 'Enter your username',
    rememberMe: 'Remember email or username',
    submit: 'Sign in',
    verifying: 'Verifying…',
    authenticated: 'Authenticated',
    requiredFields: 'Enter your sign-in details to continue',
    emailRequired: 'Enter your email address',
    usernameRequired: 'Enter your username',
    passwordRequired: 'Enter your password',
    invalidEmail: 'Check the email address format',
    shortPassword: 'Password must contain at least 6 characters',
    authenticatedMessage: 'Authenticated successfully…',
    offline: 'Cannot reach the server — check your connection and try again',
    disabled: 'This account is disabled — contact your system administrator',
    invalidCredentials: 'The email, username, or password is incorrect',
    genericError: 'Unable to sign in. Check your details and try again',
    noBranches: 'No active branches are available for this account — contact your administrator',
    forgotHelp: 'Contact your company system administrator to reset your password.',
    trial: 'Start a free 14-day trial',
    security: 'Enterprise-grade encrypted connection',
    visualEyebrow: 'Financial operations gateway',
    visualTitle: 'From booking to ledger, in one workspace.',
    visualSubtitle: 'Manage travel accounts, branches, and access with clarity.',
    visualSystem: 'QAYD Travel Accounting Platform',
    visualAlt: '',
    branchSelectedTitle: 'Branch selected',
    signedDirectly: 'Signed in directly',
    signedSuccessfully: 'Signed in successfully',
    welcome: 'Welcome',
  },
} as const;

const LOGIN_SLIDES = {
  ar: [
    {
      id: 'einstein-1',
      eyebrow: 'الذكاء المحاسبي الخارق',
      title: '«المنطق ينقلك من أ إلى ب، والخيال يأخذك إلى كل مكان»',
      subtitle: 'نظام محاسبي ذكي يختصر الزمن ويعيد صياغة معادلات السفر بدقة استثنائية.',
      formula: 'E = mc²',
      formulaDesc: 'طاقة = كتلة × مربع سرعة الضوء',
      author: '— ألبرت أينشتاين',
      image: '/images/einstein-iraq.png',
      imageType: 'avatar',
    },
    {
      id: 'business',
      eyebrow: 'بوابة العمليات المالية',
      title: 'من الحجز إلى القيد، في مساحة واحدة متكاملة',
      subtitle: 'إدارة حسابات السفر والتذاكر والفروع والصلاحيات بوضوح وسرعة قياسية.',
      formula: '∑ Revenue - ∑ Cost = Profit',
      formulaDesc: 'معادلة التوازن المالي الذكي',
      author: 'منظومة QAYD المتكاملة',
      image: '/assets/business-report.svg',
      imageType: 'illustration',
    },
    {
      id: 'einstein-2',
      eyebrow: 'النسبية والسرعة في الإنجاز',
      title: '«التعليم ليس حفظ الحقائق، بل تدريب العقل على التفكير والابتكار»',
      subtitle: 'مساعد الذكاء الاصطناعي يحلل قيودك ويستخرج التقارير في أجزاء من الثانية.',
      formula: "ΔS ≥ 0  |  t' = t / √(1 - v²/c²)",
      formulaDesc: 'معادلة تمدد الزمن والإنتاجية',
      author: '— أينشتاين العراق',
      image: '/images/einstein-iraq.png',
      imageType: 'avatar',
    },
  ],
  en: [
    {
      id: 'einstein-1',
      eyebrow: 'Supercharged Accounting AI',
      title: '“Logic gets you from A to B. Imagination takes you everywhere.”',
      subtitle: 'An intelligent accounting system redefining travel financial management with precision.',
      formula: 'E = mc²',
      formulaDesc: 'Energy = Mass × Speed of Light²',
      author: '— Albert Einstein',
      image: '/images/einstein-iraq.png',
      imageType: 'avatar',
    },
    {
      id: 'business',
      eyebrow: 'Financial Operations Hub',
      title: 'From Booking to Ledger, All in One Unified Workspace',
      subtitle: 'Manage travel accounts, tickets, branches, and permissions with total clarity.',
      formula: '∑ Revenue - ∑ Cost = Profit',
      formulaDesc: 'Smart Financial Equilibrium',
      author: 'QAYD Enterprise System',
      image: '/assets/business-report.svg',
      imageType: 'illustration',
    },
    {
      id: 'einstein-2',
      eyebrow: 'Relativity & Speed',
      title: '“Education is not the learning of facts, but the training of the mind to think.”',
      subtitle: 'AI assistant analyzes journal entries and compiles deep analytics in sub-seconds.',
      formula: "ΔS ≥ 0  |  t' = t / √(1 - v²/c²)",
      formulaDesc: 'Time Dilation & High Productivity',
      author: '— Einstein of Iraq',
      image: '/images/einstein-iraq.png',
      imageType: 'avatar',
    },
  ],
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clearActiveBranchContext = () => {
  localStorage.removeItem('active_branch_id');
  localStorage.removeItem('activeBranchId');
  localStorage.removeItem('activeBranchCode');
  localStorage.removeItem('activeBranchName');
  invalidateApiCache();
};

const persistActiveBranchContext = (branch: BranchWorkspaceOption) => {
  if (!branch.id || branch.id === 'default-branch') {
    clearActiveBranchContext();
    return;
  }

  localStorage.setItem('active_branch_id', branch.id);
  localStorage.setItem('activeBranchId', branch.id);
  localStorage.setItem('activeBranchCode', branch.code);
  localStorage.setItem('activeBranchName', branch.name);
  localStorage.setItem('last_selected_branch_id', branch.id);
  invalidateApiCache();
};

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [isDeparting, setIsDeparting] = useState(false);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [statusMessage, setStatusMessage] = useState<{ type: LoginStatusType; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    identifier?: string;
    password?: string;
  }>({});

  const [lang, setLang] = useState<LoginLanguage>(() =>
    localStorage.getItem('login_language') === 'en' ? 'en' : 'ar',
  );
  const [identifier, setIdentifier] = useState(() => localStorage.getItem('remembered_identifier') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem('remembered_identifier')));
  const [loginMethod, setLoginMethod] = useState<LoginMethod>(() =>
    localStorage.getItem('remembered_login_method') === 'username' ? 'username' : 'email',
  );

  const [showBranchSelector, setShowBranchSelector] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [userBranches, setUserBranches] = useState<BranchWorkspaceOption[]>([]);

  const identifierRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<number[]>([]);
  const documentDefaultsRef = useRef({
    title: document.title,
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
  });
  const { token, user, setAuth } = useAuthStore();
  const navigate = useNavigate();
  const isAr = lang === 'ar';
  const t = COPY[lang];
  const slides = isAr ? LOGIN_SLIDES.ar : LOGIN_SLIDES.en;
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const slideTimer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5200);
    return () => clearInterval(slideTimer);
  }, [slides.length]);

  // If already authenticated with active session, redirect directly to dashboard
  useEffect(() => {
    if (token && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [token, user, navigate]);

  const schedule = (callback: () => void, delay: number) => {
    const timerId = window.setTimeout(callback, delay);
    timersRef.current.push(timerId);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.title = t.pageTitle;
    localStorage.setItem('login_language', lang);
  }, [isAr, lang, t.pageTitle]);

  useEffect(() => {
    const timers = timersRef.current;
    const documentDefaults = documentDefaultsRef.current;
    if (window.matchMedia('(min-width: 768px)').matches) {
      identifierRef.current?.focus({ preventScroll: true });
    }
    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
      document.title = documentDefaults.title;
      document.documentElement.lang = documentDefaults.lang;
      document.documentElement.dir = documentDefaults.dir;
    };
  }, []);

  const resetFeedback = (field?: 'identifier' | 'password') => {
    if (statusMessage?.type !== 'success') setStatusMessage(null);
    if (scanState === 'error') setScanState('idle');
    setFieldErrors((current) => (field ? { ...current, [field]: undefined } : {}));
  };

  const handleLangSwitch = () => {
    setStatusMessage(null);
    setFieldErrors({});
    setLang((current) => (current === 'ar' ? 'en' : 'ar'));
  };

  const handleMethodChange = (method: LoginMethod) => {
    setLoginMethod(method);
    resetFeedback();
    window.requestAnimationFrame(() => identifierRef.current?.focus());
  };

  const validateForm = () => {
    const normalizedIdentifier = identifier.trim();
    const errors: { identifier?: string; password?: string } = {};

    if (!normalizedIdentifier) {
      errors.identifier = loginMethod === 'email' ? t.emailRequired : t.usernameRequired;
    } else if (loginMethod === 'email' && !EMAIL_PATTERN.test(normalizedIdentifier)) {
      errors.identifier = t.invalidEmail;
    }

    if (!password) {
      errors.password = t.passwordRequired;
    } else if (password.length < 6) {
      errors.password = t.shortPassword;
    }

    setFieldErrors(errors);
    if (errors.identifier) {
      identifierRef.current?.focus();
    } else if (errors.password) {
      document.getElementById('login-password')?.focus();
    }

    return Object.keys(errors).length === 0;
  };

  const handleLoginSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading || isSuccessState || isDeparting || !validateForm()) return;

    const normalizedIdentifier = identifier.trim();
    setStatusMessage(null);
    setLoading(true);
    setScanState('loading');
    let provisionalSessionStored = false;

    try {
      const backendData = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: normalizedIdentifier, password }),
      });

      if (!backendData?.user || !backendData?.accessToken) throw new Error('AUTH_FAILED');

      const userProfile = backendData.user;
      const token = backendData.accessToken;

      if (rememberMe) {
        localStorage.setItem('remembered_identifier', normalizedIdentifier);
        localStorage.setItem('remembered_login_method', loginMethod);
      } else {
        localStorage.removeItem('remembered_identifier');
        localStorage.removeItem('remembered_login_method');
      }

      localStorage.setItem('token', token);
      sessionStorage.setItem('token', token);
      provisionalSessionStored = true;
      // Never let a branch from a previous session leak into this user's requests.
      clearActiveBranchContext();

      setIsSuccessState(true);
      setScanState('success');
      setStatusMessage({ type: 'success', text: t.authenticatedMessage });

      let realBranches: Branch[];
      try {
        realBranches = await branchesApi.getLoginOptions();
      } catch {
        throw new Error('BRANCHES_UNAVAILABLE');
      }

      if (!Array.isArray(realBranches) || realBranches.length === 0) {
        throw new Error('NO_BRANCHES');
      }

      const workspaceBranches: BranchWorkspaceOption[] = realBranches.map((branch) => ({
        id: branch.id,
        name: isAr
          ? branch.nameAr || branch.nameEn || 'فرع'
          : branch.nameEn || branch.nameAr || 'Branch',
        code: branch.code || 'BR-01',
        city: branch.city || (isAr ? 'العراق' : 'Iraq'),
        logo: branch.logo,
        role: userProfile.role,
        lastActive: branch.isMain ? (isAr ? 'الفرع الرئيسي' : 'Main branch') : isAr ? 'نشط' : 'Active',
      }));

      const savedDefaultId = localStorage.getItem('default_branch_id');
      const autoSelectDefault = localStorage.getItem('auto_select_default_branch') !== 'false';
      const defaultBranch =
        autoSelectDefault && savedDefaultId
          ? workspaceBranches.find((branch) => branch.id === savedDefaultId)
          : null;

      schedule(() => setIsDeparting(true), 180);
      schedule(() => {
        if (defaultBranch) {
          persistActiveBranchContext(defaultBranch);
          setAuth(
            {
              ...userProfile,
              activeBranchId: defaultBranch.id,
              activeBranchName: defaultBranch.name,
              activeBranchCode: defaultBranch.code,
            },
            token,
          );
          showSuccessNotification(t.welcome, `${t.signedDirectly} — ${defaultBranch.name}`);
          navigate('/dashboard');
          setLoading(false);
        } else if (workspaceBranches.length > 1) {
          setIsDeparting(false);
          setPendingUser({ userProfile, token });
          setUserBranches(workspaceBranches);
          setShowBranchSelector(true);
          setLoading(false);
        } else {
          const selectedBranch = workspaceBranches[0];
          persistActiveBranchContext(selectedBranch);
          setAuth(
            {
              ...userProfile,
              activeBranchId: selectedBranch.id,
              activeBranchName: selectedBranch.name,
              activeBranchCode: selectedBranch.code,
            },
            token,
          );
          showSuccessNotification(
            t.welcome,
            `${t.signedSuccessfully}${userProfile.companyName ? ` — ${userProfile.companyName}` : ''}`,
          );
          navigate('/dashboard');
          setLoading(false);
        }
      }, 460);
    } catch (error: any) {
      if (provisionalSessionStored) {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        clearActiveBranchContext();
      }
      setLoading(false);
      setIsSuccessState(false);
      setIsDeparting(false);
      setScanState('error');
      schedule(() => setScanState('idle'), 1400);

      const message = String(error?.message || '');
      if (message === 'NO_BRANCHES') {
        setStatusMessage({ type: 'no_branch', text: t.noBranches });
      } else if (
        message.includes('Failed to fetch') ||
        message === 'OFFLINE' ||
        message === 'BRANCHES_UNAVAILABLE' ||
        message.includes('الخادم الخلفي غير متصل') ||
        message.includes('استغرق الخادم وقتاً طويلاً') ||
        message.includes('تعذر الاتصال')
      ) {
        setStatusMessage({ type: 'offline', text: t.offline });
      } else if (message.includes('معطل') || message.toLowerCase().includes('disabled')) {
        setStatusMessage({ type: 'disabled', text: t.disabled });
      } else if (
        message.includes('غير صحيحة') ||
        message === 'AUTH_FAILED' ||
        message.toLowerCase().includes('unauthorized')
      ) {
        setStatusMessage({ type: 'error', text: t.invalidCredentials });
      } else {
        setStatusMessage({ type: 'error', text: t.genericError });
      }
    }
  };

  const handleSelectBranch = (branch: BranchWorkspaceOption, rememberAsDefault?: boolean) => {
    if (!pendingUser) return;
    if (rememberAsDefault) {
      localStorage.setItem('default_branch_id', branch.id);
      localStorage.setItem('auto_select_default_branch', 'true');
    }
    persistActiveBranchContext(branch);
    setAuth(
      {
        ...pendingUser.userProfile,
        activeBranchId: branch.id,
        activeBranchName: branch.name,
        activeBranchCode: branch.code,
        role: branch.role,
      },
      pendingUser.token,
    );
    showSuccessNotification(t.branchSelectedTitle, branch.name);
    setShowBranchSelector(false);
    navigate('/dashboard');
  };

  const canSubmit = !loading && !isSuccessState && !isDeparting;
  const notchX = isAr ? '52%' : '48%';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  return (
    <div
      className="login-page min-h-[100dvh] w-full overflow-x-hidden bg-[#F3F6FA] text-[#17243D]"
      dir={isAr ? 'rtl' : 'ltr'}
      style={{ fontFamily: "'IBM Plex Sans Arabic', 'Inter', system-ui, sans-serif" }}
    >
      <style>{`
        .login-page {
          background-image:
            radial-gradient(circle at 12% 8%, rgba(255, 95, 10, 0.055), transparent 25rem),
            radial-gradient(circle at 88% 92%, rgba(23, 36, 61, 0.045), transparent 28rem);
        }
        @keyframes barcodeEntrance {
          from { transform: scaleY(0); opacity: 0; }
          to { transform: scaleY(1); opacity: 1; }
        }
        @keyframes scannerSweepIdle {
          0%, 12% { transform: translateX(125%); opacity: 0; }
          22%, 46% { opacity: .85; }
          58%, 100% { transform: translateX(-125%); opacity: 0; }
        }
        @keyframes scannerSweepFast {
          from { transform: translateX(125%); opacity: 1; }
          to { transform: translateX(-125%); opacity: 1; }
        }
        @keyframes reticleLockAnim {
          0%, 100% { transform: scale(1.04); opacity: .55; }
          50% { transform: scale(1); opacity: 1; }
        }
        .barcode-bar-anim {
          animation: barcodeEntrance .65s cubic-bezier(.16, 1, .3, 1) both;
          transform-origin: bottom;
        }
        .scanner-laser-idle { animation: scannerSweepIdle 4.2s ease-in-out infinite; }
        .scanner-laser-loading { animation: scannerSweepFast .85s linear infinite; }
        .scanner-laser-success { animation: scannerSweepFast .55s ease-out 1; }
        .reticle-lock { animation: reticleLockAnim 3.2s ease-in-out infinite; }
        .login-control:focus-visible,
        .login-page a:focus-visible,
        .login-page button:focus-visible {
          outline: 3px solid rgba(255, 95, 10, .28);
          outline-offset: 3px;
        }
        @media (min-width: 1024px) {
          .login-ticket-shell {
            -webkit-mask:
              radial-gradient(circle 16px at var(--ticket-notch-x) 0, transparent 15px, #000 16px) top / 100% 51% no-repeat,
              radial-gradient(circle 16px at var(--ticket-notch-x) 100%, transparent 15px, #000 16px) bottom / 100% 51% no-repeat;
            mask:
              radial-gradient(circle 16px at var(--ticket-notch-x) 0, transparent 15px, #000 16px) top / 100% 51% no-repeat,
              radial-gradient(circle 16px at var(--ticket-notch-x) 100%, transparent 15px, #000 16px) bottom / 100% 51% no-repeat;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .login-page *, .login-page *::before, .login-page *::after {
            scroll-behavior: auto !important;
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>

      <header className="border-b border-[#E2E8F0] bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.02)] backdrop-blur">
        <div className="mx-auto flex min-h-[68px] w-full max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-2.5" aria-label="QAYD Travel Accounting">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-[#FF5F0A]/20 bg-[#FFF4ED] text-[#FF5F0A] shadow-[0_4px_12px_rgba(255,95,10,0.08)]">
              <Plane size={19} className="-rotate-45" aria-hidden="true" />
            </div>
            <div dir="ltr" className="min-w-0 whitespace-nowrap text-left font-black leading-none tracking-[-0.04em]">
              <span className="text-[19px] text-[#FF5F0A] sm:text-[22px]">QAYD</span>{' '}
              <span className="text-[18px] text-[#17243D] sm:hidden">Travel</span>
              <span className="hidden text-[21px] text-[#17243D] sm:inline">Travel Accounting</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLangSwitch}
            className="login-control flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[#DCE3EC] bg-white px-3 text-xs font-extrabold text-[#17243D] shadow-[0_3px_10px_rgba(15,23,42,0.035)] transition hover:border-[#FF5F0A]/35 hover:bg-[#FFF9F5] sm:px-3.5"
            title={t.switchLanguage}
            aria-label={t.switchLanguage}
          >
            <Languages size={16} className="text-[#FF5F0A]" aria-hidden="true" />
            <span className="sm:hidden" dir="ltr">{t.switchLanguageShort}</span>
            <span className="hidden sm:inline">{t.switchLanguageFull}</span>
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1280px] items-center justify-center px-3 py-5 sm:px-6 sm:py-8 lg:min-h-[calc(100dvh-69px)] lg:px-10 lg:py-6">
        <div
          className={`w-full max-w-[1150px] transition duration-500 ease-out ${
            isDeparting ? 'scale-[0.985] opacity-0' : 'scale-100 opacity-100'
          }`}
          style={{ filter: 'drop-shadow(0 24px 38px rgba(15, 23, 42, 0.10))' }}
        >
          <section
            className="login-ticket-shell relative flex w-full flex-col overflow-hidden rounded-[26px] border border-[#DEE5EE] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:min-h-[620px] lg:flex-row xl:min-h-[640px]"
            style={{ '--ticket-notch-x': notchX } as React.CSSProperties}
            aria-labelledby="login-heading"
          >
            <div
              className={`relative z-10 flex w-full flex-col justify-center bg-white px-5 py-7 transition-transform duration-500 sm:px-10 sm:py-10 lg:w-[48%] lg:px-12 lg:py-9 ${
                isDeparting ? (isAr ? 'translate-x-2' : '-translate-x-2') : 'translate-x-0'
              }`}
            >
              <div className="mx-auto w-full max-w-[430px]">
                <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#FF5F0A]/25 bg-[#FFF3EB] px-2.5 py-1 text-[11px] font-bold text-[#C2410C] sm:text-xs">
                  <ShieldCheck size={14} aria-hidden="true" />
                  <span>{t.secureBadge}</span>
                </div>

                <div className="mb-5">
                  <h1 id="login-heading" className="text-[27px] font-black leading-[1.25] tracking-[-0.035em] text-[#17243D] lg:text-[30px]">
                    {t.title}
                  </h1>
                  <p className="mt-1.5 max-w-[390px] text-[13px] font-medium leading-6 text-[#64748B] sm:text-[13.5px]">
                    {t.subtitle}
                  </p>
                </div>

                <div
                  className="relative mb-4 grid h-[52px] grid-cols-2 overflow-hidden rounded-xl border border-[#DCE3EC] bg-[#F1F5F9] p-1 text-xs font-bold"
                  role="group"
                  aria-label={isAr ? 'طريقة تسجيل الدخول' : 'Sign-in method'}
                >
                  <div
                    className={`pointer-events-none absolute bottom-1 top-1 z-0 w-[calc(50%-4px)] rounded-lg border border-[#DCE3EC] bg-white shadow-[0_2px_7px_rgba(15,23,42,0.08)] transition-[left,right] duration-300 ease-out ${
                      loginMethod === 'email'
                        ? isAr
                          ? 'right-1'
                          : 'left-1'
                        : isAr
                          ? 'right-[calc(50%+2px)]'
                          : 'left-[calc(50%+2px)]'
                    }`}
                    aria-hidden="true"
                  />
                  {(['email', 'username'] as const).map((method) => {
                    const active = loginMethod === method;
                    const MethodIcon = method === 'email' ? Mail : User;
                    return (
                      <button
                        key={method}
                        type="button"
                        aria-pressed={active}
                        onClick={() => handleMethodChange(method)}
                        className={`login-control relative z-10 flex h-full items-center justify-center gap-2 rounded-lg px-2 transition-colors ${
                          active ? 'font-black text-[#17243D]' : 'text-[#64748B] hover:text-[#17243D]'
                        }`}
                      >
                        <MethodIcon size={15} className={active ? 'text-[#FF5F0A]' : ''} aria-hidden="true" />
                        <span>{method === 'email' ? t.emailTab : t.usernameTab}</span>
                      </button>
                    );
                  })}
                </div>

                {statusMessage && (
                  <div className="mb-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <LoginStatusMessage
                      type={statusMessage.type}
                      message={statusMessage.text}
                      onRetry={() => handleLoginSubmit({ preventDefault: () => undefined } as React.FormEvent)}
                      lang={lang}
                    />
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-3.5" noValidate>
                  <div className="space-y-1.5">
                    <label htmlFor="login-identifier" className="block text-xs font-bold text-[#17243D]">
                      {loginMethod === 'email' ? t.emailLabel : t.usernameLabel}
                      <span className={isAr ? 'mr-1 text-rose-500' : 'ml-1 text-rose-500'} aria-hidden="true">*</span>
                    </label>
                    <div className="group relative">
                      {loginMethod === 'email' ? (
                        <Mail
                          size={17}
                          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#FF5F0A] ${
                            isAr ? 'right-3.5' : 'left-3.5'
                          }`}
                          aria-hidden="true"
                        />
                      ) : (
                        <User
                          size={17}
                          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#FF5F0A] ${
                            isAr ? 'right-3.5' : 'left-3.5'
                          }`}
                          aria-hidden="true"
                        />
                      )}
                      <input
                        ref={identifierRef}
                        id="login-identifier"
                        name="identifier"
                        type={loginMethod === 'email' ? 'email' : 'text'}
                        inputMode={loginMethod === 'email' ? 'email' : 'text'}
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                        autoComplete={loginMethod === 'email' ? 'email' : 'username'}
                        value={identifier}
                        onChange={(event) => {
                          setIdentifier(event.target.value);
                          resetFeedback('identifier');
                        }}
                        disabled={loading || isSuccessState}
                        placeholder={loginMethod === 'email' ? t.emailPlaceholder : t.usernamePlaceholder}
                        dir={loginMethod === 'email' ? 'ltr' : 'auto'}
                        aria-invalid={
                          fieldErrors.identifier || statusMessage?.type === 'error' ? 'true' : undefined
                        }
                        aria-describedby={fieldErrors.identifier ? 'login-identifier-error' : undefined}
                        className={`login-control h-[52px] w-full animate-none rounded-xl border border-[#94A3B8] bg-[#F8FAFC] text-base font-semibold text-[#17243D] placeholder:font-normal placeholder:text-[#64748B] transition-none hover:border-[#64748B] focus:border-[#C2410C] focus:bg-white focus:placeholder:text-[#94A3B8] focus:outline-none focus:ring-[3px] focus:ring-[#FF5F0A]/18 disabled:cursor-not-allowed disabled:opacity-65 sm:text-sm ${
                          isAr ? 'pl-4 pr-11 text-left' : 'pl-11 pr-4 text-left'
                        }`}
                      />
                    </div>
                    {fieldErrors.identifier && (
                      <p
                        id="login-identifier-error"
                        role="alert"
                        className="text-xs font-semibold text-rose-700"
                      >
                        {fieldErrors.identifier}
                      </p>
                    )}
                  </div>

                  <PasswordField
                    id="login-password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      resetFeedback('password');
                    }}
                    disabled={loading || isSuccessState}
                    required
                    autoComplete="current-password"
                    lang={lang}
                    isDark={false}
                    onForgotPassword={() => setStatusMessage({ type: 'info', text: t.forgotHelp })}
                    invalid={statusMessage?.type === 'error'}
                    error={fieldErrors.password}
                  />

                  <div className="flex items-center justify-between pt-0.5">
                    <label className="group flex min-h-8 cursor-pointer select-none items-center gap-2.5 rounded-lg text-xs font-bold text-[#17243D]">
                      <span className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(event) => setRememberMe(event.target.checked)}
                          disabled={loading || isSuccessState}
                          className="peer sr-only"
                        />
                        <span
                          className={`flex h-[19px] w-[19px] items-center justify-center rounded-[6px] border-2 transition peer-focus-visible:ring-[3px] peer-focus-visible:ring-[#FF5F0A]/20 peer-focus-visible:ring-offset-2 ${
                            rememberMe
                              ? 'border-[#FF5F0A] bg-[#FF5F0A] shadow-[0_2px_6px_rgba(255,95,10,0.22)]'
                              : 'border-[#CBD5E1] bg-white group-hover:border-[#94A3B8]'
                          }`}
                          aria-hidden="true"
                        >
                          <Check
                            size={12}
                            className={`stroke-[3] text-white transition ${rememberMe ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
                          />
                        </span>
                      </span>
                      <span>{t.rememberMe}</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className={`login-control flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-black transition duration-200 ${
                      isSuccessState
                        ? 'bg-emerald-600 text-white shadow-[0_8px_18px_rgba(5,150,105,0.20)]'
                        : canSubmit
                          ? 'bg-[#C2410C] text-white shadow-[0_8px_18px_rgba(194,65,12,0.22)] hover:-translate-y-px hover:bg-[#9A3412] hover:shadow-[0_10px_22px_rgba(194,65,12,0.28)] active:translate-y-0 active:scale-[0.995]'
                          : 'cursor-not-allowed border border-[#E2E8F0] bg-[#EEF2F6] text-[#94A3B8] shadow-none'
                    }`}
                  >
                    {isSuccessState ? (
                      <>
                        <CheckCircle2 size={18} aria-hidden="true" />
                        <span>{t.authenticated}</span>
                      </>
                    ) : loading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                        <span>{t.verifying}</span>
                      </>
                    ) : (
                      <>
                        <span>{t.submit}</span>
                        <ArrowIcon size={17} aria-hidden="true" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-4 border-t border-[#E2E8F0] pt-3 text-center">
                  <a
                    href="/onboarding"
                    className="login-control inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-black text-[#C2410C] underline decoration-[#FF5F0A]/35 underline-offset-4 transition hover:text-[#9A3412]"
                  >
                    <Sparkles size={13} aria-hidden="true" />
                    <span>{t.trial}</span>
                  </a>
                  <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#64748B]">
                    <Lock size={12} className="text-[#FF5F0A]" aria-hidden="true" />
                    <span>{t.security}</span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="pointer-events-none absolute bottom-6 top-6 z-20 hidden w-0 -translate-x-1/2 flex-col items-center lg:flex"
              style={{ [isAr ? 'right' : 'left']: '48%' }}
              aria-hidden="true"
            >
              <div
                className="h-full w-[2px] transition-all duration-300"
                style={{
                  backgroundImage: isDeparting
                    ? 'repeating-linear-gradient(to bottom, #FF5F0A 0, #FF5F0A 8px, transparent 8px, transparent 14px)'
                    : 'repeating-linear-gradient(to bottom, #CBD5E1 0, #CBD5E1 7px, transparent 7px, transparent 13px)',
                  filter: isDeparting ? 'drop-shadow(0 0 4px #FF5F0A)' : 'none',
                }}
              />
            </div>

            <div
              className={`relative hidden w-full flex-col items-center justify-between overflow-hidden bg-[#FFFAF5] p-7 transition-transform duration-500 lg:flex lg:w-[52%] ${
                isDeparting ? (isAr ? '-translate-x-2' : 'translate-x-2') : 'translate-x-0'
              }`}
            >
              <div className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full bg-[#FF5F0A]/[0.045] blur-2xl" />
              <div className="pointer-events-none absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-[#17243D]/[0.035] blur-2xl" />

              <div className="relative z-10 flex w-full items-center justify-between gap-4 border-b border-[#E2E8F0] pb-3" dir="ltr">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="whitespace-nowrap rounded-md border border-[#FF5F0A]/25 bg-[#FFF1E8] px-2 py-1 text-[10px] font-black tracking-[0.08em] text-[#E95408]">
                    SECURE ACCESS
                  </span>
                  <span className="whitespace-nowrap text-xs font-black tracking-wide text-[#17243D]">BOOKING → ERP</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold text-[#64748B]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.10)]" />
                  <span>SYSTEM ONLINE</span>
                </div>
              </div>

              <div className="relative z-10 flex w-full flex-1 items-center justify-center py-2">
                <div className="grid w-full grid-cols-[minmax(0,1fr)] items-center">
                  {slides.map((slide, index) => {
                    const isActive = index === activeSlide;
                    return (
                      <div
                        key={slide.id}
                        className={`col-start-1 row-start-1 mx-auto flex w-full max-w-[500px] flex-col items-center text-center transition-all duration-700 ${
                          isActive ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
                        }`}
                      >
                        <p className="mb-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#E95408]">
                          {slide.eyebrow}
                        </p>
                        <h2 className="mx-auto max-w-[440px] text-[20px] font-black leading-[1.38] tracking-[-0.02em] text-[#17243D]">
                          {slide.title}
                        </h2>
                        <p className="mx-auto mt-1 max-w-[420px] text-[12px] font-medium leading-5 text-[#64748B]">
                          {slide.subtitle}
                        </p>

                        {/* Mathematical / Physics Formula Badge */}
                        <div className="mt-2.5 inline-flex items-center gap-2 rounded-xl border border-[#FF5F0A]/20 bg-white/85 px-3 py-1.5 shadow-xs backdrop-blur-xs">
                          <span className="font-mono text-[12.5px] font-extrabold tracking-wider text-[#E95408]" dir="ltr">
                            {slide.formula}
                          </span>
                          <span className="text-[10.5px] font-bold text-slate-400">
                            • {slide.formulaDesc}
                          </span>
                        </div>

                        {/* Enlarged Image Display */}
                        <div className="relative mx-auto mt-3 flex h-[280px] w-full items-center justify-center">
                          {slide.imageType === 'avatar' ? (
                            <div className="relative group">
                              <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-[#FF5F0A]/25 via-[#FB923C]/20 to-transparent blur-xl animate-pulse pointer-events-none" />
                              <div className="relative h-[230px] w-[230px] rounded-full overflow-hidden ring-[5px] ring-white shadow-2xl shadow-orange-500/25 bg-gradient-to-b from-[#FFF5ED] to-white p-1">
                                <img
                                  src={slide.image}
                                  alt={slide.title}
                                  className="h-full w-full rounded-full object-cover select-none transition-transform duration-500 group-hover:scale-105"
                                  draggable={false}
                                />
                              </div>
                              <div className="absolute -bottom-2 inset-x-0 mx-auto w-fit px-3 py-0.5 rounded-full bg-slate-900/80 text-white text-[10.5px] font-bold shadow-md">
                                {slide.author}
                              </div>
                            </div>
                          ) : (
                            <img
                              src={slide.image}
                              alt={slide.title}
                              aria-hidden="true"
                              className="mx-auto h-[260px] w-full max-w-[420px] select-none object-contain drop-shadow-md"
                              draggable={false}
                            />
                          )}
                        </div>

                        {/* Interactive Slide Dots */}
                        <div className="mt-2 flex items-center justify-center gap-1.5">
                          {slides.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setActiveSlide(i)}
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                i === activeSlide ? 'w-6 bg-[#E95408]' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                              }`}
                              aria-label={`Go to slide ${i + 1}`}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative z-10 flex w-full items-center justify-between gap-4 border-t border-[#E2E8F0] pt-3">
                <div className="min-w-0">
                  <div className="text-[12px] font-black leading-5 text-[#17243D]">{t.visualSystem}</div>
                  <div className="mt-0.5 font-mono text-[10px] font-bold tracking-[0.08em] text-[#E95408]" dir="ltr">
                    QAYD SECURE LOGIN PASS
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3 rounded-xl border border-[#DCE3EC] bg-white px-3 py-2 shadow-[0_3px_10px_rgba(15,23,42,0.05)]" aria-hidden="true">
                  <div className="relative flex items-center justify-center p-1">
                    <div
                      className={`absolute -right-1 bottom-0 top-0 z-20 w-2 rounded-r border-b-2 border-r-2 border-t-2 transition ${
                        scanState === 'success'
                          ? 'border-emerald-500 shadow-[0_0_4px_#10B981]'
                          : scanState === 'error'
                            ? 'border-rose-500 shadow-[0_0_4px_#EF4444]'
                            : 'reticle-lock border-[#FF5F0A]'
                      }`}
                    />
                    <div
                      className={`absolute -left-1 bottom-0 top-0 z-20 w-2 rounded-l border-b-2 border-l-2 border-t-2 transition ${
                        scanState === 'success'
                          ? 'border-emerald-500 shadow-[0_0_4px_#10B981]'
                          : scanState === 'error'
                            ? 'border-rose-500 shadow-[0_0_4px_#EF4444]'
                            : 'reticle-lock border-[#FF5F0A]'
                      }`}
                    />
                    <div className="relative flex h-8 items-center gap-[2.5px] overflow-hidden px-1">
                      <div
                        className={`absolute inset-y-0 z-10 flex w-3 items-center justify-center bg-gradient-to-r from-transparent to-transparent ${
                          scanState === 'success'
                            ? 'scanner-laser-success via-emerald-500'
                            : scanState === 'loading'
                              ? 'scanner-laser-loading via-[#FF5F0A]'
                              : scanState === 'error'
                                ? 'via-rose-500'
                                : 'scanner-laser-idle via-[#FF5F0A]'
                        }`}
                      >
                        <span className="h-full w-[1.5px] bg-white shadow-[0_0_6px_currentColor]" />
                      </div>
                      {[2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 3, 1, 2, 4, 1, 2].map((width, index) => (
                        <span
                          key={`${width}-${index}`}
                          className="barcode-bar-anim h-full rounded-[0.5px] bg-[#17243D]"
                          style={{ width: `${width}px`, animationDelay: `${index * 15}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#17243D]">
                    <QrCode size={18} />
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {showBranchSelector && pendingUser && (
        <BranchWorkspaceSelector
          userName={pendingUser.userProfile.name}
          branches={userBranches}
          onSelectBranch={handleSelectBranch}
          loading={loading}
          lang={lang}
        />
      )}
    </div>
  );
};

export default LoginPage;
