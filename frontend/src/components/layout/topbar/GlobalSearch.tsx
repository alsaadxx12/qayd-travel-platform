import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  BookOpen,
  ListTree,
  Users,
  Receipt,
  Plane,
  FileText,
  PlusCircle,
  Clock,
  CornerDownLeft,
  X,
  Sparkles,
  FileCheck,
  Compass,
  Settings,
  RotateCcw,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useLanguageStore } from '../../../store/useLanguageStore';
import { accountsApi } from '../../../api/accounts';
import { partnersApi } from '../../../api/partners';
import { ticketsApi } from '../../../api/tickets';

interface SearchItem {
  id: string;
  category: 'ACTION' | 'PAGE' | 'ACCOUNT' | 'PARTNER' | 'TICKET' | 'VISA';
  titleAr: string;
  titleEn: string;
  subAr?: string;
  subEn?: string;
  code?: string;
  keywords?: string;
  icon: React.ReactNode;
  badge?: string;
  action: () => void;
}

export const GlobalSearch: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [recentQueries, setRecentQueries] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('__global_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const navigate = useNavigate();
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
      setSelectedCategory('ALL');
      setSelectedIndex(0);
    }
  }, [open]);

  // On-demand search query condition to minimize backend/database load
  const isSearchActive = open && (query.trim().length > 0 || (selectedCategory !== 'ALL' && selectedCategory !== 'ACTION' && selectedCategory !== 'PAGE'));

  // Fetch accounts data on-demand
  const { data: accountsData = [] } = useQuery({
    queryKey: ['global-search-accounts'],
    queryFn: () => accountsApi.getFlat(),
    staleTime: 60000,
    enabled: isSearchActive && (query.trim().length > 0 || selectedCategory === 'ACCOUNT'),
  });

  const flatAccounts = useMemo(() => {
    return Array.isArray(accountsData) ? accountsData : (accountsData as any)?.data || [];
  }, [accountsData]);

  // Fetch partners data on-demand
  const { data: customers = [] } = useQuery({
    queryKey: ['global-search-customers'],
    queryFn: () => partnersApi.getCustomers(),
    staleTime: 60000,
    enabled: isSearchActive && (query.trim().length > 0 || selectedCategory === 'PARTNER'),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ['global-search-suppliers'],
    queryFn: () => partnersApi.getSuppliers(),
    staleTime: 60000,
    enabled: isSearchActive && (query.trim().length > 0 || selectedCategory === 'PARTNER'),
  });

  const partnersList = useMemo(() => {
    const custs = (customers || []).map((c: any) => ({ ...c, partnerType: isAr ? 'عميل' : 'Customer' }));
    const supps = (suppliers || []).map((s: any) => ({ ...s, partnerType: isAr ? 'مورد' : 'Supplier' }));
    return [...custs, ...supps];
  }, [customers, suppliers, isAr]);

  // Fetch tickets & invoices data on-demand
  const { data: rawInvoicesList = [] } = useQuery({
    queryKey: ['global-search-tickets'],
    queryFn: () => ticketsApi.getAll(),
    staleTime: 60000,
    enabled: isSearchActive && (query.trim().length > 0 || selectedCategory === 'TICKET' || selectedCategory === 'VISA'),
  });


  // Separate Flights vs Visas
  const { ticketsList, visasList } = useMemo(() => {
    const all = Array.isArray(rawInvoicesList) ? rawInvoicesList : [];
    const tList: any[] = [];
    const vList: any[] = [];

    all.forEach((item: any) => {
      const isVisa =
        item.tripType === 'VISA' ||
        item.invoiceNumber?.startsWith('VISA-') ||
        item.invoiceNumber?.startsWith('KAB-VISA') ||
        item.airline?.includes('فيزا') ||
        item.airline?.includes('VISA') ||
        item.pnr?.includes('فيزا') ||
        item.pnr?.includes('VISA');

      if (isVisa) {
        vList.push(item);
      } else {
        tList.push(item);
      }
    });

    return { ticketsList: tList, visasList: vList };
  }, [rawInvoicesList]);

  // 1. Quick Action Shortcuts (Comprehensive Searchable Operations)
  const actionItems: SearchItem[] = useMemo(
    () => [
      {
        id: 'act-new-ticket',
        category: 'ACTION',
        titleAr: 'إصدار فاتورة تذاكر طيران جديدة',
        titleEn: 'Issue New Flight Ticket Invoice',
        subAr: 'فتح مساحة مبيعات التذاكر والتسعير السريع والمسافرين',
        subEn: 'Open flight tickets billing workspace & passenger setup',
        keywords: 'تذكرة تذاكر إصدار جديد طيران flight ticket new issue sales',
        icon: <Plane size={17} />,
        badge: isAr ? 'إجراء سريع' : 'Action',
        action: () => {
          navigate('/tickets?action=new');
          setOpen(false);
        },
      },
      {
        id: 'act-new-visa',
        category: 'ACTION',
        titleAr: 'إصدار فاتورة فيزا / تأشيرة جديدة',
        titleEn: 'Create New Visa Invoice',
        subAr: 'إصدار تأشيرات مفردة أو جماعية وتحديد الأسعار والمسافرين',
        subEn: 'Open new visa issuance workspace & passenger pricing',
        keywords: 'فيزا تأشيرة تأشيرات إصدار جديد visa new issue destination',
        icon: <FileCheck size={17} />,
        badge: isAr ? 'إجراء سريع' : 'Action',
        action: () => {
          navigate('/visas?action=new');
          setOpen(false);
        },
      },
      {
        id: 'act-refund',
        category: 'ACTION',
        titleAr: 'تسجيل استرجاع تذكرة / تأشيرة (Refund)',
        titleEn: 'Process Ticket / Visa Refund',
        subAr: 'حساب غرامات الاسترجاع وتسوية الرصيد مع العميل والمورد',
        subEn: 'Calculate cancellation penalty & adjust ledger balances',
        keywords: 'استرجاع ريفاوند refund void ترجيع إلغاء cancel غرامة penalty',
        icon: <RotateCcw size={17} />,
        badge: isAr ? 'استرجاع' : 'Refund',
        action: () => {
          navigate('/tickets?filter=refund');
          setOpen(false);
        },
      },
      {
        id: 'act-reissue',
        category: 'ACTION',
        titleAr: 'تعديل وتغيير موعد أو حجز (Change / Reissue)',
        titleEn: 'Ticket Change / Date Reissue',
        subAr: 'تغيير مواعيد السفر وإعادة الإصدار مع احتساب الفروقات',
        subEn: 'Process flight date change, fare difference & reissuance',
        keywords: 'تعديل تغيير موعد ريشيو reissue change date exchange فارق التكلفة',
        icon: <RefreshCw size={17} />,
        badge: isAr ? 'تغيير موعد' : 'Reissue',
        action: () => {
          navigate('/tickets?filter=reissue');
          setOpen(false);
        },
      },
      {
        id: 'act-groups',
        category: 'ACTION',
        titleAr: 'إدارة الكروبات والرحلات الجماعية (Groups & Packages)',
        titleEn: 'Group Bookings & Travel Packages',
        subAr: 'إصدار التذاكر والتأشيرات الجماعية وقوائم المسافرين للكروبات',
        subEn: 'Manage group manifests, shared pricing & packages',
        keywords: 'كروب كروبات رحلات جماعية مجموعات group groups package manifest حجز جماعي',
        icon: <Layers size={17} />,
        badge: isAr ? 'كروبات' : 'Groups',
        action: () => {
          navigate('/tickets?view=groups');
          setOpen(false);
        },
      },
      {
        id: 'act-new-voucher',
        category: 'ACTION',
        titleAr: 'إنشاء سند مالي (قبض / صرف)',
        titleEn: 'Create Financial Voucher (Receipt / Payment)',
        subAr: 'تحرير سند قبض نقدي أو سند صرف لمورد',
        subEn: 'Create cash/bank receipt or supplier payment voucher',
        keywords: 'سند سندات قبض صرف voucher receipt payment cash',
        icon: <Receipt size={17} />,
        badge: isAr ? 'إجراء سريع' : 'Action',
        action: () => {
          navigate('/vouchers?action=new');
          setOpen(false);
        },
      },
      {
        id: 'act-new-account',
        category: 'ACTION',
        titleAr: 'إضافة حساب جديد في شجرة الحسابات',
        titleEn: 'Add New Account to COA',
        subAr: 'فتح معالج إنشاء الحسابات الذكي وتحديد المسار الشجري',
        subEn: 'Open smart account creation wizard in COA hierarchy',
        keywords: 'حساب حسابات شجرة دليل coa account chart hierarchy',
        icon: <PlusCircle size={17} />,
        badge: isAr ? 'إجراء سريع' : 'Action',
        action: () => {
          navigate('/accounts?action=new');
          setOpen(false);
        },
      },
    ],
    [navigate, isAr]
  );

  // 2. Static System Screens
  const screenItems: SearchItem[] = useMemo(
    () => [
      {
        id: 'screen-dashboard',
        category: 'PAGE',
        titleAr: 'لوحة التحكم والمؤشرات',
        titleEn: 'Dashboard & KPI Metrics',
        subAr: 'نظرة عامة على الإحصائيات والأرباح والمبيعات',
        subEn: 'System overview, statistics & financial KPIs',
        keywords: 'لوحة التحكم الرئيسية مؤشرات إحصائيات dashboard stats kpi',
        icon: <Compass size={17} />,
        badge: isAr ? 'لوحة القيادة' : 'Dashboard',
        action: () => {
          navigate('/dashboard');
          setOpen(false);
        },
      },
      {
        id: 'screen-tickets',
        category: 'PAGE',
        titleAr: 'فواتير تذاكر الطيران',
        titleEn: 'Flight Tickets & Invoices',
        subAr: 'إدارة مبيعات وتكلفة التذاكر والمسافرين والتدقيق',
        subEn: 'Manage flight sales, passenger batching & auditing',
        keywords: 'تذاكر طيران رحلات tickets flights sales invoices',
        icon: <Plane size={17} />,
        badge: isAr ? 'تذاكر' : 'Tickets',
        action: () => {
          navigate('/tickets');
          setOpen(false);
        },
      },
      {
        id: 'screen-visas',
        category: 'PAGE',
        titleAr: 'فواتير التأشيرات والفيز',
        titleEn: 'Visa Invoices & Applications',
        subAr: 'إصدار التأشيرات، الموردين، وإدارة أنواع الفيز',
        subEn: 'Visa issuance, country types & customer billing',
        keywords: 'تأشيرات فيز فيزا سياحية visas applications destination',
        icon: <FileCheck size={17} />,
        badge: isAr ? 'تأشيرات' : 'Visas',
        action: () => {
          navigate('/visas');
          setOpen(false);
        },
      },
      {
        id: 'screen-coa',
        category: 'PAGE',
        titleAr: 'دليل وشجرة الحسابات (COA)',
        titleEn: 'Chart of Accounts (COA)',
        subAr: 'الشجرة الهرمية لكافة حسابات الأصول والخصوم والإيرادات والمصروفات',
        subEn: 'Hierarchical chart of accounts, assets & liabilities',
        keywords: 'دليل شجرة حسابات coa chart accounts ledger',
        icon: <ListTree size={17} />,
        badge: isAr ? 'دليل الحسابات' : 'COA',
        action: () => {
          navigate('/accounts');
          setOpen(false);
        },
      },
      {
        id: 'screen-journal',
        category: 'PAGE',
        titleAr: 'دفتر القيود اليومية',
        titleEn: 'Journal Entries Ledger',
        subAr: 'استعراض القيود المحاسبية، الترحيل والتدقيق',
        subEn: 'General ledger journal entries & postings',
        keywords: 'قيود يومية دفتر قيود محاسبية journal entries postings',
        icon: <BookOpen size={17} />,
        badge: isAr ? 'قيود يومية' : 'Journal',
        action: () => {
          navigate('/journal-entries');
          setOpen(false);
        },
      },
      {
        id: 'screen-vouchers',
        category: 'PAGE',
        titleAr: 'السندات المالية (قبض وصرف)',
        titleEn: 'Receipt & Payment Vouchers',
        subAr: 'سندات القبض النقدية والبنكية وسندات الصرف للموردين',
        subEn: 'Cash/bank receipts & supplier payment vouchers',
        keywords: 'سندات قبض صرف vouchers receipts payments',
        icon: <Receipt size={17} />,
        badge: isAr ? 'سندات' : 'Vouchers',
        action: () => {
          navigate('/vouchers');
          setOpen(false);
        },
      },
      {
        id: 'screen-partners',
        category: 'PAGE',
        titleAr: 'العملاء والشركات والموردين',
        titleEn: 'Customers & Suppliers Directory',
        subAr: 'دليل العملاء، الموردين، أرصدة الذمم والديون',
        subEn: 'Partners directory, receivables & payables balances',
        keywords: 'عملاء شركات موردين زبائن partners customers suppliers clients',
        icon: <Users size={17} />,
        badge: isAr ? 'الشركاء' : 'Partners',
        action: () => {
          navigate('/partners');
          setOpen(false);
        },
      },
      {
        id: 'screen-settings',
        category: 'PAGE',
        titleAr: 'إعدادات النظام والتهيئة',
        titleEn: 'System Settings & Config',
        subAr: 'طرق الدفع، ربط الصناديق، والعملات المعتمدة',
        subEn: 'Payment methods mapping, base currency & rules',
        keywords: 'إعدادات تهيئة النظام صناديق settings config options',
        icon: <Settings size={17} />,
        badge: isAr ? 'إعدادات' : 'Settings',
        action: () => {
          navigate('/system-settings');
          setOpen(false);
        },
      },
    ],
    [navigate, isAr]
  );

  // 3. Filtered Accounts
  const accountItems: SearchItem[] = useMemo(() => {
    return flatAccounts.slice(0, 100).map((acc: any) => ({
      id: `acc-${acc.id}`,
      category: 'ACCOUNT',
      titleAr: `${acc.code} — ${acc.nameAr}`,
      titleEn: `${acc.code} — ${acc.nameEn || acc.nameAr}`,
      subAr: `النوع: ${acc.type} | الطبيعة: ${acc.nature === 'DEBIT' ? 'مدين' : 'دائن'} | الرصيد: ${(acc.balanceIQD || 0).toLocaleString()} IQD`,
      subEn: `Type: ${acc.type} | Nature: ${acc.nature} | Balance: ${(acc.balanceIQD || 0).toLocaleString()} IQD`,
      code: acc.code,
      keywords: `${acc.code} ${acc.nameAr} ${acc.nameEn || ''} ${acc.type || ''} حساب account`,
      icon: <ListTree size={17} />,
      badge: acc.type || (isAr ? 'حساب' : 'Account'),
      action: () => {
        navigate(`/reports?accountId=${acc.id}`);
        setOpen(false);
      },
    }));
  }, [flatAccounts, navigate, isAr]);

  // 4. Filtered Partners
  const partnerItems: SearchItem[] = useMemo(() => {
    return partnersList.slice(0, 100).map((p: any) => ({
      id: `partner-${p.id}`,
      category: 'PARTNER',
      titleAr: p.nameAr || p.name || 'طرف مسجل',
      titleEn: p.nameEn || p.nameAr || p.name || 'Partner',
      subAr: `الهاتف: ${p.phone || 'غير مسجل'} | النوع: ${p.partnerType || 'عميل'} | الرصيد: ${(p.balanceIQD || 0).toLocaleString()} IQD`,
      subEn: `Phone: ${p.phone || 'N/A'} | Type: ${p.partnerType || 'Client'} | Balance: ${(p.balanceIQD || 0).toLocaleString()} IQD`,
      keywords: `${p.nameAr || ''} ${p.nameEn || ''} ${p.phone || ''} ${p.partnerType || ''} عميل مورد partner client`,
      icon: <Users size={17} />,
      badge: p.partnerType || (isAr ? 'طرف' : 'Partner'),
      action: () => {
        navigate(`/partners?id=${p.id}`);
        setOpen(false);
      },
    }));
  }, [partnersList, navigate, isAr]);

  // Resolve Partner/Customer clean name
  const resolvePartnerName = useCallback(
    (rawNameOrId?: string) => {
      if (!rawNameOrId) return '';
      const clean = String(rawNameOrId).trim();
      const found = partnersList.find(
        (p: any) =>
          p.id === clean ||
          p.code === clean ||
          p.nameAr === clean ||
          p.name === clean ||
          p.nameEn === clean
      );
      if (found) return found.nameAr || found.name || found.nameEn || clean;
      return clean;
    },
    [partnersList]
  );

  // 5. Filtered Tickets (Enhanced with search for Refunds, Changes, Reissues, Groups)
  const ticketItems: SearchItem[] = useMemo(() => {
    return ticketsList.slice(0, 150).map((t: any) => {
      const passNames = (t.passengers || []).map((p: any) => p.name).filter(Boolean).join(', ');
      const isRefund = t.tripType === 'REFUND' || t.status === 'REFUNDED' || String(t.invoiceNumber || '').startsWith('REF-') || t.notes?.includes('استرجاع') || t.notes?.includes('ريفاوند');
      const isReissue = t.tripType === 'REISSUE' || t.notes?.includes('تعديل') || t.notes?.includes('تغيير') || t.notes?.includes('reissue');
      const isGroup = t.isGroup || t.pnr?.includes('GRP') || t.notes?.includes('كروب') || t.notes?.includes('مجموعة') || t.notes?.includes('group');

      let badge = isAr ? 'تذكرة' : 'Ticket';
      if (isRefund) badge = isAr ? 'استرجاع (Refund)' : 'Refund';
      else if (isReissue) badge = isAr ? 'تعديل موعد (Change)' : 'Reissue';
      else if (isGroup) badge = isAr ? 'كروب (Group)' : 'Group';

      const rawCust = t.customerName || (t as any).customerId;
      const resolvedCust = resolvePartnerName(rawCust) || (isAr ? 'عميل نقدي' : 'Cash Client');
      const prefix = isRefund ? (isAr ? 'استرجاع:' : 'Refund:') : (isAr ? 'تذكرة:' : 'Ticket:');
      const titleAr = `${prefix} ${t.invoiceNumber || t.pnr || 'بدون رقم'} — ${resolvedCust}`;
      const titleEn = `${isRefund ? 'Refund:' : 'Ticket:'} ${t.invoiceNumber || t.pnr || 'N/A'} — ${resolvedCust}`;

      const keywords = `تذكرة تذاكر flight ticket ${t.pnr || ''} ${t.invoiceNumber || ''} ${t.airline || ''} ${resolvedCust} ${rawCust || ''} ${passNames} ${isRefund ? 'استرجاع ريفاوند refund void ترجيع ملغي' : ''} ${isReissue ? 'تعديل تغيير موعد reissue change ريشيو تبديل' : ''} ${isGroup ? 'كروب كروبات مجموعة رحلة جماعية group package' : ''}`;

      return {
        id: `ticket-${t.id}`,
        category: 'TICKET',
        titleAr,
        titleEn,
        subAr: `PNR: ${t.pnr || '—'} | الخط: ${t.airline || '—'} | المسافرون: ${passNames || 'مسافر'} | المبلغ: ${Number(t.totalSell || 0).toLocaleString()} ${t.currency || 'USD'}`,
        subEn: `PNR: ${t.pnr || '—'} | Line: ${t.airline || '—'} | Travelers: ${passNames || '1'} | Total: ${Number(t.totalSell || 0).toLocaleString()} ${t.currency || 'USD'}`,
        code: t.pnr || t.invoiceNumber,
        keywords,
        icon: <Plane size={17} />,
        badge,
        action: () => {
          if (isRefund) {
            navigate(`/refunds?id=${t.id}`);
          } else {
            navigate(`/tickets?id=${t.id}`);
          }
          setOpen(false);
        },
      };
    });
  }, [ticketsList, resolvePartnerName, navigate, isAr]);

  // 6. Filtered Visas (Enhanced with search for Refunds, Changes, Reissues, Groups)
  const visaItems: SearchItem[] = useMemo(() => {
    return visasList.slice(0, 150).map((v: any) => {
      const passNames = (v.passengers || []).map((p: any) => p.name).filter(Boolean).join(', ');
      const destination = v.passengers?.[0]?.pnr || v.airline || (isAr ? 'تأشيرة' : 'Visa');
      const isRefund = v.status === 'REFUNDED' || String(v.invoiceNumber || '').startsWith('REF-') || v.notes?.includes('استرجاع') || v.notes?.includes('ريفاوند');
      const isReissue = v.notes?.includes('تعديل') || v.notes?.includes('تغيير') || v.notes?.includes('reissue');
      const isGroup = v.notes?.includes('كروب') || v.notes?.includes('مجموعة') || v.notes?.includes('group');

      let badge = isAr ? 'تأشيرة' : 'Visa';
      if (isRefund) badge = isAr ? 'استرجاع (Refund)' : 'Refund';
      else if (isReissue) badge = isAr ? 'تعديل (Change)' : 'Reissue';
      else if (isGroup) badge = isAr ? 'كروب (Group)' : 'Group';

      const rawCust = v.customerName || (v as any).customerId;
      const resolvedCust = resolvePartnerName(rawCust) || (isAr ? 'عميل نقدي' : 'Cash Client');

      const keywords = `فيزا تأشيرة تأشيرات visa ${v.invoiceNumber || ''} ${destination} ${resolvedCust} ${rawCust || ''} ${passNames} ${isRefund ? 'استرجاع ريفاوند refund void ترجيع ملغي' : ''} ${isReissue ? 'تعديل تغيير موعد reissue change ريشيو تبديل' : ''} ${isGroup ? 'كروب كروبات مجموعة رحلة جماعية group package' : ''}`;

      return {
        id: `visa-${v.id}`,
        category: 'VISA',
        titleAr: `تأشيرة: ${v.invoiceNumber || 'VISA'} — ${destination} (${resolvedCust})`,
        titleEn: `Visa: ${v.invoiceNumber || 'VISA'} — ${destination} (${resolvedCust})`,
        subAr: `الوجهة: ${destination} | المسافرون: ${passNames || 'مسافر'} | المبلغ: ${Number(v.totalSell || 0).toLocaleString()} ${v.currency || 'USD'}`,
        subEn: `Destination: ${destination} | Travelers: ${passNames || '1'} | Total: ${Number(v.totalSell || 0).toLocaleString()} ${v.currency || 'USD'}`,
        code: v.invoiceNumber,
        keywords,
        icon: <FileCheck size={17} />,
        badge,
        action: () => {
          navigate(`/visas?id=${v.id}`);
          setOpen(false);
        },
      };
    });
  }, [visasList, resolvePartnerName, navigate, isAr]);

  // All unified items
  const allItems = useMemo(() => {
    return [...actionItems, ...screenItems, ...ticketItems, ...visaItems, ...partnerItems, ...accountItems];
  }, [actionItems, screenItems, ticketItems, visaItems, partnerItems, accountItems]);

  // Filter items based on query & selected category
  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      if (selectedCategory === 'ACTION') return actionItems;
      if (selectedCategory === 'PAGE') return screenItems;
      if (selectedCategory === 'TICKET') return ticketItems;
      if (selectedCategory === 'VISA') return visaItems;
      if (selectedCategory === 'PARTNER') return partnerItems;
      if (selectedCategory === 'ACCOUNT') return accountItems;
      return [...actionItems, ...screenItems];
    }

    return allItems
      .filter((item) => {
        if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
          return false;
        }
        const titleA = (item.titleAr || '').toLowerCase();
        const titleE = (item.titleEn || '').toLowerCase();
        const subA = (item.subAr || '').toLowerCase();
        const subE = (item.subEn || '').toLowerCase();
        const code = (item.code || '').toLowerCase();
        const kw = (item.keywords || '').toLowerCase();

        return (
          titleA.includes(q) ||
          titleE.includes(q) ||
          subA.includes(q) ||
          subE.includes(q) ||
          code.includes(q) ||
          kw.includes(q)
        );
      })
      .slice(0, 35);
  }, [allItems, actionItems, screenItems, ticketItems, visaItems, partnerItems, accountItems, query, selectedCategory]);

  // Save recent search on execution
  const executeItem = (item: SearchItem) => {
    if (query.trim()) {
      setRecentQueries((prev) => {
        const updated = [query.trim(), ...prev.filter((x) => x !== query.trim())].slice(0, 5);
        try {
          localStorage.setItem('__global_recent_searches', JSON.stringify(updated));
        } catch {
          // Ignore
        }
        return updated;
      });
    }
    item.action();
  };

  // Keyboard navigation inside list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults[selectedIndex]) {
        executeItem(filteredResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, selectedCategory]);

  // Categories config with clean responsive pill badges (Single clean row without numbers)
  const categories = [
    { id: 'ALL', labelAr: 'الكل', labelEn: 'All' },
    { id: 'ACTION', labelAr: 'إجراءات سريعة', labelEn: 'Quick Actions' },
    { id: 'TICKET', labelAr: 'تذاكر الطيران', labelEn: 'Tickets' },
    { id: 'VISA', labelAr: 'التأشيرات والفيز', labelEn: 'Visas' },
    { id: 'PARTNER', labelAr: 'العملاء والموردين', labelEn: 'Partners' },
    { id: 'ACCOUNT', labelAr: 'دليل الحسابات', labelEn: 'Accounts' },
    { id: 'PAGE', labelAr: 'الشاشات', labelEn: 'Pages' },
  ];

  return (
    <>
      {/* ── Strict Cross-Browser Zero Scrollbars CSS ── */}
      <style>{`
        .spotlight-clean-scroll::-webkit-scrollbar,
        .spotlight-clean-scroll *::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          background: transparent !important;
        }
        .spotlight-clean-scroll,
        .spotlight-clean-scroll * {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>

      {/* ── TOPBAR TRIGGER BUTTON ── */}
      <div className="w-full max-w-[460px] mx-auto">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between px-3.5 h-[38px] bg-slate-50/90 hover:bg-white hover:border-[#F45A0A]/40 rounded-xl border border-slate-200 text-slate-500 transition-colors cursor-pointer text-xs select-none shadow-2xs group"
        >
          <div className="flex items-center gap-2.5 truncate">
            <Search size={15} className="text-slate-400 group-hover:text-[#F45A0A] transition-colors shrink-0" />
            <span className="truncate text-[12.5px] font-medium text-slate-600 group-hover:text-slate-900">
              {isAr ? 'البحث السريع في التذاكر، الفيز، الاسترجاعات، الحسابات...' : 'Search tickets, visas, refunds, accounts, partners...'}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <kbd className="bg-white border border-slate-200 px-1.5 py-0.5 text-[10.5px] rounded-md font-mono text-slate-500 font-bold shadow-2xs group-hover:text-[#F45A0A] group-hover:border-orange-300 transition-colors">
              Ctrl + K
            </kbd>
          </div>
        </button>
      </div>

      {/* ── SPOTLIGHT MODAL (CLEAN & RAZOR SHARP) ── */}
      {open && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-[7vh] sm:pt-[9vh] p-3 sm:p-4 font-sans select-none spotlight-clean-scroll" dir={direction}>
          {/* Frosted Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
            onClick={() => setOpen(false)}
          />

          {/* Dialog Container - FIXED 560px HEIGHT with Sharp Rendering */}
          <div
            className="relative w-full max-w-[740px] h-[560px] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col z-10 animate-dropdown-pop overflow-hidden"
          >
            {/* 1. Header with Clean Search Input */}
            <div className="relative flex items-center px-4.5 py-3.5 border-b border-slate-100 bg-white shrink-0">
              <Search size={18} className="text-[#F45A0A] shrink-0 me-3" />
              <input
                ref={inputRef}
                type="search"
                aria-label={isAr ? 'البحث الشامل في النظام' : 'Search across the system'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isAr
                    ? 'اكتب للبحث (تذكرة، ريفاوند، تعديل، كروب، فيزا، عميل، حساب)...'
                    : 'Search tickets, refunds, reissues, groups, visas, partners...'
                }
                className="w-full bg-transparent text-[15px] font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none border-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label={isAr ? 'مسح نص البحث' : 'Clear search'}
                  className="w-6 h-6 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <X size={14} />
                </button>
              )}
              <div className="ms-2 hidden sm:flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-[10px] font-bold font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded">
                  ESC
                </kbd>
              </div>
            </div>

            {/* 2. Category Filter Pills Bar (Clean Single Line Bar without numbers) */}
            <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 bg-slate-50/80 border-b border-slate-100 shrink-0">
              {categories.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1 rounded-lg text-[11.5px] font-bold transition-all cursor-pointer flex items-center shrink-0 select-none ${
                      isActive
                        ? 'bg-[#F45A0A] text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-[#FFF3E8] hover:text-[#F45A0A] hover:border-[#FFD8B2]'
                    }`}
                  >
                    <span>{isAr ? cat.labelAr : cat.labelEn}</span>
                  </button>
                );
              })}
            </div>


            {/* 3. Recent Searches Bar */}
            {!query && recentQueries.length > 0 && (
              <div className="px-4 py-1.5 border-b border-slate-100 flex items-center gap-2 text-xs text-slate-500 bg-white shrink-0 overflow-x-auto">
                <Clock size={13} className="text-slate-400 shrink-0" />
                <span className="font-bold text-[11px]">{isAr ? 'عمليات البحث الأخيرة:' : 'Recent:'}</span>
                <div className="flex items-center gap-1.5">
                  {recentQueries.map((rq, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setQuery(rq)}
                      className="px-2 py-0.5 bg-slate-50 hover:bg-[#FFF3E8] hover:text-[#F45A0A] hover:border-[#FFD8B2] border border-slate-200 rounded text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer"
                    >
                      {rq}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Results List Container (Brand Warm Orange Focus Highlight) */}
            <div ref={listRef} className="flex-1 overflow-y-auto p-2.5 space-y-1 bg-white">
              {filteredResults.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-10 text-center space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-[#FFF3E8] text-[#F45A0A] border border-[#FFD8B2] flex items-center justify-center mx-auto shadow-2xs">
                    <Search size={22} />
                  </div>
                  <p className="text-sm font-bold text-slate-800">
                    {isAr ? 'لم يتم العثور على أي نتائج مطابقة' : 'No matching results found'}
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {isAr
                      ? 'جرّب البحث باسم الحساب، التذكرة، ريفاوند، تعديل، كروب، فيزا، أو اسم العميل.'
                      : 'Try searching by ticket, refund, change, group, visa, client name, or account.'}
                  </p>
                </div>
              ) : (
                filteredResults.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      onClick={() => executeItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#FFF3E8] border border-[#FFD8B2] text-slate-950 shadow-2xs ring-1 ring-[#F45A0A]/25'
                          : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Brand Icon Box */}
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-[#F45A0A] text-white shadow-2xs'
                              : 'bg-[#FFF3E8] border border-[#FFD8B2] text-[#F45A0A]'
                          }`}
                        >
                          {item.icon}
                        </div>

                        {/* Title & Subtitle */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[13px] text-slate-900 truncate">
                              {isAr ? item.titleAr : item.titleEn}
                            </span>
                            {item.badge && (
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                  isSelected
                                    ? 'bg-white text-[#F45A0A] border border-[#FFD8B2]'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>
                          {(item.subAr || item.subEn) && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {isAr ? item.subAr : item.subEn}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Jump / Enter Indicator */}
                      <div className="flex items-center gap-1.5 shrink-0 ms-3">
                        {isSelected && (
                          <span className="text-[10.5px] font-bold text-white bg-[#F45A0A] px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-2xs">
                            <span>{isAr ? 'فتح' : 'Open'}</span>
                            <CornerDownLeft size={11} />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 5. Clean Footer */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-mono font-bold text-slate-600">↑</kbd>
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-mono font-bold text-slate-600">↓</kbd>
                  <span>{isAr ? 'للتنقل' : 'Navigate'}</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-mono font-bold text-slate-600">↵</kbd>
                  <span>{isAr ? 'للاختيار' : 'Select'}</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-mono font-bold text-slate-600">ESC</kbd>
                  <span>{isAr ? 'للإغلاق' : 'Close'}</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                <Sparkles size={13} className="text-[#F45A0A]" />
                <span className="font-bold text-slate-600">{isAr ? 'البحث السريع' : 'Spotlight Search'}</span>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default GlobalSearch;
