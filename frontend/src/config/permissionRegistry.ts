export interface PermissionDefinition {
  code: string;
  label: string;
  actionType:
    | 'View'
    | 'Create'
    | 'Update'
    | 'Delete'
    | 'Approve'
    | 'Post'
    | 'Reverse'
    | 'Cancel'
    | 'Print'
    | 'Export'
    | 'ViewCost'
    | 'EditCost'
    | 'ViewSalePrice'
    | 'EditPrice'
    | 'ViewProfit'
    | 'ApplyDiscount'
    | 'ViewAllBranches'
    | 'Manage';
  isSensitive?: boolean;
}

export interface ModuleDefinition {
  id: string;
  title: string;
  route: string;
  category: 'الرئيسية' | 'العمليات والخدمات' | 'الحسابات' | 'التقارير' | 'الإدارة والرقابة';
  iconName: string;
  permissions: PermissionDefinition[];
}

export const PERMISSION_REGISTRY: ModuleDefinition[] = [
  // ── 1. لوحة التحكم والإحصائيات ──
  {
    id: 'dashboard',
    title: 'لوحة التحكم والمؤشرات',
    route: '/dashboard',
    category: 'الرئيسية',
    iconName: 'IconLayoutDashboard',
    permissions: [
      { code: 'dashboard.view', label: 'عرض لوحة التحكم والمؤشرات اليومية', actionType: 'View' },
      { code: 'dashboard.viewFinancials', label: 'عرض كروت الأرباح والسيولة النقدية', actionType: 'ViewCost', isSensitive: true },
      { code: 'dashboard.viewAllBranches', label: 'استعراض إحصائيات كافة فروع الشركة', actionType: 'ViewAllBranches', isSensitive: true },
    ],
  },

  // ── 2. تذاكر الطيران ──
  {
    id: 'tickets',
    title: 'تذاكر الطيران',
    route: '/tickets',
    category: 'العمليات والخدمات',
    iconName: 'IconPlane',
    permissions: [
      { code: 'tickets.view', label: 'عرض قائمة التذاكر', actionType: 'View' },
      { code: 'tickets.create', label: 'إصدار تذكرة أفراد جديدة', actionType: 'Create' },
      { code: 'tickets.update', label: 'تعديل بيانات التذكرة', actionType: 'Update' },
      { code: 'tickets.deleteDraft', label: 'حذف التذكرة المسودة', actionType: 'Delete' },
      { code: 'tickets.approve', label: 'اعتماد التذكرة', actionType: 'Approve', isSensitive: true },
      { code: 'tickets.post', label: 'ترحيل التذكرة مالياً إلى اليومية', actionType: 'Post', isSensitive: true },
      { code: 'tickets.cancel', label: 'إلغاء التذكرة واسترجاعها', actionType: 'Cancel' },
      { code: 'tickets.print', label: 'طباعة تذكرة وسند الحجز', actionType: 'Print' },
      { code: 'tickets.export', label: 'تصدير كشف التذاكر إلى Excel', actionType: 'Export' },
      { code: 'tickets.viewSalePrice', label: 'مشاهدة سعر البيع للعميل', actionType: 'ViewSalePrice' },
      { code: 'tickets.editSalePrice', label: 'تعديل سعر البيع', actionType: 'EditPrice', isSensitive: true },
      { code: 'tickets.viewCost', label: 'مشاهدة سعر التكلفة والعمولة', actionType: 'ViewCost', isSensitive: true },
      { code: 'tickets.editCost', label: 'تعديل سعر التكلفة', actionType: 'EditCost', isSensitive: true },
      { code: 'tickets.viewProfit', label: 'مشاهدة ربح التذكرة الصافي', actionType: 'ViewProfit', isSensitive: true },
      { code: 'tickets.applyDiscount', label: 'منح خصم إضافي للعميل', actionType: 'ApplyDiscount', isSensitive: true },
      { code: 'tickets.audit', label: 'تدقيق وقفل/فتح قفل الفاتورة', actionType: 'Approve', isSensitive: true },
    ],
  },

  // ── 3. تأشيرات الدخول (الفيزا) ──
  {
    id: 'visas',
    title: 'تأشيرات الدخول (الفيزا)',
    route: '/visas',
    category: 'العمليات والخدمات',
    iconName: 'IconPassport',
    permissions: [
      { code: 'visas.view', label: 'عرض قائمة فواتير التأشيرات', actionType: 'View' },
      { code: 'visas.create', label: 'إصدار فاتورة تأشيرة جديدة', actionType: 'Create' },
      { code: 'visas.update', label: 'تعديل فاتورة التأشيرة المسودة', actionType: 'Update' },
      { code: 'visas.delete', label: 'حذف فاتورة تأشيرة مسودة', actionType: 'Delete', isSensitive: true },
      { code: 'visas.post', label: 'ترحيل فاتورة التأشيرة مالياً', actionType: 'Post', isSensitive: true },
      { code: 'visas.print', label: 'طباعة فاتورة وسندات التأشيرات', actionType: 'Print' },
      { code: 'visas.export', label: 'تصدير جدول التأشيرات إلى Excel', actionType: 'Export' },
      { code: 'visas.viewCost', label: 'مشاهدة تكلفة التأشيرة الصافية', actionType: 'ViewCost', isSensitive: true },
      { code: 'visas.viewProfit', label: 'مشاهدة صافي أرباح التأشيرات', actionType: 'ViewProfit', isSensitive: true },
      { code: 'visas.manageTypes', label: 'إدارة وتخصيص أنواع وأسعار التأشيرات', actionType: 'Manage', isSensitive: true },
    ],
  },

  // ── 4. حجوزات الفنادق ──
  {
    id: 'hotels',
    title: 'حجوزات الفنادق',
    route: '/hotels',
    category: 'العمليات والخدمات',
    iconName: 'IconBuildingCommunity',
    permissions: [
      { code: 'hotels.view', label: 'عرض حجوزات الفنادق والإقامة', actionType: 'View' },
      { code: 'hotels.create', label: 'إضافة وتثبيت حجز فندقي جديد', actionType: 'Create' },
      { code: 'hotels.update', label: 'تعديل بيانات الحجز الفندقي', actionType: 'Update' },
      { code: 'hotels.delete', label: 'حذف أو إلغاء حجز فندقي', actionType: 'Delete', isSensitive: true },
      { code: 'hotels.post', label: 'ترحيل فاتورة الفندق مالياً', actionType: 'Post', isSensitive: true },
      { code: 'hotels.print', label: 'طباعة فاوتشر وسند الفندق (Hotel Voucher)', actionType: 'Print' },
      { code: 'hotels.viewCost', label: 'مشاهدة تكلفة الغرف والعمولات', actionType: 'ViewCost', isSensitive: true },
      { code: 'hotels.viewProfit', label: 'مشاهدة ربح الحجز الفندقي', actionType: 'ViewProfit', isSensitive: true },
    ],
  },

  // ── 5. تذاكر الكروبات ──
  {
    id: 'groups',
    title: 'تذاكر الكروبات',
    route: '/groups',
    category: 'العمليات والخدمات',
    iconName: 'IconUsersGroup',
    permissions: [
      { code: 'groups.view', label: 'عرض سجل تذاكر الكروبات', actionType: 'View' },
      { code: 'groups.create', label: 'إصدار كروب جديد', actionType: 'Create' },
      { code: 'groups.update', label: 'تعديل بيانات الكروب وأسعاره', actionType: 'Update' },
      { code: 'groups.delete', label: 'حذف كروب', actionType: 'Delete', isSensitive: true },
      { code: 'groups.post', label: 'ترحيل الحساب المالي للمجموعة السياحية', actionType: 'Post', isSensitive: true },
      { code: 'groups.print', label: 'طباعة كشف المسافرين والمانيفست', actionType: 'Print' },
      { code: 'groups.viewProfit', label: 'مشاهدة أرباح الرحلة الجماعية', actionType: 'ViewProfit', isSensitive: true },
    ],
  },

  // ── 6. استرجاع التذاكر والخدمات (Refunds) ──
  {
    id: 'refunds',
    title: 'استرجاع التذاكر والخدمات (Refunds)',
    route: '/refunds',
    category: 'العمليات والخدمات',
    iconName: 'IconReceiptRefund',
    permissions: [
      { code: 'refunds.view', label: 'عرض طلبات وفواتير الاسترجاع', actionType: 'View' },
      { code: 'refunds.create', label: 'إنشاء معاملة استرجاع تذكرة أو خدمة', actionType: 'Create' },
      { code: 'refunds.post', label: 'ترحيل الاسترجاع وخصم الغرامات مالياً', actionType: 'Post', isSensitive: true },
      { code: 'refunds.print', label: 'طباعة سند وقسيمة الاسترجاع', actionType: 'Print' },
      { code: 'refunds.delete', label: 'إلغاء أو حذف طلب الاسترجاع المسودة', actionType: 'Delete', isSensitive: true },
    ],
  },

  // ── 7. تغيير الحجوزات وإعادة الإصدار (Reissues) ──
  {
    id: 'reissues',
    title: 'تغيير الحجوزات (Reissues)',
    route: '/reissues',
    category: 'العمليات والخدمات',
    iconName: 'IconRefresh',
    permissions: [
      { code: 'reissues.view', label: 'عرض سجل تغيير المواعيد وخطوط السير', actionType: 'View' },
      { code: 'reissues.create', label: 'تسجيل عملية إعادة إصدار أو تغيير موعد', actionType: 'Create' },
      { code: 'reissues.post', label: 'ترحيل فروقات الأسعار وغرامات التغيير', actionType: 'Post', isSensitive: true },
      { code: 'reissues.print', label: 'طباعة إشعار وسند التغيير', actionType: 'Print' },
    ],
  },
  // ── بيع الوزن الإضافي ──
  {
    id: 'baggage',
    title: 'بيع الوزن',
    route: '/baggage',
    category: 'العمليات والخدمات',
    iconName: 'IconLuggage',
    permissions: [
      { code: 'baggage.view', label: 'عرض سجل مبيعات الوزن', actionType: 'View' },
      { code: 'baggage.create', label: 'إصدار فاتورة وزن إضافي', actionType: 'Create' },
      { code: 'baggage.update', label: 'تعديل فاتورة وزن', actionType: 'Update' },
      { code: 'baggage.delete', label: 'حذف فاتورة وزن', actionType: 'Delete', isSensitive: true },
    ],
  },

  // ── 8. شجرة الحسابات والدليل المالي ──
  {
    id: 'accounts',
    title: 'شجرة الحسابات والدليل المالي',
    route: '/accounts',
    category: 'الحسابات',
    iconName: 'IconSitemap',
    permissions: [
      { code: 'accounts.view', label: 'استعراض شجرة الحسابات الهرمية', actionType: 'View' },
      { code: 'accounts.create', label: 'إضافة حساب محاسبي جديد', actionType: 'Create' },
      { code: 'accounts.update', label: 'تعديل بيانات الحساب وحدود الائتمان', actionType: 'Update' },
      { code: 'accounts.delete', label: 'حذف حساب محاسبي فارغ', actionType: 'Delete', isSensitive: true },
      { code: 'accounts.viewBalances', label: 'عرض الأرصدة الحية والسيولة النقدية', actionType: 'ViewCost', isSensitive: true },
      { code: 'accounts.setOpening', label: 'تعديل وضبط الرصيد الافتتاحي للحساب', actionType: 'Manage', isSensitive: true },
    ],
  },

  // ── 9. القيود اليومية المحاسبية ──
  {
    id: 'journal_entries',
    title: 'القيود اليومية المحاسبية',
    route: '/journal-entries',
    category: 'الحسابات',
    iconName: 'IconBook',
    permissions: [
      { code: 'journal.view', label: 'عرض سجل القيود اليومية', actionType: 'View' },
      { code: 'journal.create', label: 'إنشاء قيد يومي يدوي أو مركب', actionType: 'Create' },
      { code: 'journal.update', label: 'تعديل قيد غير مرحل', actionType: 'Update' },
      { code: 'journal.post', label: 'ترحيل القيد المالي إلى دفاتر الأستاذ', actionType: 'Post', isSensitive: true },
      { code: 'journal.reverse', label: 'عكس وإلغاء القيد المرحل بقيد عكسي', actionType: 'Reverse', isSensitive: true },
      { code: 'journal.print', label: 'طباعة سند القيد اليومي الرسمي', actionType: 'Print' },
      { code: 'journal.export', label: 'تصدير دفتر اليومية العام إلى Excel', actionType: 'Export' },
    ],
  },

  // ── 10. السندات المالية (قبض وصرف) ──
  {
    id: 'vouchers',
    title: 'السندات المالية (قبض وصرف)',
    route: '/vouchers',
    category: 'الحسابات',
    iconName: 'IconCash',
    permissions: [
      { code: 'vouchers.view', label: 'عرض قائمة سندات القبض والصرف', actionType: 'View' },
      { code: 'vouchers.receipt.create', label: 'إصدار سند قبض نقد/بنك جديد', actionType: 'Create' },
      { code: 'vouchers.payment.create', label: 'إصدار سند صرف مالي جديد', actionType: 'Create' },
      { code: 'vouchers.update', label: 'تعديل بيانات السند غير المرحل', actionType: 'Update' },
      { code: 'vouchers.post', label: 'ترحيل السند المالي للحسابات', actionType: 'Post', isSensitive: true },
      { code: 'vouchers.print', label: 'طباعة السند بتصاميم متعددة مع الشعار', actionType: 'Print' },
      { code: 'vouchers.delete', label: 'حذف أو إلغاء السند المالي', actionType: 'Delete', isSensitive: true },
    ],
  },

  // ── 11. تسوية عهد وصناديق الموظفين ──
  {
    id: 'sub_cashboxes',
    title: 'تسوية صناديق وعهد الموظفين',
    route: '/sub-cashboxes-settlement',
    category: 'الحسابات',
    iconName: 'IconScale',
    permissions: [
      { code: 'subCashboxes.view', label: 'عرض أرصدة وعهد كاشيرات الموظفين', actionType: 'View' },
      { code: 'subCashboxes.settle', label: 'إجراء تسوية وإيداع العهد بالصندوق الرئيسي', actionType: 'Create', isSensitive: true },
      { code: 'subCashboxes.print', label: 'طباعة إشعار تسوية وإقفال الصندوق اليومي', actionType: 'Print' },
    ],
  },

  // ── 12. الصناديق والبنوك وحسابات النقدية ──
  {
    id: 'cashboxes_banks',
    title: 'الصناديق والبنوك',
    route: '/cashboxes-banks',
    category: 'الحسابات',
    iconName: 'IconCoins',
    permissions: [
      { code: 'cashboxes.view', label: 'عرض الصناديق وحسابات البنوك', actionType: 'View' },
      { code: 'cashboxes.create', label: 'إضافة صندوق أو حساب بنكي جديد', actionType: 'Create' },
      { code: 'cashboxes.transfer', label: 'إجراء تحويل مالي بين الصناديق والبنوك', actionType: 'Create', isSensitive: true },
      { code: 'cashboxes.viewBalances', label: 'كشف الأرصدة والسيولة الحية المتوفرة', actionType: 'ViewCost', isSensitive: true },
    ],
  },

  // ── 13. الشركاء والعملاء والموردين ──
  {
    id: 'partners',
    title: 'الشركاء والعملاء والموردين',
    route: '/partners',
    category: 'الحسابات',
    iconName: 'IconUsers',
    permissions: [
      { code: 'partners.view', label: 'استعراض قائمة العملاء والشركات والموردين', actionType: 'View' },
      { code: 'partners.create', label: 'إضافة عميل أو مورد أو شركة سياحية جديدة', actionType: 'Create' },
      { code: 'partners.update', label: 'تعديل بيانات العميل وسقف الائتمان', actionType: 'Update' },
      { code: 'partners.delete', label: 'حذف أو أرشفة جهة التعامل', actionType: 'Delete', isSensitive: true },
      { code: 'partners.viewBalances', label: 'مشاهدة أرصدة ومطالبات العملاء', actionType: 'ViewCost', isSensitive: true },
    ],
  },

  // ── 14. المقاصات الخارجية ومزودي الخدمات ──
  {
    id: 'external_clearings',
    title: 'المقاصات الخارجية ومزودي الخدمات',
    route: '/external-clearings',
    category: 'الحسابات',
    iconName: 'IconBuildingBank',
    permissions: [
      { code: 'clearings.view', label: 'عرض كشوف مقاصات مزودي الخدمات (GDS & Portals)', actionType: 'View' },
      { code: 'clearings.create', label: 'تسجيل دفعة أو تغذية رصيد للمزود', actionType: 'Create', isSensitive: true },
      { code: 'clearings.reconcile', label: 'مطابقة حركات المقاصة مع الفواتير', actionType: 'Approve', isSensitive: true },
      { code: 'clearings.print', label: 'طباعة كشف ومطابقة المقاصة', actionType: 'Print' },
    ],
  },

  // ── 15. الأرباح وقائمة الدخل ──
  {
    id: 'profits',
    title: 'الأرباح وقائمة الدخل',
    route: '/profits',
    category: 'التقارير',
    iconName: 'IconReportAnalytics',
    permissions: [
      { code: 'profits.view', label: 'استعراض أرباح المبيعات وقائمة الدخل', actionType: 'ViewProfit', isSensitive: true },
      { code: 'profits.export', label: 'تصدير التقارير المالية والأرباح إلى Excel', actionType: 'Export', isSensitive: true },
      { code: 'profits.filterBranch', label: 'استعراض تقارير أرباح كافة الفروع', actionType: 'ViewAllBranches', isSensitive: true },
    ],
  },

  // ── 15b. أرباح الموظفين ──
  {
    id: 'employee-profits',
    title: 'أرباح الموظفين',
    route: '/employee-profits',
    category: 'التقارير',
    iconName: 'IconReportAnalytics',
    permissions: [
      { code: 'employeeProfits.view', label: 'استعراض أرباح الموظفين وتقسيمها', actionType: 'ViewProfit', isSensitive: true },
    ],
  },

  // ── 16. كشف الحساب والتقارير المالية ──
  {
    id: 'reports',
    title: 'كشف الحساب والتقارير',
    route: '/reports',
    category: 'التقارير',
    iconName: 'IconFileSpreadsheet',
    permissions: [
      { code: 'reports.statement.view', label: 'عرض كشف حساب تفصيلي لأي عميل أو حساب', actionType: 'View' },
      { code: 'reports.statement.print', label: 'طباعة وتصدير كشف الحساب الرسمي المعتمد', actionType: 'Print' },
      { code: 'reports.statement.sendEmail', label: 'إرسال كشف الحساب المالي بالبريد (Brevo)', actionType: 'Export' },
    ],
  },

  // ── 17. تقرير الديون وأعمار الذمم ──
  {
    id: 'debts_report',
    title: 'تقرير الديون وأعمار الذمم',
    route: '/debts-report',
    category: 'التقارير',
    iconName: 'IconReceiptTax',
    permissions: [
      { code: 'debts.view', label: 'عرض تقرير ديون العملاء وأعمار الذمم المالية', actionType: 'ViewCost', isSensitive: true },
      { code: 'debts.export', label: 'تصدير كشف الديون والمستحقات إلى Excel', actionType: 'Export', isSensitive: true },
      { code: 'debts.sendReminder', label: 'إرسال إشعارات وتنبيهات المطالبة المالية', actionType: 'Export' },
    ],
  },

  // ── 18. القوائم المالية وميزان المراجعة ──
  {
    id: 'financial_reports',
    title: 'القوائم وميزان المراجعة',
    route: '/financial-reports',
    category: 'التقارير',
    iconName: 'IconChartBar',
    permissions: [
      { code: 'financials.trialBalance', label: 'استعراض ميزان المراجعة بالمجاميع والأرصدة', actionType: 'ViewCost', isSensitive: true },
      { code: 'financials.incomeStatement', label: 'استعراض قائمة الدخل والأرباح التشغيلية', actionType: 'ViewProfit', isSensitive: true },
      { code: 'financials.balanceSheet', label: 'عرض الميزانية العمومية والمركز المالي', actionType: 'ViewCost', isSensitive: true },
    ],
  },

  // ── 19. السنوات والفترات المالية ──
  {
    id: 'fiscal_years',
    title: 'السنوات والفترات المالية',
    route: '/fiscal-years',
    category: 'الحسابات',
    iconName: 'IconCalendarEvent',
    permissions: [
      { code: 'fiscal.view', label: 'عرض السنوات والفترات المحاسبية', actionType: 'View' },
      { code: 'fiscal.create', label: 'افتتاح سنة مالية جديدة', actionType: 'Create', isSensitive: true },
      { code: 'fiscal.close', label: 'الإقفال المالي النهائي وترحيل الأرصدة الافتتاحية', actionType: 'Approve', isSensitive: true },
      { code: 'fiscal.reopen', label: 'إعادة فتح سنة مالية مقفلة للتدقيق', actionType: 'Approve', isSensitive: true },
    ],
  },

  // ── 20. الفروع والهيكل الإداري والموظفين ──
  {
    id: 'branches_structure',
    title: 'الفروع والهيكل الإداري والموظفين',
    route: '/branches-structure',
    category: 'الإدارة والرقابة',
    iconName: 'IconBuildingStore',
    permissions: [
      { code: 'branches.view', label: 'عرض قائمة الفروع والأقسام والموظفين', actionType: 'View' },
      { code: 'branches.create', label: 'إضافة فرع جديد للشركة', actionType: 'Create', isSensitive: true },
      { code: 'branches.update', label: 'تعديل بيانات وإعدادات الفرع وشعاره', actionType: 'Update' },
      { code: 'employees.create', label: 'إضافة موظف ومستخدم جديد في النظام', actionType: 'Create' },
      { code: 'employees.update', label: 'تعديل بيانات ومجموعة صلاحيات الموظف', actionType: 'Update' },
      { code: 'employees.delete', label: 'حذف موظف أو تعطيل حساب دخوله', actionType: 'Delete', isSensitive: true },
    ],
  },

  // ── 21. مجموعات الصلاحيات وأدوار الموظفين ──
  {
    id: 'permission_groups',
    title: 'صلاحيات وأدوار الموظفين (Staff RBAC)',
    route: '/permission-groups',
    category: 'الإدارة والرقابة',
    iconName: 'IconShieldCheck',
    permissions: [
      { code: 'roles.view', label: 'عرض مجموعات وأدوار موظفي الشركة', actionType: 'View' },
      { code: 'roles.create', label: 'إنشاء دور وظيفي جديد للموظفين', actionType: 'Create', isSensitive: true },
      { code: 'roles.update', label: 'تعديل وتخصيص صلاحيات الدور الوظيفي', actionType: 'Update', isSensitive: true },
      { code: 'roles.delete', label: 'حذف دور وظيفي', actionType: 'Delete', isSensitive: true },
    ],
  },

  // ── 22. إعدادات النظام وتخصيص الطباعة ──
  {
    id: 'system_settings',
    title: 'إعدادات النظام والشركة',
    route: '/system-settings',
    category: 'الإدارة والرقابة',
    iconName: 'IconSettings',
    permissions: [
      { code: 'settings.view', label: 'عرض إعدادات الشركة والنظام', actionType: 'View' },
      { code: 'settings.update', label: 'تعديل بيانات الشركة والشعار والعملات المعتمدة', actionType: 'Update', isSensitive: true },
      { code: 'settings.templates', label: 'تخصيص تصاميم الطباعة والترويسات الرسمية', actionType: 'Manage' },
      { code: 'settings.paymentMethods', label: 'ضبط وتعيين طرق الدفع المالي المعتمدة', actionType: 'Manage' },
    ],
  },

  // ── 23. الاشتراك والاستهلاك السحابي ──
  {
    id: 'subscription_settings',
    title: 'الاشتراك والاستهلاك السحابي',
    route: '/subscription-settings',
    category: 'الإدارة والرقابة',
    iconName: 'IconCoins',
    permissions: [
      { code: 'subscription.view', label: 'عرض باقة المؤسسة وعدادات الاستهلاك الحية', actionType: 'View' },
      { code: 'subscription.changePlan', label: 'طلب ترقية أو تجديد باقة الاشتراك', actionType: 'Manage', isSensitive: true },
      { code: 'subscription.viewPayments', label: 'عرض سجل مدفوعات وفواتير اشتراك الشركة', actionType: 'View' },
    ],
  },

  // ── 24. متجر الإضافات السحابية ──
  {
    id: 'addons',
    title: 'متجر الإضافات السحابية',
    route: '/addons',
    category: 'الإدارة والرقابة',
    iconName: 'IconShoppingBag',
    permissions: [
      { code: 'addons.view', label: 'تصفح متجر الإضافات والحزم السحابية', actionType: 'View' },
      { code: 'addons.purchase', label: 'شراء وتفعيل الإضافات للمؤسسة', actionType: 'Manage', isSensitive: true },
    ],
  },

  // ── 25. إدارة تسعير الباقات (لإدارة المنصة) ──
  {
    id: 'pricing_management',
    title: 'إدارة وتصميم باقات الأسعار',
    route: '/pricing-management',
    category: 'الإدارة والرقابة',
    iconName: 'IconTags',
    permissions: [
      { code: 'pricing.manage', label: 'إدارة وتعديل باقات الأسعار والشروط', actionType: 'Manage', isSensitive: true },
    ],
  },

  // ── 26. باقات الأسعار العامة ──
  {
    id: 'pricing',
    title: 'باقات الأسعار العامة',
    route: '/pricing',
    category: 'الإدارة والرقابة',
    iconName: 'IconSparkles',
    permissions: [
      { code: 'pricing.view', label: 'استعراض جدول مقارنة باقات الأسعار', actionType: 'View' },
    ],
  },

  // ── 27. تذاكر الدعم والشكاوى ──
  {
    id: 'feedback_tickets',
    title: 'تذاكر الدعم والشكاوى',
    route: '/feedback-tickets',
    category: 'الإدارة والرقابة',
    iconName: 'IconMessageReport',
    permissions: [
      { code: 'feedback.view', label: 'استعراض تذاكر الدعم الفني والاستفسارات', actionType: 'View' },
      { code: 'feedback.create', label: 'إرسال تذكرة دعم فني أو مقترح جديد', actionType: 'Create' },
      { code: 'feedback.reply', label: 'الرد على استفسارات وتذاكر الدعم', actionType: 'Update' },
    ],
  },

  // ── 28. مركز المساعدة والتوثيق ──
  {
    id: 'help_center',
    title: 'مركز المساعدة والتوثيق',
    route: '/help-center',
    category: 'الرئيسية',
    iconName: 'IconHelp',
    permissions: [
      { code: 'help.view', label: 'تصفح مركز المساعدة وشروحات النظام', actionType: 'View' },
    ],
  },

  // ── 29. لوحة تحكم المنصة المركزية (SaaS Super Admin) ──
  {
    id: 'saas_admin',
    title: 'لوحة تحكم المنصة (SaaS Super Admin)',
    route: '/saas-admin',
    category: 'الإدارة والرقابة',
    iconName: 'IconServer',
    permissions: [
      { code: 'saas.view', label: 'عرض لوحة تحكم المنصة المركزية', actionType: 'View', isSensitive: true },
      { code: 'saas.tenants.view', label: 'استعراض قائمة المؤسسات والمشتركين', actionType: 'View', isSensitive: true },
      { code: 'saas.tenants.create', label: 'إنشاء وتهيئة مؤسسة جديدة', actionType: 'Create', isSensitive: true },
      { code: 'saas.tenants.changePlan', label: 'ترقية وتعديل باقة المؤسسة', actionType: 'Manage', isSensitive: true },
      { code: 'saas.tenants.renew', label: 'تجديد الاشتراك وتسجيل الدفعات المالية', actionType: 'Manage', isSensitive: true },
      { code: 'saas.tenants.suspend', label: 'إيقاف / تعليق حساب المؤسسة', actionType: 'Manage', isSensitive: true },
      { code: 'saas.tenants.reactivate', label: 'إعادة تفعيل المؤسسة المعلقة', actionType: 'Manage', isSensitive: true },
      { code: 'saas.tenants.delete', label: 'حذف مؤسسة نهائياً من قاعدة البيانات', actionType: 'Delete', isSensitive: true },
      { code: 'saas.plans.manage', label: 'إدارة وتعديل تسعير باقات المنصة', actionType: 'Manage', isSensitive: true },
    ],
  },
];
