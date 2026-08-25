const { PrismaClient, AccountType, AccountCategory } = require('@prisma/client');
const prisma = new PrismaClient();

const FULL_IRAQI_UNIFIED_ACCOUNTS = [
  // ================= 1. الموجودات (Assets) =================
  { code: '1', nameAr: 'الموجودات (Assets)', nameEn: 'Assets', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 1, isParent: true, parentCode: null },
  
  // 11 الموجودات الثابتة
  { code: '11', nameAr: 'الموجودات الثابتة', nameEn: 'Fixed Assets', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '1' },
  { code: '111', nameAr: 'الأراضي والعقارات', nameEn: 'Land & Real Estate', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '11' },
  { code: '112', nameAr: 'المباني والإنشاءات', nameEn: 'Buildings & Structures', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '11' },
  { code: '113', nameAr: 'الآلات والمعدات', nameEn: 'Machinery & Equipment', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '11' },
  { code: '114', nameAr: 'وسائط النقل والانتقال', nameEn: 'Vehicles & Transport', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 3, isParent: true, parentCode: '11' },
  { code: '1141', nameAr: 'سيارات نقل المسافرين والوفود', nameEn: 'Passenger Buses & VIP Transport', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '114' },
  { code: '115', nameAr: 'أجهزة الحاسوب والشبكات والأنظمة', nameEn: 'Computers, Servers & IT Systems', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '11' },
  { code: '116', nameAr: 'الأثاث وأجهزة المكاتب', nameEn: 'Office Furniture & Fixtures', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '11' },
  { code: '118', nameAr: 'مجمع اندثار الموجودات الثابتة (دائن)', nameEn: 'Accumulated Depreciation', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '11' },

  // 12 مشروعات تحت التنفيذ
  { code: '12', nameAr: 'مشروعات تحت التنفيذ', nameEn: 'Projects under Execution', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '1' },
  { code: '121', nameAr: 'مباني وإنشاءات قيد التنفيذ', nameEn: 'Buildings under Construction', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '12' },
  { code: '124', nameAr: 'آلات ومعدات قيد التجهيز', nameEn: 'Equipment under Installation', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '12' },
  { code: '125', nameAr: 'حاسبات وأنظمة إلكترونية قيد التجهيز', nameEn: 'Software & IT under Implementation', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '12' },

  // 13 المخزون
  { code: '13', nameAr: 'المخزون والمستلزمات', nameEn: 'Stock & Supplies', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '1' },
  { code: '131', nameAr: 'مخزون التذاكر الورقية والمطبوعات', nameEn: 'Tickets & Printing Stock', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '13' },
  { code: '135', nameAr: 'مخزون لوازم ومهمات وقرطاسية', nameEn: 'Stationery & Office Supplies Stock', type: AccountType.ASSET, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '13' },

  // 14 المدينون (العملاء والذمم المدينة)
  { code: '14', nameAr: 'المدينون (العملاء والذمم المدينة)', nameEn: 'Debtors & Receivables', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 2, isParent: true, parentCode: '1' },
  { code: '141', nameAr: 'عملاء تذاكر الأفراد (التجزئة)', nameEn: 'Individual Ticket Clients', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 3, isParent: true, parentCode: '14' },
  { code: '1411', nameAr: 'عملاء تذاكر أفراد - بغداد', nameEn: 'Individual Clients - Baghdad', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 4, isParent: false, parentCode: '141' },
  { code: '1412', nameAr: 'عملاء تذاكر أفراد - أربيل', nameEn: 'Individual Clients - Erbil', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 4, isParent: false, parentCode: '141' },

  { code: '142', nameAr: 'عملاء الشركات والقطاع الخاص (B2B)', nameEn: 'Corporate Clients (B2B)', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 3, isParent: true, parentCode: '14' },
  { code: '1421', nameAr: 'شركة النفط الوطنية', nameEn: 'National Oil Company', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 4, isParent: false, parentCode: '142' },
  { code: '1422', nameAr: 'شركة زين العراق', nameEn: 'Zain Iraq Corporate', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 4, isParent: false, parentCode: '142' },

  { code: '143', nameAr: 'مكاتب وشركات السياحة والوكلاء', nameEn: 'Travel Agencies & Agents', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 3, isParent: true, parentCode: '14' },
  { code: '1431', nameAr: 'مكتب أفق السياحة', nameEn: 'Horizon Travel Agency', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 4, isParent: false, parentCode: '143' },
  { code: '1432', nameAr: 'مكتب الفضاء للسفر', nameEn: 'Space Travel Agency', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 4, isParent: false, parentCode: '143' },

  { code: '144', nameAr: 'أوراق القبض (كمبيالات وشيكات برسم التحصيل)', nameEn: 'Notes & Cheques Receivable', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 3, isParent: false, parentCode: '14' },

  { code: '145', nameAr: 'حسابات مدينة أخرى وسلف', nameEn: 'Other Receivables & Advances', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 3, isParent: true, parentCode: '14' },
  { code: '1451', nameAr: 'سلف العاملين والموظفين', nameEn: 'Staff Advances', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 4, isParent: false, parentCode: '145' },
  { code: '1452', nameAr: 'تأمينات لدى الغير (مطارات وخطوط)', nameEn: 'Security Deposits with Others', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 4, isParent: false, parentCode: '145' },
  { code: '1453', nameAr: 'مصاريف مدفوعة مقدماً', nameEn: 'Prepaid Expenses', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 4, isParent: false, parentCode: '145' },
  { code: '1454', nameAr: 'إيرادات مستحقة غير مقبوضة', nameEn: 'Accrued Revenues', type: AccountType.ASSET, category: AccountCategory.CUSTOMER, level: 4, isParent: false, parentCode: '145' },

  // 18 النقود والأرصدة
  { code: '18', nameAr: 'النقود والأرصدة', nameEn: 'Cash & Balances', type: AccountType.ASSET, category: AccountCategory.CASH, level: 2, isParent: true, parentCode: '1' },
  
  // 181 الصناديق النقدية
  { code: '181', nameAr: 'الصناديق النقدية (الكاش)', nameEn: 'Cashboxes', type: AccountType.ASSET, category: AccountCategory.CASH, level: 3, isParent: true, parentCode: '18' },
  { code: '1811', nameAr: 'الصندوق الرئيسي - بغداد', nameEn: 'Main Cashbox - Baghdad', type: AccountType.ASSET, category: AccountCategory.CASH, level: 4, isParent: false, parentCode: '181' },
  { code: '1812', nameAr: 'صندوق فرع أربيل', nameEn: 'Erbil Branch Cashbox', type: AccountType.ASSET, category: AccountCategory.CASH, level: 4, isParent: false, parentCode: '181' },
  { code: '1813', nameAr: 'صندوق فرع البصرة', nameEn: 'Basra Branch Cashbox', type: AccountType.ASSET, category: AccountCategory.CASH, level: 4, isParent: false, parentCode: '181' },

  // 182 الحسابات البنكية
  { code: '182', nameAr: 'الحسابات المصرفية (البنوك)', nameEn: 'Bank Accounts', type: AccountType.ASSET, category: AccountCategory.BANK, level: 3, isParent: true, parentCode: '18' },
  { code: '1821', nameAr: 'مصرف الرافدين', nameEn: 'Rafidain Bank', type: AccountType.ASSET, category: AccountCategory.BANK, level: 4, isParent: false, parentCode: '182' },
  { code: '1822', nameAr: 'مصرف الرشيد', nameEn: 'Rasheed Bank', type: AccountType.ASSET, category: AccountCategory.BANK, level: 4, isParent: false, parentCode: '182' },
  { code: '1823', nameAr: 'المصرف العراقي للتجارة (TBI)', nameEn: 'Trade Bank of Iraq (TBI)', type: AccountType.ASSET, category: AccountCategory.BANK, level: 4, isParent: false, parentCode: '182' },
  { code: '1824', nameAr: 'مصرف بغداد', nameEn: 'Bank of Baghdad', type: AccountType.ASSET, category: AccountCategory.BANK, level: 4, isParent: false, parentCode: '182' },
  { code: '1825', nameAr: 'مصرف التنمية الدولي', nameEn: 'International Development Bank', type: AccountType.ASSET, category: AccountCategory.BANK, level: 4, isParent: false, parentCode: '182' },
  { code: '1826', nameAr: 'المصرف الأهلي العراقي (NBI)', nameEn: 'National Bank of Iraq (NBI)', type: AccountType.ASSET, category: AccountCategory.BANK, level: 4, isParent: false, parentCode: '182' },

  // 183 الحسابات الإلكترونية
  { code: '183', nameAr: 'الحسابات الإلكترونية وبطاقات الدفع', nameEn: 'Electronic & Card Accounts', type: AccountType.ASSET, category: AccountCategory.CASH, level: 3, isParent: true, parentCode: '18' },
  { code: '1831', nameAr: 'حسابات Master Card والبطاقات', nameEn: 'Master Card Accounts', type: AccountType.ASSET, category: AccountCategory.CASH, level: 4, isParent: true, parentCode: '183' },
  { code: '183101', nameAr: 'Master 1', nameEn: 'Master 1', type: AccountType.ASSET, category: AccountCategory.CASH, level: 5, isParent: false, parentCode: '1831' },
  { code: '183102', nameAr: 'Master 2', nameEn: 'Master 2', type: AccountType.ASSET, category: AccountCategory.CASH, level: 5, isParent: false, parentCode: '1831' },
  { code: '183103', nameAr: 'Master 3', nameEn: 'Master 3', type: AccountType.ASSET, category: AccountCategory.CASH, level: 5, isParent: false, parentCode: '1831' },

  { code: '1832', nameAr: 'حسابات المحافظ الإلكترونية', nameEn: 'E-Wallets Accounts', type: AccountType.ASSET, category: AccountCategory.CASH, level: 4, isParent: true, parentCode: '183' },
  { code: '18321', nameAr: 'محفظة زين كاش (ZainCash)', nameEn: 'ZainCash Wallet', type: AccountType.ASSET, category: AccountCategory.CASH, level: 5, isParent: false, parentCode: '1832' },
  { code: '18322', nameAr: 'محفظة كي كارد (Qi Card)', nameEn: 'Qi Card Account', type: AccountType.ASSET, category: AccountCategory.CASH, level: 5, isParent: false, parentCode: '1832' },
  { code: '18323', nameAr: 'حساب فيزا كارد (Visa Card)', nameEn: 'Visa Card Account', type: AccountType.ASSET, category: AccountCategory.CASH, level: 5, isParent: false, parentCode: '1832' },

  { code: '184', nameAr: 'ودائع وحسابات ضمان مصرفية', nameEn: 'Bank Guarantee Deposits', type: AccountType.ASSET, category: AccountCategory.BANK, level: 3, isParent: false, parentCode: '18' },

  // ================= 2. المطلوبات ومصادر التمويل (Liabilities & Capital) =================
  { code: '2', nameAr: 'المطلوبات ومصادر التمويل (Liabilities & Capital)', nameEn: 'Liabilities & Equity', type: AccountType.LIABILITY, category: AccountCategory.GENERAL, level: 1, isParent: true, parentCode: null },
  
  // 21 مصادر التمويل الذاتي وحقوق الملكية
  { code: '21', nameAr: 'مصادر التمويل الذاتي وحقوق الملكية', nameEn: 'Capital & Equity', type: AccountType.EQUITY, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '2' },
  { code: '211', nameAr: 'رأس المال المدفوع', nameEn: 'Paid-in Capital', type: AccountType.EQUITY, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '21' },
  { code: '212', nameAr: 'الاحتياطيات العامة', nameEn: 'General Reserves', type: AccountType.EQUITY, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '21' },
  { code: '213', nameAr: 'الأرباح (الخسائر) المدورة والمرحلة', nameEn: 'Retained Earnings', type: AccountType.EQUITY, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '21' },
  { code: '214', nameAr: 'صافي نتيجة النشاط للسنة المالية الحالية', nameEn: 'Current Year Net Profit/Loss', type: AccountType.EQUITY, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '21' },

  // 22 القروض والتسهيلات المصرفية
  { code: '22', nameAr: 'القروض والتسهيلات المصرفية', nameEn: 'Loans & Bank Facilities', type: AccountType.LIABILITY, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '2' },
  { code: '221', nameAr: 'قروض مصرفية طويلة الأجل', nameEn: 'Long-term Bank Loans', type: AccountType.LIABILITY, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '22' },
  { code: '222', nameAr: 'تسهيلات مصرفية جارية وسحب مكشوف', nameEn: 'Overdraft & Credit Facilities', type: AccountType.LIABILITY, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '22' },

  // 23 المخصصات
  { code: '23', nameAr: 'المخصصات المتنوعة', nameEn: 'Provisions', type: AccountType.LIABILITY, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '2' },
  { code: '231', nameAr: 'مخصص مكافأة نهاية الخدمة للعاملين', nameEn: 'End of Service Indemnity Provision', type: AccountType.LIABILITY, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '23' },
  { code: '232', nameAr: 'مخصص ديون مشكوك في تحصيلها', nameEn: 'Provision for Doubtful Debts', type: AccountType.LIABILITY, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '23' },

  // 24 الدائنون (الموردون وشركات الطيران)
  { code: '24', nameAr: 'الدائنون (الموردون وشركات الطيران)', nameEn: 'Creditors & Payables', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 2, isParent: true, parentCode: '2' },
  { code: '241', nameAr: 'الموردون وشركات الطيران', nameEn: 'Suppliers & Airlines', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 3, isParent: true, parentCode: '24' },
  { code: '2411', nameAr: 'شركات الطيران (Airlines)', nameEn: 'Airlines Accounts', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 4, isParent: true, parentCode: '241' },
  { code: '24111', nameAr: 'الخطوط الجوية العراقية (IATA)', nameEn: 'Iraqi Airways (IA)', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 5, isParent: false, parentCode: '2411' },
  { code: '24112', nameAr: 'الخطوط الجوية التركية (Turkish Airlines)', nameEn: 'Turkish Airlines (TK)', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 5, isParent: false, parentCode: '2411' },
  { code: '24113', nameAr: 'فلاي دبي (Fly Dubai)', nameEn: 'Fly Dubai (FZ)', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 5, isParent: false, parentCode: '2411' },
  { code: '24114', nameAr: 'طيران قشم (Qeshm Air)', nameEn: 'Qeshm Air (QB)', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 5, isParent: false, parentCode: '2411' },
  { code: '24115', nameAr: 'كاسبيان إيرلاين (Caspian)', nameEn: 'Caspian Airlines (CPN)', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 5, isParent: false, parentCode: '2411' },
  { code: '24116', nameAr: 'طيران ماهان (Mahan Air)', nameEn: 'Mahan Air (W5)', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 5, isParent: false, parentCode: '2411' },
  { code: '24117', nameAr: 'طيران الجزيرة والعربية', nameEn: 'Jazeera & Air Arabia', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 5, isParent: false, parentCode: '2411' },
  { code: '24118', nameAr: 'منظمة ياتا والتسوية (IATA BSP)', nameEn: 'IATA BSP Clearing', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 5, isParent: false, parentCode: '2411' },

  { code: '2412', nameAr: 'متعهدو الفنادق والبرامج السياحية', nameEn: 'Hotels & Tour Operators', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 4, isParent: true, parentCode: '241' },
  { code: '24121', nameAr: 'متعهدو فنادق مكة والمدينة (العمرة)', nameEn: 'Makkah & Madinah Hotels', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 5, isParent: false, parentCode: '2412' },
  { code: '24122', nameAr: 'متعهدو الفنادق الدولية وتركيا', nameEn: 'International Hotels Suppliers', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 5, isParent: false, parentCode: '2412' },

  { code: '2413', nameAr: 'مكاتب ومزودو الفيز والتأشيرات', nameEn: 'Visa Processing Suppliers', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 4, isParent: true, parentCode: '241' },
  { code: '24131', nameAr: 'مزودو التأشيرات الإلكترونية (E-Visa)', nameEn: 'E-Visa Suppliers', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 5, isParent: false, parentCode: '2413' },

  { code: '2414', nameAr: 'مزودو أنظمة الحجز (GDS / Amadeus / Sabre)', nameEn: 'GDS & Reservation Portals', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 4, isParent: false, parentCode: '241' },

  { code: '242', nameAr: 'أوراق الدفع (شيكات صادرة للدفع)', nameEn: 'Notes & Cheques Payable', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 3, isParent: false, parentCode: '24' },
  { code: '243', nameAr: 'حسابات جارية للشركاء والفروع', nameEn: 'Current Accounts - Partners & Branches', type: AccountType.LIABILITY, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '24' },

  { code: '245', nameAr: 'حسابات دائنة أخرى وأمانات', nameEn: 'Other Payables & Client Deposits', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 3, isParent: true, parentCode: '24' },
  { code: '2451', nameAr: 'أمانات وودائع العملاء المقبوضة مقدمًا', nameEn: 'Client Advance Deposits', type: AccountType.LIABILITY, category: AccountCategory.SUPPLIER, level: 4, isParent: false, parentCode: '245' },
  { code: '2452', nameAr: 'مستحقات الضريبة والرسوم الحكومية', nameEn: 'Taxes & Official Fees Payable', type: AccountType.LIABILITY, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '245' },
  { code: '2453', nameAr: 'مصاريف مستحقة غير مدفوعة', nameEn: 'Accrued Expenses', type: AccountType.LIABILITY, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '245' },
  { code: '2454', nameAr: 'تأمينات مستردة للغير', nameEn: 'Refundable Third-party Deposits', type: AccountType.LIABILITY, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '245' },

  // ================= 3. الاستخدامات / التكاليف والمصروفات (Expenses & Costs) =================
  { code: '3', nameAr: 'الاستخدامات (التكاليف والمصروفات)', nameEn: 'Expenses & Costs', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 1, isParent: true, parentCode: null },
  
  // 31 الرواتب والأجور
  { code: '31', nameAr: 'الرواتب والأجور والبدلات', nameEn: 'Salaries & Wages', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '3' },
  { code: '311', nameAr: 'رواتب موظفي حجز وإصدار التذاكر', nameEn: 'Ticketing Staff Salaries', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '31' },
  { code: '312', nameAr: 'رواتب موظفي السياحة والكروبات', nameEn: 'Tourism & Tour Staff Salaries', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '31' },
  { code: '313', nameAr: 'رواتب الإدارة والمحاسبة والتقنية', nameEn: 'Admin, Finance & IT Salaries', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '31' },
  { code: '314', nameAr: 'مكافآت وبدلات وحوافز العاملين', nameEn: 'Staff Bonuses & Allowances', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '31' },

  // 32 المستلزمات السلعية
  { code: '32', nameAr: 'المستلزمات السلعية', nameEn: 'Operating Supplies', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '3' },
  { code: '321', nameAr: 'أدوات ومطبوعات مكتبية وقرطاسية', nameEn: 'Stationery & Printing', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '32' },
  { code: '322', nameAr: 'وقود ومحروقات وسيارات', nameEn: 'Fuel & Transportation Supplies', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '32' },
  { code: '323', nameAr: 'لوازم صيانة وضيافة ونظافة', nameEn: 'Maintenance & Hospitality Supplies', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '32' },

  // 33 تكاليف الخدمات والنشاط السياحي
  { code: '33', nameAr: 'تكاليف الخدمات والنشاط السياحي', nameEn: 'Cost of Tourism Services', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '3' },
  
  { code: '331', nameAr: 'تكلفة مبيعات تذاكر الطيران (Flight Tickets)', nameEn: 'Flight Tickets Cost', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: true, parentCode: '33' },
  { code: '3311', nameAr: 'تكلفة تذاكر الطيران المنتظم (BSP/IATA)', nameEn: 'Scheduled Flights Cost (IATA)', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '331' },
  { code: '3312', nameAr: 'تكلفة تذاكر الطيران العارض والداخلي', nameEn: 'Charter & Domestic Flights Cost', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '331' },
  { code: '3313', nameAr: 'رسوم وغرامات تعديل وإلغاء التذاكر للموردين', nameEn: 'Ticket Penalty & Cancellation Cost', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '331' },

  { code: '332', nameAr: 'تكلفة الفنادق والبرامج السياحية', nameEn: 'Hotels & Tour Packages Cost', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: true, parentCode: '33' },
  { code: '3321', nameAr: 'تكلفة حجز الفنادق والإقامة', nameEn: 'Hotel Booking Cost', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '332' },
  { code: '3322', nameAr: 'تكلفة النقل والمزارات والبرامج', nameEn: 'Transportation & Tours Cost', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '332' },

  { code: '333', nameAr: 'تكلفة التأشيرات والفيز', nameEn: 'Visa Processing Cost', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: true, parentCode: '33' },
  { code: '3331', nameAr: 'تكلفة إصدار التأشيرات والفيز', nameEn: 'Visa Issuance Cost', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '333' },

  { code: '334', nameAr: 'اشتراكات وأنظمة الحجز الإلكتروني (GDS)', nameEn: 'GDS & Reservation Systems Cost', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '33' },

  // 35 المصروفات الإدارية والعمومية
  { code: '35', nameAr: 'المصروفات الإدارية والعمومية', nameEn: 'General & Admin Expenses', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '3' },
  { code: '351', nameAr: 'إيجار المكاتب والمقرات والفروع', nameEn: 'Office & Branch Rent', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '35' },
  { code: '352', nameAr: 'أجور الكهرباء والاتصالات والإنترنت', nameEn: 'Electricity & Telecom', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '35' },
  { code: '353', nameAr: 'مصاريف التسويق والإعلانات الرقمية', nameEn: 'Marketing & Digital Ads', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '35' },
  { code: '354', nameAr: 'عمولات ومصاريف تحويل الأموال والبنوك', nameEn: 'Bank Charges & Remittance Fees', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '35' },
  { code: '355', nameAr: 'أتعاب مهنية واستشارات وتدقيق حسابات', nameEn: 'Professional & Audit Fees', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '35' },
  { code: '356', nameAr: 'مصاريف ضيافة واستقبال وتنقلات', nameEn: 'Hospitality & Travel Expenses', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '35' },

  // 37 الاندثار والاستهلاك
  { code: '37', nameAr: 'الاندثار والاستهلاك', nameEn: 'Depreciation & Amortization', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '3' },
  { code: '371', nameAr: 'اندثار الأثاث والأجهزة والمعدات', nameEn: 'Depreciation of Furniture & Equipment', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '37' },
  { code: '372', nameAr: 'استهلاك برامج وأنظمة الحاسوب', nameEn: 'Amortization of Software', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '37' },

  // 39 خسائر فروقات الصرف والتحويل
  { code: '39', nameAr: 'خسائر فروقات الصرف وتحويل العملة', nameEn: 'Foreign Exchange Losses', type: AccountType.EXPENSE, category: AccountCategory.GENERAL, level: 2, isParent: false, parentCode: '3' },

  // ================= 4. الموارد / الإيرادات (Revenues) =================
  { code: '4', nameAr: 'الموارد (الإيرادات)', nameEn: 'Revenues', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 1, isParent: true, parentCode: null },
  
  // 41 إيرادات النشاط السياحي والسفر
  { code: '41', nameAr: 'إيرادات النشاط السياحي والسفر', nameEn: 'Tourism Activity Revenues', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '4' },
  
  { code: '411', nameAr: 'إيرادات مبيعات تذاكر الطيران', nameEn: 'Flight Ticket Sales Revenue', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 3, isParent: true, parentCode: '41' },
  { code: '4111', nameAr: 'إيرادات تذاكر الأفراد (التجزئة)', nameEn: 'Individual Ticket Sales', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '411' },
  { code: '4112', nameAr: 'إيرادات تذاكر الشركات والوكالات B2B', nameEn: 'Corporate Ticket Sales (B2B)', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '411' },
  { code: '4113', nameAr: 'إيرادات رسوم وعمولات تعديل واسترجاع التذاكر', nameEn: 'Ticket Exchange & Refund Fees', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '411' },

  { code: '412', nameAr: 'إيرادات البرامج الفندقية والقروبات', nameEn: 'Hotels & Packages Revenue', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 3, isParent: true, parentCode: '41' },
  { code: '4121', nameAr: 'إيرادات الحجوزات الفندقية', nameEn: 'Hotel Bookings Revenue', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '412' },
  { code: '4122', nameAr: 'إيرادات الرحلات والبرامج السياحية الكاملة', nameEn: 'Tour Packages Revenue', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '412' },

  { code: '413', nameAr: 'إيرادات الفيز والتأشيرات', nameEn: 'Visa Revenue', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 3, isParent: true, parentCode: '41' },
  { code: '4131', nameAr: 'إيرادات إصدار الفيز والتأشيرات', nameEn: 'Visa Issuance Revenue', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 4, isParent: false, parentCode: '413' },

  { code: '414', nameAr: 'العمولات ومكافآت شركات الطيران', nameEn: 'Airlines Commissions & Incentives', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '41' },

  // 43 إيرادات تشغيلية أخرى
  { code: '43', nameAr: 'إيرادات تشغيلية وخدمات أخرى', nameEn: 'Other Operating Revenues', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 2, isParent: false, parentCode: '4' },

  // 44 الإيرادات المالية وأرباح فروقات الصرف
  { code: '44', nameAr: 'الإيرادات المالية وأرباح فروقات الصرف', nameEn: 'Financial Revenues & FX Gains', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 2, isParent: true, parentCode: '4' },
  { code: '441', nameAr: 'أرباح فروقات أسعار صرف العملات (USD/IQD)', nameEn: 'Foreign Exchange Gains (USD/IQD)', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '44' },
  { code: '442', nameAr: 'فوائد وعوائد مصرفية', nameEn: 'Bank Interest & Returns', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 3, isParent: false, parentCode: '44' },

  // 48 إيرادات متنوعة وعرضية
  { code: '48', nameAr: 'إيرادات متنوعة وعرضية', nameEn: 'Miscellaneous Revenues', type: AccountType.REVENUE, category: AccountCategory.GENERAL, level: 2, isParent: false, parentCode: '4' },
];

