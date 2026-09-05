import { create } from 'zustand';

export type Language = 'ar' | 'en';

interface LanguageState {
  language: Language;
  direction: 'rtl' | 'ltr';
  setLanguage: (lang: Language, reload?: boolean) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  ar: {
    // Topbar & Navigation
    'nav.dashboard': 'لوحة التحكم',
    'nav.operations': 'العمليات والخدمات',
    'nav.tickets': 'تذاكر الطيران',
    'nav.visas': 'الفيزا والتأشيرات',
    'nav.groups': 'تذاكر الكروبات',
    'nav.hotels': 'حجوزات الفنادق',
    'nav.refunds': 'استرجاع التذاكر',
    'nav.reissues': 'تغيير التذاكر',
    'nav.accounts': 'الحسابات',
    'nav.coa': 'شجرة الحسابات',
    'nav.statement': 'كشف الحساب',
    'nav.journalEntries': 'القيود اليومية',
    'nav.journal-entries': 'القيود اليومية',
    'nav.vouchers': 'السندات المالية',
    'nav.expenses': 'سجل المصاريف',
    'nav.subCashboxes': 'تحصيل الصناديق الفرعية',
    'nav.sub-cashboxes-settlement': 'تحصيل الصناديق الفرعية',
    'nav.cashboxesBanks': 'الصناديق والبنوك',
    'nav.cashboxes-banks': 'الصناديق والبنوك',
    'nav.fiscalYears': 'السنوات والفترات المالية',
    'nav.fiscal-years': 'السنوات والفترات المالية',
    'nav.externalClearings': 'التصفيات الخارجية',
    'nav.external-clearings': 'التصفيات الخارجية',
    'nav.partners': 'الأطراف والحسابات',
    'nav.profits': 'تحليل الربحية',
    'nav.reports': 'التقارير',
    'nav.debts': 'تقرير الديون والذمم',
    'nav.debts-report': 'تقرير الديون والذمم',
    'nav.income-statement': 'القوائم المالية',
    'nav.financialReports': 'التقارير المحاسبية',
    'nav.financial-reports': 'التقارير المحاسبية',
    'nav.admin': 'الإدارة والرقابة',
    'nav.branches': 'الفروع والهيكل الإداري',
    'nav.branches-structure': 'الفروع والهيكل الإداري',
    'nav.permissionGroups': 'مجموعات الصلاحيات',
    'nav.permission-groups': 'مجموعات الصلاحيات',
    'nav.subscription': 'الاشتراك والاستهلاك',
    'nav.subscription-settings': 'الاشتراك والاستهلاك',
    'nav.pricing': 'باقات التسعير والترقية',
    'nav.pricing-management': 'تصميم وإدارة الباقات والشروط',
    'nav.feedback': 'مركز البلاغات والدعم الفني',
    'nav.feedback-tickets': 'مركز البلاغات والدعم الفني',
    'nav.saasAdmin': 'لوحة إدارة المنصة (SaaS)',
    'nav.saas-admin': 'لوحة إدارة المنصة (SaaS)',
    'nav.deleted-records': 'سجل المحذوفات',
    'nav.deletedRecords': 'سجل المحذوفات',
    'nav.addons-store': 'متجر الإضافات',
    'nav.help-center': 'مركز المساعدة والتعليمات',
    'nav.map-test': 'خريطة شبكة الفروع',
    'nav.settings': 'إعدادات النظام',
    'nav.system-settings': 'إعدادات النظام',

    // Search & Currency
    'search.placeholder': 'ابحث في الحسابات والقيود والسندات والأطراف...',
    'currency.all': 'كلا العملتين',
    'currency.iqd': 'IQD',
    'currency.usd': '$ USD',
    'currency.dollar': 'USD',
    'currency.dinar': 'IQD',

    // Tickets Page Header & KPIs
    'tickets.title': 'تذاكر الطيران',
    'tickets.subtitle': 'إدارة فواتير بيع وشراء التذاكر والتسعير والتدقيق والترحيل',
    'tickets.newInvoice': 'فاتورة تذاكر جديدة',
    'tickets.refresh': 'تحديث',
    'tickets.totalSales': 'المبيعات',
    'tickets.totalCost': 'المشتريات',
    'tickets.netProfit': 'الربح الصافي',
    'tickets.auditStatus': 'حالة التدقيق المالي',
    'tickets.audited': 'مدققة',
    'tickets.underReview': 'مراجعة',
    'tickets.unaudited': 'غير مدققة',
    'tickets.allStatuses': 'كل الحالات',
    'tickets.unauthorized': 'غير مصرح',

    // Filters
    'filters.searchPlaceholder': 'ابحث برقم الفاتورة أو PNR أو المسافر...',
    'filters.advanced': 'فلاتر متقدمة',
    'filters.fromDate': 'من تاريخ',
    'filters.toDate': 'إلى تاريخ',
    'filters.airline': 'جميع شركات الطيران',
    'filters.invoiceStatus': 'حالة الفاتورة',
    'filters.clear': 'مسح الفلاتر',
    'filters.applied': 'المطبقة:',

    // Table Columns
    'table.index': '#',
    'table.invoiceNumber': 'رقم الفاتورة',
    'table.passengers': 'المسافرون',
    'table.airlinePnr': 'شركة الطيران و PNR',
    'table.supplier': 'المورد',
    'table.buyTotal': 'إجمالي الشراء',
    'table.customer': 'العميل',
    'table.sellTotal': 'إجمالي البيع',
    'table.profit': 'صافي الربح',
    'table.paymentMethod': 'طريقة الدفع',
    'table.dateEmployee': 'التاريخ والموظف',
    'table.audit': 'التدقيق',
    'table.entry': 'عرض',
    'table.actions': 'إجراءات',
    'table.noResults': 'لا توجد فواتير تطابق عوامل التصفية',
    'table.passengerCount': 'مسافر',

    // Status
    'status.audited': 'مدققة',
    'status.unaudited': 'غير مدققة',

    // Payment Badges
    'payment.cash': 'نقدي',
    'payment.credit': 'آجل',
    'payment.partial': 'جزئي',

    // Actions
    'action.view': 'عرض الفاتورة',
    'action.edit': 'تعديل',
    'action.history': 'سجل التعديلات',
    'action.receipt': 'إيصال الدفع',

    // Totals & Pagination
    'totals.matching': 'النتائج المطابقة:',
    'totals.invoices': 'فاتورة',
    'totals.passengers': 'المسافرون:',
    'pagination.showing': 'عرض',
    'pagination.of': 'من أصل',
    'pagination.pageSize': 'عرض:',

    // User Menu
    'user.profile': 'الملف الشخصي والحساب',
    'user.displaySettings': 'إعدادات الواجهة والعرض',
    'user.shortcuts': 'اختصارات لوحة المفاتيح',
    'user.changePassword': 'تغيير كلمة المرور',
    'user.logout': 'تسجيل الخروج',
    'user.language': 'لغة النظام (Language)',
    'user.active': 'نشط',
    'user.manageSub': 'إدارة الاشتراك',
    'user.upgrade': 'ترقية الباقة',
  },
  en: {
    // Topbar & Navigation
    'nav.dashboard': 'Dashboard',
    'nav.operations': 'Operations & Services',
    'nav.tickets': 'Flight Tickets',
    'nav.visas': 'Visas & Permits',
    'nav.groups': 'Group Tickets',
    'nav.hotels': 'Hotel Bookings',
    'nav.refunds': 'Ticket Refunds',
    'nav.reissues': 'Ticket Reissues',
    'nav.accounts': 'Accounts',
    'nav.coa': 'Chart of Accounts',
    'nav.journalEntries': 'Journal Entries',
    'nav.journal-entries': 'Journal Entries',
    'nav.vouchers': 'Financial Vouchers',
    'nav.expenses': 'Expense Log',
    'nav.subCashboxes': 'Sub-Cashboxes Settlement',
    'nav.sub-cashboxes-settlement': 'Sub-Cashboxes Settlement',
    'nav.cashboxesBanks': 'Cashboxes & Banks',
    'nav.cashboxes-banks': 'Cashboxes & Banks',
    'nav.fiscalYears': 'Fiscal Years & Periods',
    'nav.fiscal-years': 'Fiscal Years & Periods',
    'nav.externalClearings': 'External Clearings',
    'nav.external-clearings': 'External Clearings',
    'nav.partners': 'Partners & Accounts',
    'nav.profits': 'Profits',
    'nav.reports': 'Reports',
    'nav.statement': 'Account Statement',
    'nav.debts': 'Debts & Receivables',
    'nav.debts-report': 'Debts & Receivables',
    'nav.income-statement': 'Financial Statements',
    'nav.incomeStatement': 'Financial Statements',
    'nav.financialReports': 'Financial Reports',
    'nav.financial-reports': 'Financial Reports',
    'nav.admin': 'Admin & Governance',
    'nav.branches': 'Branches Structure',
    'nav.branches-structure': 'Branches Structure',
    'nav.permissionGroups': 'Permission Groups',
    'nav.permission-groups': 'Permission Groups',
    'nav.subscription': 'Subscription & Usage',
    'nav.subscription-settings': 'Subscription & Usage',
    'nav.pricing': 'Pricing Plans',
    'nav.pricing-management': 'Plans & Pricing Management',
    'nav.feedback': 'Support & Feedback Center',
    'nav.feedback-tickets': 'Support & Feedback Center',
    'nav.saasAdmin': 'SaaS Platform Admin',
    'nav.saas-admin': 'SaaS Platform Admin',
    'nav.deleted-records': 'Deleted Records Archive',
    'nav.deletedRecords': 'Deleted Records Archive',
    'nav.addons-store': 'Add-ons Store',
    'nav.help-center': 'Help Center',
    'nav.map-test': 'Branch Network Map',
    'nav.settings': 'System Settings',
    'nav.system-settings': 'System Settings',

    // Search & Currency
    'search.placeholder': 'Search accounts, entries, vouchers, partners...',
    'currency.all': 'All Currencies',
    'currency.iqd': 'IQD',
    'currency.usd': '$ USD',
    'currency.dollar': 'USD',
    'currency.dinar': 'IQD',

    // Tickets Page Header & KPIs
    'tickets.title': 'Flight Tickets',
    'tickets.subtitle': 'Manage ticket sales, purchases, pricing, auditing & posting',
    'tickets.newInvoice': 'New Ticket Invoice',
    'tickets.refresh': 'Refresh',
    'tickets.totalSales': 'Total Sales',
    'tickets.totalCost': 'Total Buy Cost (Suppliers)',
    'tickets.netProfit': 'Realized Net Profit',
    'tickets.auditStatus': 'Financial Audit Status',
    'tickets.audited': 'Audited',
    'tickets.underReview': 'Review',
    'tickets.unaudited': 'Unaudited',
    'tickets.allStatuses': 'All Statuses',
    'tickets.unauthorized': 'Unauthorized',

    // Filters
    'filters.searchPlaceholder': 'Search invoice #, PNR, passenger name...',
    'filters.advanced': 'Advanced Filters',
    'filters.fromDate': 'From Date',
    'filters.toDate': 'To Date',
    'filters.airline': 'All Airlines',
    'filters.invoiceStatus': 'Invoice Status',
    'filters.clear': 'Clear Filters',
    'filters.applied': 'Applied:',

    // Table Columns
    'table.index': '#',
    'table.invoiceNumber': 'Invoice #',
    'table.passengers': 'Passengers',
    'table.airlinePnr': 'Airline & PNR',
    'table.supplier': 'Supplier',
    'table.buyTotal': 'Buy Total',
    'table.customer': 'Customer',
    'table.sellTotal': 'Sell Total',
    'table.profit': 'Net Profit',
    'table.paymentMethod': 'Payment Method',
    'table.dateEmployee': 'Date & Issuer',
    'table.audit': 'Audit',
    'table.entry': 'View',
    'table.actions': 'Actions',
    'table.noResults': 'No invoices matching the filters',
    'table.passengerCount': 'passengers',

    // Status
    'status.audited': 'Audited',
    'status.unaudited': 'Unaudited',

    // Payment Badges
    'payment.cash': 'Cash',
    'payment.credit': 'Credit',
    'payment.partial': 'Partial',

    // Actions
    'action.view': 'View Invoice',
    'action.edit': 'Edit',
    'action.history': 'Audit Log',
    'action.receipt': 'Payment Receipt',

    // Totals & Pagination
    'totals.matching': 'Matching Results:',
    'totals.invoices': 'invoices',
    'totals.passengers': 'Passengers:',
    'pagination.showing': 'Showing',
    'pagination.of': 'of',
    'pagination.pageSize': 'Show:',

    // User Menu
    'user.profile': 'Profile & Account',
    'user.displaySettings': 'Interface & Display',
    'user.shortcuts': 'Keyboard Shortcuts',
    'user.changePassword': 'Change Password',
    'user.logout': 'Sign Out',
    'user.language': 'Language / اللغة',
    'user.active': 'Active',
    'user.manageSub': 'Manage Subscription',
    'user.upgrade': 'Upgrade Plan',
  },
};

const getInitialLanguage = (): Language => {
  try {
    const saved = localStorage.getItem('app_language');
    if (saved === 'en' || saved === 'ar') return saved;
  } catch (e) {}
  return 'ar';
};

export const useLanguageStore = create<LanguageState>((set, get) => {
  const initialLang = getInitialLanguage();
  if (typeof document !== 'undefined') {
    document.documentElement.dir = initialLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = initialLang;
  }

  return {
    language: initialLang,
    direction: initialLang === 'ar' ? 'rtl' : 'ltr',
    setLanguage: (lang: Language, reload = false) => {
      try {
        localStorage.setItem('app_language', lang);
      } catch (e) {}
      if (typeof document !== 'undefined') {
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
      }
      set({
        language: lang,
        direction: lang === 'ar' ? 'rtl' : 'ltr',
      });

      if (reload && typeof window !== 'undefined') {
        window.location.reload();
      }
    },
    t: (key: string) => {
      const currentLang = get().language;
      return translations[currentLang]?.[key] || translations.ar[key] || key;
    },
  };
});