async function syncDirect() {
  const companies = await prisma.company.findMany();
  for (const company of companies) {
    console.log(`Syncing for ${company.name}`);
    
    // 1. Fetch all existing accounts
    const existingAccounts = await prisma.account.findMany({ where: { companyId: company.id } });
    const byCode = new Map(existingAccounts.map(a => [a.code, a]));

    // 2. Upsert each account in order of level (Level 1, then 2, 3, 4, 5)
    const sorted = [...FULL_IRAQI_UNIFIED_ACCOUNTS].sort((a, b) => a.level - b.level);

    for (const acc of sorted) {
      let parentId = null;
      if (acc.parentCode) {
        const parentAcc = byCode.get(acc.parentCode);
        if (parentAcc) {
          parentId = parentAcc.id;
        }
      }

      if (byCode.has(acc.code)) {
        const current = byCode.get(acc.code);
        const updated = await prisma.account.update({
          where: { id: current.id },
          data: {
            nameAr: acc.nameAr,
            nameEn: acc.nameEn,
            type: acc.type,
            category: acc.category,
            level: acc.level,
            isParent: acc.isParent,
            parentId: parentId || current.parentId,
          }
        });
        byCode.set(acc.code, updated);
      } else {
        const created = await prisma.account.create({
          data: {
            code: acc.code,
            nameAr: acc.nameAr,
            nameEn: acc.nameEn,
            type: acc.type,
            category: acc.category,
            level: acc.level,
            isParent: acc.isParent,
            parentId,
            companyId: company.id,
          }
        });
        byCode.set(acc.code, created);
      }
    }

    // 3. Re-verify all parentId relations
    for (const acc of sorted) {
      if (acc.parentCode) {
        const parentAcc = byCode.get(acc.parentCode);
        const current = byCode.get(acc.code);
        if (parentAcc && current && current.parentId !== parentAcc.id) {
          const updated = await prisma.account.update({
            where: { id: current.id },
            data: { parentId: parentAcc.id }
          });
          byCode.set(acc.code, updated);
        }
      }
    }
  }
  console.log('✅ Synchronized complete tree!');
}

syncDirect().catch(console.error).finally(() => prisma.$disconnect());
