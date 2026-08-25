const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const chartData = [
  // 1 - الأصول
  { code: '1', nameAr: 'الأصول', nameEn: 'Assets', type: 'ASSET', category: 'GENERAL', isParent: true, level: 1, parentCode: null, branchScope: 'ALL_BRANCHES' },
  
  // 11 - الأصول غير المتداولة
  { code: '11', nameAr: 'الأصول غير المتداولة', nameEn: 'Non-Current Assets', type: 'ASSET', category: 'GENERAL', isParent: true, level: 2, parentCode: '1', branchScope: 'ALL_BRANCHES' },
  { code: '111', nameAr: 'الممتلكات والآلات والمعدات', nameEn: 'Property, Plant & Equipment', type: 'ASSET', category: 'GENERAL', isParent: true, level: 3, parentCode: '11', branchScope: 'ALL_BRANCHES' },
  { code: '1116', nameAr: 'أثاث وأجهزة مكاتب', nameEn: 'Office Furniture & Equipment', type: 'ASSET', category: 'GENERAL', isParent: true, level: 4, parentCode: '111', branchScope: 'ALL_BRANCHES' },
  { code: '11161', nameAr: 'أثاث', nameEn: 'Furniture', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1116', branchScope: 'CURRENT_BRANCH' },
  { code: '11162', nameAr: 'أجهزة تكييف وتبريد', nameEn: 'Air Conditioning & Cooling Equipment', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1116', branchScope: 'CURRENT_BRANCH' },
  { code: '11163', nameAr: 'حاسبات إلكترونية', nameEn: 'Computers & Electronic Equipment', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1116', branchScope: 'CURRENT_BRANCH' },
  { code: '11164', nameAr: 'آلات حاسبة وكاتبة واستنساخ', nameEn: 'Calculators, Typewriters & Copiers', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1116', branchScope: 'CURRENT_BRANCH' },
  { code: '11165', nameAr: 'أدوات وأجهزة مكاتب', nameEn: 'Office Tools & Appliances', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1116', branchScope: 'CURRENT_BRANCH' },
  { code: '11166', nameAr: 'كتب ومراجع علمية', nameEn: 'Books & Scientific References', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1116', branchScope: 'CURRENT_BRANCH' },
  { code: '11167', nameAr: 'ستائر ومفروشات', nameEn: 'Curtains & Furnishings', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1116', branchScope: 'CURRENT_BRANCH' },

  // 12 - الإنفاق الرأسمالي (مشروعات تحت التنفيذ)
  { code: '12', nameAr: 'الإنفاق الرأسمالي (مشروعات تحت التنفيذ)', nameEn: 'Capital Expenditure (WIP)', type: 'ASSET', category: 'GENERAL', isParent: true, level: 2, parentCode: '1', branchScope: 'ALL_BRANCHES' },
  { code: '121', nameAr: 'الإنفاق الرأسمالي على الممتلكات والآلات والمعدات', nameEn: 'Capital Expenditure on PPE', type: 'ASSET', category: 'GENERAL', isParent: true, level: 3, parentCode: '12', branchScope: 'ALL_BRANCHES' },
  { code: '1216', nameAr: 'أثاث وأجهزة مكاتب تحت التنفيذ', nameEn: 'Office Furniture & Equipment WIP', type: 'ASSET', category: 'GENERAL', isParent: false, level: 4, parentCode: '121', branchScope: 'ALL_BRANCHES' },
  { code: '125', nameAr: 'إنفاق استثماري', nameEn: 'Investment Expenditure', type: 'ASSET', category: 'GENERAL', isParent: true, level: 3, parentCode: '12', branchScope: 'ALL_BRANCHES' },
  { code: '1251', nameAr: 'دفعات مقدمة', nameEn: 'Advance Payments', type: 'ASSET', category: 'GENERAL', isParent: false, level: 4, parentCode: '125', branchScope: 'ALL_BRANCHES' },
  { code: '1252', nameAr: 'اعتمادات مستندية لشراء أصول غير متداولة', nameEn: 'Letters of Credit for Non-Current Assets', type: 'ASSET', category: 'GENERAL', isParent: false, level: 4, parentCode: '125', branchScope: 'ALL_BRANCHES' },
  { code: '1253', nameAr: 'أصول غير متداولة بطريق الشحن', nameEn: 'Non-Current Assets in Transit', type: 'ASSET', category: 'GENERAL', isParent: false, level: 4, parentCode: '125', branchScope: 'ALL_BRANCHES' },

  // 13 - الأصول المتداولة
  { code: '13', nameAr: 'الأصول المتداولة', nameEn: 'Current Assets', type: 'ASSET', category: 'GENERAL', isParent: true, level: 2, parentCode: '1', branchScope: 'ALL_BRANCHES' },
  { code: '131', nameAr: 'المخزون', nameEn: 'Inventory', type: 'ASSET', category: 'GENERAL', isParent: true, level: 3, parentCode: '13', branchScope: 'ALL_BRANCHES' },
  { code: '1315', nameAr: 'مخزون المتنوعات', nameEn: 'Miscellaneous Inventory', type: 'ASSET', category: 'GENERAL', isParent: true, level: 4, parentCode: '131', branchScope: 'ALL_BRANCHES' },
  { code: '13151', nameAr: 'مخزون اللوازم والمهمات', nameEn: 'Supplies & Materials Inventory', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1315', branchScope: 'CURRENT_BRANCH' },
  { code: '13152', nameAr: 'مخزون القرطاسية', nameEn: 'Stationery Inventory', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1315', branchScope: 'CURRENT_BRANCH' },
  { code: '1317', nameAr: 'مخزون البضائع والأراضي بغرض البيع', nameEn: 'Goods & Land for Resale', type: 'ASSET', category: 'GENERAL', isParent: true, level: 4, parentCode: '131', branchScope: 'ALL_BRANCHES' },
  { code: '13171', nameAr: 'مخزون البضائع بغرض البيع', nameEn: 'Goods for Resale', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1317', branchScope: 'CURRENT_BRANCH' },

  // 132 - الذمم المدينة
  { code: '132', nameAr: 'الذمم المدينة', nameEn: 'Accounts Receivable (Debtors)', type: 'ASSET', category: 'GENERAL', isParent: true, level: 3, parentCode: '13', branchScope: 'ALL_BRANCHES' },
  { code: '1321', nameAr: 'مدينون تجاريون', nameEn: 'Trade Debtors', type: 'ASSET', category: 'GENERAL', isParent: true, level: 4, parentCode: '132', branchScope: 'ALL_BRANCHES' },
  { code: '13211', nameAr: 'مدينون قطاع عام (الجهات الحكومية وشركات القطاع العام)', nameEn: 'Public Sector Debtors', type: 'ASSET', category: 'CUSTOMER', isParent: false, level: 5, parentCode: '1321', branchScope: 'CURRENT_BRANCH' },
  { code: '13212', nameAr: 'مدينون قطاع تعاوني', nameEn: 'Cooperative Sector Debtors', type: 'ASSET', category: 'CUSTOMER', isParent: false, level: 5, parentCode: '1321', branchScope: 'CURRENT_BRANCH' },
  { code: '13213', nameAr: 'مدينون قطاع مختلط', nameEn: 'Mixed Sector Debtors', type: 'ASSET', category: 'CUSTOMER', isParent: false, level: 5, parentCode: '1321', branchScope: 'CURRENT_BRANCH' },
  { code: '13214', nameAr: 'مدينون قطاع خاص', nameEn: 'Private Sector Debtors', type: 'ASSET', category: 'CUSTOMER', isParent: true, level: 5, parentCode: '1321', branchScope: 'ALL_BRANCHES' },
  { code: '132141', nameAr: 'العملاء الأفراد (حجوزات التذاكر والتجزئة)', nameEn: 'Individual Ticket Clients', type: 'ASSET', category: 'CUSTOMER', isParent: false, level: 6, parentCode: '13214', branchScope: 'CURRENT_BRANCH' },
  { code: '132142', nameAr: 'الشركات الخاصة (حجوزات الشركات B2B)', nameEn: 'Corporate Clients B2B', type: 'ASSET', category: 'CUSTOMER', isParent: false, level: 6, parentCode: '13214', branchScope: 'CURRENT_BRANCH' },
  { code: '132143', nameAr: 'مكاتب السفر والسياحة', nameEn: 'Travel Agencies B2B', type: 'ASSET', category: 'CUSTOMER', isParent: false, level: 6, parentCode: '13214', branchScope: 'CURRENT_BRANCH' },
  { code: '132144', nameAr: 'الوكلاء الفرعيون والوسطاء', nameEn: 'Sub-Agents & Brokers', type: 'ASSET', category: 'CUSTOMER', isParent: false, level: 6, parentCode: '13214', branchScope: 'CURRENT_BRANCH' },
  { code: '13215', nameAr: 'مدينون العالم الخارجي (العملاء والشركات خارج العراق)', nameEn: 'Foreign Debtors (Outside Iraq)', type: 'ASSET', category: 'CUSTOMER', isParent: false, level: 5, parentCode: '1321', branchScope: 'CURRENT_BRANCH' },

  { code: '1322', nameAr: 'أوراق قبض', nameEn: 'Notes Receivable', type: 'ASSET', category: 'GENERAL', isParent: true, level: 4, parentCode: '132', branchScope: 'ALL_BRANCHES' },
  { code: '13221', nameAr: 'أوراق قبض قطاع عام', nameEn: 'Notes Receivable Public Sector', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1322', branchScope: 'CURRENT_BRANCH' },
  { code: '13222', nameAr: 'أوراق قبض قطاع تعاوني', nameEn: 'Notes Receivable Cooperative', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1322', branchScope: 'CURRENT_BRANCH' },
  { code: '13223', nameAr: 'أوراق قبض قطاع مختلط', nameEn: 'Notes Receivable Mixed', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1322', branchScope: 'CURRENT_BRANCH' },
  { code: '13224', nameAr: 'أوراق قبض قطاع خاص', nameEn: 'Notes Receivable Private Sector', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1322', branchScope: 'CURRENT_BRANCH' },
  { code: '13225', nameAr: 'أوراق قبض قطاع خارجي', nameEn: 'Notes Receivable Foreign Sector', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1322', branchScope: 'CURRENT_BRANCH' },
  { code: '13226', nameAr: 'أوراق قبض برسم التحصيل', nameEn: 'Notes Receivable for Collection', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1322', branchScope: 'CURRENT_BRANCH' },
  { code: '13227', nameAr: 'أوراق قبض مرفوضة', nameEn: 'Dishonored Notes Receivable', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1322', branchScope: 'CURRENT_BRANCH' },

  { code: '1323', nameAr: 'حسابات جارية مدينة', nameEn: 'Current Accounts Receivable', type: 'ASSET', category: 'GENERAL', isParent: true, level: 4, parentCode: '132', branchScope: 'ALL_BRANCHES' },
  { code: '13231', nameAr: 'حسابات جارية مدينة غير تجارية', nameEn: 'Non-Trade Current Accounts', type: 'ASSET', category: 'GENERAL', isParent: true, level: 5, parentCode: '1323', branchScope: 'ALL_BRANCHES' },
  { code: '132311', nameAr: 'بين الوحدات الاقتصادية الرئيسية', nameEn: 'Between Main Economic Units', type: 'ASSET', category: 'GENERAL', isParent: false, level: 6, parentCode: '13231', branchScope: 'ALL_BRANCHES' },
  { code: '132312', nameAr: 'داخل الوحدة وفروعها (الحسابات الجارية بين الفروع)', nameEn: 'Inter-Branch Current Accounts', type: 'ASSET', category: 'GENERAL', isParent: false, level: 6, parentCode: '13231', branchScope: 'ALL_BRANCHES' },

  { code: '1325', nameAr: 'مدينو النشاط غير الجاري', nameEn: 'Non-Operating Debtors', type: 'ASSET', category: 'GENERAL', isParent: false, level: 4, parentCode: '132', branchScope: 'ALL_BRANCHES' },

  { code: '1326', nameAr: 'حسابات مدينة متنوعة', nameEn: 'Miscellaneous Receivables', type: 'ASSET', category: 'GENERAL', isParent: true, level: 4, parentCode: '132', branchScope: 'ALL_BRANCHES' },
  { code: '13261', nameAr: 'تأمينات لدى الغير', nameEn: 'Deposits with Others', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1326', branchScope: 'CURRENT_BRANCH' },
  { code: '13262', nameAr: 'إيرادات مستحقة', nameEn: 'Accrued Revenues', type: 'ASSET', category: 'GENERAL', isParent: true, level: 5, parentCode: '1326', branchScope: 'ALL_BRANCHES' },
  { code: '132621', nameAr: 'عمولات تذاكر مستحقة', nameEn: 'Accrued Ticket Commissions', type: 'ASSET', category: 'GENERAL', isParent: false, level: 6, parentCode: '13262', branchScope: 'CURRENT_BRANCH' },
  { code: '132622', nameAr: 'عمولات شركات طيران مستحقة', nameEn: 'Accrued Airline Commissions', type: 'ASSET', category: 'GENERAL', isParent: false, level: 6, parentCode: '13262', branchScope: 'CURRENT_BRANCH' },
  { code: '132623', nameAr: 'عمولات فنادق مستحقة', nameEn: 'Accrued Hotel Commissions', type: 'ASSET', category: 'GENERAL', isParent: false, level: 6, parentCode: '13262', branchScope: 'CURRENT_BRANCH' },
  { code: '132624', nameAr: 'عمولات خدمات سفر مستحقة', nameEn: 'Accrued Travel Services Commissions', type: 'ASSET', category: 'GENERAL', isParent: false, level: 6, parentCode: '13262', branchScope: 'CURRENT_BRANCH' },
  { code: '13263', nameAr: 'مصاريف مدفوعة مقدماً', nameEn: 'Prepaid Expenses', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1326', branchScope: 'CURRENT_BRANCH' },
  { code: '13268', nameAr: 'فروقات أصول نقدية ومخزنية وغير متداولة', nameEn: 'Cash & Inventory Variances', type: 'ASSET', category: 'GENERAL', isParent: true, level: 5, parentCode: '1326', branchScope: 'ALL_BRANCHES' },
  { code: '132681', nameAr: 'فروقات مدينة لظروف عادية', nameEn: 'Normal Variances', type: 'ASSET', category: 'GENERAL', isParent: true, level: 6, parentCode: '13268', branchScope: 'ALL_BRANCHES' },
  { code: '1326811', nameAr: 'فروقات نقدية عادية', nameEn: 'Cash Variances Normal', type: 'ASSET', category: 'GENERAL', isParent: false, level: 7, parentCode: '132681', branchScope: 'CURRENT_BRANCH' },
  { code: '1326812', nameAr: 'فروقات مخزنية عادية', nameEn: 'Inventory Variances Normal', type: 'ASSET', category: 'GENERAL', isParent: false, level: 7, parentCode: '132681', branchScope: 'CURRENT_BRANCH' },
  { code: '1326813', nameAr: 'فروقات أصول غير متداولة عادية', nameEn: 'Non-Current Asset Variances Normal', type: 'ASSET', category: 'GENERAL', isParent: false, level: 7, parentCode: '132681', branchScope: 'CURRENT_BRANCH' },
  { code: '132682', nameAr: 'فروقات مدينة لظروف غير عادية', nameEn: 'Abnormal Variances', type: 'ASSET', category: 'GENERAL', isParent: true, level: 6, parentCode: '13268', branchScope: 'ALL_BRANCHES' },
  { code: '1326821', nameAr: 'فروقات نقدية غير عادية', nameEn: 'Cash Variances Abnormal', type: 'ASSET', category: 'GENERAL', isParent: false, level: 7, parentCode: '132682', branchScope: 'CURRENT_BRANCH' },
  { code: '1326822', nameAr: 'فروقات مخزنية غير عادية', nameEn: 'Inventory Variances Abnormal', type: 'ASSET', category: 'GENERAL', isParent: false, level: 7, parentCode: '132682', branchScope: 'CURRENT_BRANCH' },
  { code: '1326823', nameAr: 'فروقات أصول غير متداولة غير عادية', nameEn: 'Non-Current Asset Variances Abnormal', type: 'ASSET', category: 'GENERAL', isParent: false, level: 7, parentCode: '132682', branchScope: 'CURRENT_BRANCH' },
  { code: '13269', nameAr: 'طلبات التعويض', nameEn: 'Compensation Claims', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1326', branchScope: 'ALL_BRANCHES' },

  { code: '1327', nameAr: 'سلف', nameEn: 'Advances', type: 'ASSET', category: 'GENERAL', isParent: true, level: 4, parentCode: '132', branchScope: 'ALL_BRANCHES' },
  { code: '13271', nameAr: 'سلف مستديمة', nameEn: 'Petty Cash Advances', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1327', branchScope: 'CURRENT_BRANCH' },
  { code: '13272', nameAr: 'سلف لأغراض النشاط', nameEn: 'Operating Advances', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1327', branchScope: 'CURRENT_BRANCH' },
  { code: '13273', nameAr: 'سلف المنتسبين', nameEn: 'Employee Advances', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1327', branchScope: 'CURRENT_BRANCH' },
  { code: '13274', nameAr: 'سلف الزواج', nameEn: 'Marriage Advances', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1327', branchScope: 'CURRENT_BRANCH' },
  { code: '1329', nameAr: 'مدينو عقود التأجير', nameEn: 'Lease Contract Debtors', type: 'ASSET', category: 'GENERAL', isParent: false, level: 4, parentCode: '132', branchScope: 'ALL_BRANCHES' },

  { code: '133', nameAr: 'أصول غير متداولة معروضة للبيع', nameEn: 'Non-Current Assets Held for Sale', type: 'ASSET', category: 'GENERAL', isParent: false, level: 3, parentCode: '13', branchScope: 'ALL_BRANCHES' },

  // 134 - النقود
  { code: '134', nameAr: 'النقود', nameEn: 'Cash & Cash Equivalents', type: 'ASSET', category: 'GENERAL', isParent: true, level: 3, parentCode: '13', branchScope: 'ALL_BRANCHES' },
  { code: '1341', nameAr: 'نقدية بالصندوق', nameEn: 'Cash in Hand', type: 'ASSET', category: 'CASH', isParent: true, level: 4, parentCode: '134', branchScope: 'ALL_BRANCHES' },
  { code: '13411', nameAr: 'نقدية لدى صندوق المركز', nameEn: 'Headquarters Cashbox', type: 'ASSET', category: 'CASH', isParent: true, level: 5, parentCode: '1341', branchScope: 'ALL_BRANCHES' },
  { code: '134111', nameAr: 'صندوق المركز - بالعملة المحلية (IQD)', nameEn: 'HQ Cashbox IQD', type: 'ASSET', category: 'CASH', isParent: false, level: 6, parentCode: '13411', currency: 'IQD', branchScope: 'CURRENT_BRANCH' },
  { code: '134112', nameAr: 'صندوق المركز - بالعملة الأجنبية (USD)', nameEn: 'HQ Cashbox USD', type: 'ASSET', category: 'CASH', isParent: false, level: 6, parentCode: '13411', currency: 'USD', branchScope: 'CURRENT_BRANCH' },
  { code: '13412', nameAr: 'نقدية لدى صندوق الفروع', nameEn: 'Branch Cashboxes', type: 'ASSET', category: 'CASH', isParent: true, level: 5, parentCode: '1341', branchScope: 'ALL_BRANCHES' },
  { code: '134121', nameAr: 'صندوق الفرع - بالعملة المحلية (IQD)', nameEn: 'Branch Cashbox IQD', type: 'ASSET', category: 'CASH', isParent: false, level: 6, parentCode: '13412', currency: 'IQD', branchScope: 'CURRENT_BRANCH' },
  { code: '134122', nameAr: 'صندوق الفرع - بالعملة الأجنبية (USD)', nameEn: 'Branch Cashbox USD', type: 'ASSET', category: 'CASH', isParent: false, level: 6, parentCode: '13412', currency: 'USD', branchScope: 'CURRENT_BRANCH' },

  { code: '1342', nameAr: 'نقدية لدى المصارف', nameEn: 'Cash at Banks', type: 'ASSET', category: 'BANK', isParent: true, level: 4, parentCode: '134', branchScope: 'ALL_BRANCHES' },
  { code: '13421', nameAr: 'حسابات المصارف بالعملة المحلية (IQD)', nameEn: 'Bank Accounts IQD', type: 'ASSET', category: 'BANK', isParent: true, level: 5, parentCode: '1342', branchScope: 'ALL_BRANCHES' },
  { code: '134211', nameAr: 'حساب بنك محلي IQD', nameEn: 'Local Bank IQD', type: 'ASSET', category: 'BANK', isParent: false, level: 6, parentCode: '13421', currency: 'IQD', branchScope: 'CURRENT_BRANCH' },
  { code: '134212', nameAr: 'حساب دفع إلكتروني / محفظة IQD', nameEn: 'E-Wallet / Payment Gateway IQD', type: 'ASSET', category: 'BANK', isParent: false, level: 6, parentCode: '13421', currency: 'IQD', branchScope: 'CURRENT_BRANCH' },
  { code: '134213', nameAr: 'بطاقة Master داخلي IQD', nameEn: 'Internal Master Card IQD', type: 'ASSET', category: 'BANK', isParent: false, level: 6, parentCode: '13421', currency: 'IQD', branchScope: 'CURRENT_BRANCH' },

  { code: '13422', nameAr: 'حسابات المصارف بالعملة الأجنبية (USD)', nameEn: 'Bank Accounts USD', type: 'ASSET', category: 'BANK', isParent: true, level: 5, parentCode: '1342', branchScope: 'ALL_BRANCHES' },
  { code: '134221', nameAr: 'حساب بنك دولي USD', nameEn: 'International Bank USD', type: 'ASSET', category: 'BANK', isParent: false, level: 6, parentCode: '13422', currency: 'USD', branchScope: 'CURRENT_BRANCH' },
  { code: '134222', nameAr: 'حساب دفع إلكتروني دولي USD', nameEn: 'International E-Payment USD', type: 'ASSET', category: 'BANK', isParent: false, level: 6, parentCode: '13422', currency: 'USD', branchScope: 'CURRENT_BRANCH' },
  { code: '134223', nameAr: 'بطاقة Master داخلي USD', nameEn: 'Internal Master Card USD', type: 'ASSET', category: 'BANK', isParent: false, level: 6, parentCode: '13422', currency: 'USD', branchScope: 'CURRENT_BRANCH' },

  { code: '1343', nameAr: 'نقدية لدى الخزائن', nameEn: 'Treasury Cash', type: 'ASSET', category: 'CASH', isParent: false, level: 4, parentCode: '134', branchScope: 'ALL_BRANCHES' },
  { code: '1344', nameAr: 'صكوك وحوالات', nameEn: 'Cheques & Money Orders', type: 'ASSET', category: 'GENERAL', isParent: true, level: 4, parentCode: '134', branchScope: 'ALL_BRANCHES' },
  { code: '13441', nameAr: 'صكوك وحوالات قيد التحصيل', nameEn: 'Cheques for Collection', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1344', branchScope: 'CURRENT_BRANCH' },
  { code: '13442', nameAr: 'حوالات بالطريق', nameEn: 'Transfers in Transit', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1344', branchScope: 'CURRENT_BRANCH' },
  { code: '13444', nameAr: 'صكوك وحوالات مرفوضة', nameEn: 'Dishonored Cheques', type: 'ASSET', category: 'GENERAL', isParent: false, level: 5, parentCode: '1344', branchScope: 'CURRENT_BRANCH' },
  { code: '135', nameAr: 'القروض الممنوحة والاستثمارات قصيرة الأجل', nameEn: 'Short-Term Loans & Investments', type: 'ASSET', category: 'GENERAL', isParent: false, level: 3, parentCode: '13', branchScope: 'ALL_BRANCHES' },

  // 14 - الأصول الأخرى
  { code: '14', nameAr: 'الأصول الأخرى', nameEn: 'Other Assets', type: 'ASSET', category: 'GENERAL', isParent: true, level: 2, parentCode: '1', branchScope: 'ALL_BRANCHES' },
  { code: '141', nameAr: 'أصول ضريبية مؤجلة', nameEn: 'Deferred Tax Assets', type: 'ASSET', category: 'GENERAL', isParent: false, level: 3, parentCode: '14', branchScope: 'ALL_BRANCHES' },
  { code: '142', nameAr: 'تعويضات وغرامات مؤجلة', nameEn: 'Deferred Compensations', type: 'ASSET', category: 'GENERAL', isParent: false, level: 3, parentCode: '14', branchScope: 'ALL_BRANCHES' },
  { code: '143', nameAr: 'حقوق التأجير طويلة الأجل', nameEn: 'Long-Term Lease Rights', type: 'ASSET', category: 'GENERAL', isParent: false, level: 3, parentCode: '14', branchScope: 'ALL_BRANCHES' },
  { code: '145', nameAr: 'استثمارات بالقيمة العادلة', nameEn: 'Fair Value Investments', type: 'ASSET', category: 'GENERAL', isParent: false, level: 3, parentCode: '14', branchScope: 'ALL_BRANCHES' },
  { code: '146', nameAr: 'حقوق بيع البضائع وإعادة الشراء', nameEn: 'Repo Rights', type: 'ASSET', category: 'GENERAL', isParent: false, level: 3, parentCode: '14', branchScope: 'ALL_BRANCHES' },
  { code: '147', nameAr: 'حقوق توزيعات أرباح', nameEn: 'Dividend Rights', type: 'ASSET', category: 'GENERAL', isParent: false, level: 3, parentCode: '14', branchScope: 'ALL_BRANCHES' },
  { code: '148', nameAr: 'الحقوق الناشئة عن العقود', nameEn: 'Contractual Rights', type: 'ASSET', category: 'GENERAL', isParent: false, level: 3, parentCode: '14', branchScope: 'ALL_BRANCHES' },

  // 15 - الأصول غير الملموسة
  { code: '15', nameAr: 'الأصول غير الملموسة', nameEn: 'Intangible Assets', type: 'ASSET', category: 'GENERAL', isParent: true, level: 2, parentCode: '1', branchScope: 'ALL_BRANCHES' },
  { code: '151', nameAr: 'شهرة المحل', nameEn: 'Goodwill', type: 'ASSET', category: 'GENERAL', isParent: false, level: 3, parentCode: '15', branchScope: 'ALL_BRANCHES' },
  { code: '152', nameAr: 'حقوق اختراع', nameEn: 'Patents', type: 'ASSET', category: 'GENERAL', isParent: false, level: 3, parentCode: '15', branchScope: 'ALL_BRANCHES' },
  { code: '153', nameAr: 'حقوق الامتياز والتراخيص', nameEn: 'Franchises & Licenses', type: 'ASSET', category: 'GENERAL', isParent: true, level: 3, parentCode: '15', branchScope: 'ALL_BRANCHES' },
  { code: '1531', nameAr: 'حقوق الامتياز', nameEn: 'Franchise Rights', type: 'ASSET', category: 'GENERAL', isParent: false, level: 4, parentCode: '153', branchScope: 'ALL_BRANCHES' },
  { code: '1532', nameAr: 'حقوق التراخيص والتصاريح السياحية', nameEn: 'Tourism Licenses & Permits', type: 'ASSET', category: 'GENERAL', isParent: false, level: 4, parentCode: '153', branchScope: 'ALL_BRANCHES' },
  { code: '154', nameAr: 'العلامة التجارية', nameEn: 'Trademarks', type: 'ASSET', category: 'GENERAL', isParent: false, level: 3, parentCode: '15', branchScope: 'ALL_BRANCHES' },
  { code: '155', nameAr: 'الأبحاث والتجارب', nameEn: 'R&D', type: 'ASSET', category: 'GENERAL', isParent: false, level: 3, parentCode: '15', branchScope: 'ALL_BRANCHES' },
  { code: '156', nameAr: 'حقوق النشر والطبع والتأليف', nameEn: 'Copyrights', type: 'ASSET', category: 'GENERAL', isParent: false, level: 3, parentCode: '15', branchScope: 'ALL_BRANCHES' },
  { code: '158', nameAr: 'أصول غير ملموسة أخرى', nameEn: 'Other Intangibles', type: 'ASSET', category: 'GENERAL', isParent: false, level: 3, parentCode: '15', branchScope: 'ALL_BRANCHES' },

  { code: '18', nameAr: 'الأرصدة المدينة للحسابات المؤجلة تنظيمياً', nameEn: 'Deferred Regulatory Debtor Accounts', type: 'ASSET', category: 'GENERAL', isParent: false, level: 2, parentCode: '1', branchScope: 'ALL_BRANCHES' },
  { code: '19', nameAr: 'الحسابات المتقابلة المدينة', nameEn: 'Contra Debit Accounts', type: 'ASSET', category: 'GENERAL', isParent: false, level: 2, parentCode: '1', branchScope: 'ALL_BRANCHES' },

  // 2 - الالتزامات وحقوق الملكية
  { code: '2', nameAr: 'الالتزامات وحقوق الملكية', nameEn: 'Liabilities & Equity', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 1, parentCode: null, branchScope: 'ALL_BRANCHES' },

  // 21 - الالتزامات غير المتداولة
  { code: '21', nameAr: 'الالتزامات غير المتداولة', nameEn: 'Non-Current Liabilities', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 2, parentCode: '2', branchScope: 'ALL_BRANCHES' },
  { code: '211', nameAr: 'التزامات تمويل الممتلكات والآلات والمعدات', nameEn: 'Financing Liabilities for PPE', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 3, parentCode: '21', branchScope: 'ALL_BRANCHES' },
  { code: '215', nameAr: 'الالتزامات طويلة الأجل', nameEn: 'Long-Term Liabilities', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 3, parentCode: '21', branchScope: 'ALL_BRANCHES' },
  { code: '2151', nameAr: 'قروض مستلمة طويلة الأجل', nameEn: 'Long-Term Loans Received', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 4, parentCode: '215', branchScope: 'ALL_BRANCHES' },
  { code: '21511', nameAr: 'قروض من القطاع العام', nameEn: 'Loans from Public Sector', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2151', branchScope: 'ALL_BRANCHES' },
  { code: '21512', nameAr: 'قروض من القطاع التعاوني', nameEn: 'Loans from Cooperative Sector', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2151', branchScope: 'ALL_BRANCHES' },
  { code: '21513', nameAr: 'قروض من القطاع المختلط', nameEn: 'Loans from Mixed Sector', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2151', branchScope: 'ALL_BRANCHES' },
  { code: '21514', nameAr: 'قروض من القطاع الخاص', nameEn: 'Loans from Private Sector', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2151', branchScope: 'ALL_BRANCHES' },
  { code: '21515', nameAr: 'قروض من العالم الخارجي', nameEn: 'Foreign Loans', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2151', branchScope: 'ALL_BRANCHES' },

  // 22 - متراكم الاندثار والحسابات المقابلة للأصول
  { code: '22', nameAr: 'متراكم الاندثار والحسابات المقابلة للأصول', nameEn: 'Accumulated Depreciation & Contra Accounts', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 2, parentCode: '2', branchScope: 'ALL_BRANCHES' },
  { code: '221', nameAr: 'متراكم اندثار الممتلكات والآلات والمعدات', nameEn: 'Accumulated Depreciation PPE', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 3, parentCode: '22', branchScope: 'ALL_BRANCHES' },
  { code: '2216', nameAr: 'متراكم اندثار أثاث وأجهزة مكاتب', nameEn: 'Acc. Depreciation Office Equipment', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 4, parentCode: '221', branchScope: 'ALL_BRANCHES' },
  { code: '224', nameAr: 'متراكم الديون المشكوك في تحصيلها', nameEn: 'Allowance for Doubtful Debts', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 3, parentCode: '22', branchScope: 'ALL_BRANCHES' },
  { code: '225', nameAr: 'تعديل القيمة العادلة', nameEn: 'Fair Value Adjustment', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 3, parentCode: '22', branchScope: 'ALL_BRANCHES' },
  { code: '228', nameAr: 'متراكم إطفاء الأصول غير الملموسة', nameEn: 'Accumulated Amortization', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 3, parentCode: '22', branchScope: 'ALL_BRANCHES' },

  // 23 - الالتزامات المتداولة
  { code: '23', nameAr: 'الالتزامات المتداولة', nameEn: 'Current Liabilities', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 2, parentCode: '2', branchScope: 'ALL_BRANCHES' },
  { code: '232', nameAr: 'الذمم الدائنة', nameEn: 'Accounts Payable (Creditors)', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 3, parentCode: '23', branchScope: 'ALL_BRANCHES' },
  { code: '2321', nameAr: 'دائنون تجاريون', nameEn: 'Trade Creditors', type: 'LIABILITY', category: 'SUPPLIER', isParent: true, level: 4, parentCode: '232', branchScope: 'ALL_BRANCHES' },
  { code: '23211', nameAr: 'دائنون قطاع عام (شركات وموردون من القطاع العام)', nameEn: 'Public Sector Suppliers', type: 'LIABILITY', category: 'SUPPLIER', isParent: false, level: 5, parentCode: '2321', branchScope: 'CURRENT_BRANCH' },
  { code: '23212', nameAr: 'دائنون قطاع تعاوني', nameEn: 'Cooperative Suppliers', type: 'LIABILITY', category: 'SUPPLIER', isParent: false, level: 5, parentCode: '2321', branchScope: 'CURRENT_BRANCH' },
  { code: '23213', nameAr: 'دائنون قطاع مختلط', nameEn: 'Mixed Sector Suppliers', type: 'LIABILITY', category: 'SUPPLIER', isParent: false, level: 5, parentCode: '2321', branchScope: 'CURRENT_BRANCH' },

  { code: '23214', nameAr: 'دائنون قطاع خاص (موردو الخدمات السياحية والتذاكر)', nameEn: 'Private Sector Suppliers', type: 'LIABILITY', category: 'SUPPLIER', isParent: true, level: 5, parentCode: '2321', branchScope: 'ALL_BRANCHES' },
  { code: '232141', nameAr: 'شركات طيران عراقية خاصة', nameEn: 'Private Iraqi Airlines', type: 'LIABILITY', category: 'SUPPLIER', isParent: false, level: 6, parentCode: '23214', branchScope: 'CURRENT_BRANCH' },
  { code: '232142', nameAr: 'موردو التذاكر ومنصات التوزيع (Consolidators)', nameEn: 'Ticket Consolidators & Suppliers', type: 'LIABILITY', category: 'SUPPLIER', isParent: false, level: 6, parentCode: '23214', branchScope: 'CURRENT_BRANCH' },
  { code: '232143', nameAr: 'موردو الفنادق والإقامة', nameEn: 'Hotel Suppliers', type: 'LIABILITY', category: 'SUPPLIER', isParent: false, level: 6, parentCode: '23214', branchScope: 'CURRENT_BRANCH' },
  { code: '232144', nameAr: 'موردو خدمات الفيزا والتأشيرات', nameEn: 'Visa Service Providers', type: 'LIABILITY', category: 'SUPPLIER', isParent: false, level: 6, parentCode: '23214', branchScope: 'CURRENT_BRANCH' },
  { code: '232145', nameAr: 'موردو الخدمات والبرامج السياحية والنقل', nameEn: 'Tourism & Transport Suppliers', type: 'LIABILITY', category: 'SUPPLIER', isParent: false, level: 6, parentCode: '23214', branchScope: 'CURRENT_BRANCH' },
  { code: '232146', nameAr: 'Master خارجي - مورد عراقي', nameEn: 'External Master - Local Supplier', type: 'LIABILITY', category: 'SUPPLIER', isParent: false, level: 6, parentCode: '23214', branchScope: 'CURRENT_BRANCH' },

  { code: '23215', nameAr: 'دائنون العالم الخارجي (موردو وشركات الطيران الخارجية)', nameEn: 'Foreign Suppliers & Airlines', type: 'LIABILITY', category: 'SUPPLIER', isParent: true, level: 5, parentCode: '2321', branchScope: 'ALL_BRANCHES' },
  { code: '232151', nameAr: 'شركات الطيران الأجنبية والدولية', nameEn: 'International Airlines', type: 'LIABILITY', category: 'SUPPLIER', isParent: false, level: 6, parentCode: '23215', branchScope: 'CURRENT_BRANCH' },
  { code: '232152', nameAr: 'موردو التذاكر والمنظومات الأجانب', nameEn: 'Foreign Ticket Suppliers', type: 'LIABILITY', category: 'SUPPLIER', isParent: false, level: 6, parentCode: '23215', branchScope: 'CURRENT_BRANCH' },
  { code: '232153', nameAr: 'موردو الفنادق والمنصات العالمية (Bedsopia / WebBeds / RateHawk)', nameEn: 'Global Hotel Platforms', type: 'LIABILITY', category: 'SUPPLIER', isParent: false, level: 6, parentCode: '23215', branchScope: 'CURRENT_BRANCH' },
  { code: '232154', nameAr: 'Master خارجي - مورد أجنبي', nameEn: 'External Master - Foreign Supplier', type: 'LIABILITY', category: 'SUPPLIER', isParent: false, level: 6, parentCode: '23215', branchScope: 'CURRENT_BRANCH' },
  { code: '23216', nameAr: 'دائنون بالدفع الآجل', nameEn: 'Deferred Payment Creditors', type: 'LIABILITY', category: 'SUPPLIER', isParent: false, level: 5, parentCode: '2321', branchScope: 'CURRENT_BRANCH' },

  { code: '2322', nameAr: 'أوراق دفع', nameEn: 'Notes Payable', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 4, parentCode: '232', branchScope: 'ALL_BRANCHES' },
  { code: '23221', nameAr: 'أوراق دفع قطاع عام', nameEn: 'Notes Payable Public', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2322', branchScope: 'CURRENT_BRANCH' },
  { code: '23222', nameAr: 'أوراق دفع قطاع تعاوني', nameEn: 'Notes Payable Cooperative', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2322', branchScope: 'CURRENT_BRANCH' },
  { code: '23223', nameAr: 'أوراق دفع قطاع مختلط', nameEn: 'Notes Payable Mixed', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2322', branchScope: 'CURRENT_BRANCH' },
  { code: '23224', nameAr: 'أوراق دفع قطاع خاص', nameEn: 'Notes Payable Private', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2322', branchScope: 'CURRENT_BRANCH' },
  { code: '23225', nameAr: 'أوراق دفع قطاع خارجي', nameEn: 'Notes Payable Foreign', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2322', branchScope: 'CURRENT_BRANCH' },

  { code: '2323', nameAr: 'حسابات جارية دائنة', nameEn: 'Current Accounts Payable', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 4, parentCode: '232', branchScope: 'ALL_BRANCHES' },
  { code: '23231', nameAr: 'حسابات جارية دائنة غير تجارية', nameEn: 'Non-Trade Current Payables', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 5, parentCode: '2323', branchScope: 'ALL_BRANCHES' },
  { code: '232311', nameAr: 'بين الوحدات الاقتصادية الرئيسية', nameEn: 'Between Main Units', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 6, parentCode: '23231', branchScope: 'ALL_BRANCHES' },
  { code: '232312', nameAr: 'داخل الوحدة وفروعها (حسابات جارية دائنة بين الفروع)', nameEn: 'Inter-Branch Payables', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 6, parentCode: '23231', branchScope: 'ALL_BRANCHES' },

  { code: '2324', nameAr: 'حسابات التعهدات', nameEn: 'Commitment Accounts', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 4, parentCode: '232', branchScope: 'ALL_BRANCHES' },
  { code: '23241', nameAr: 'دفعات مستلمة مقدماً (دفعات مقدمة من العملاء)', nameEn: 'Customer Advances Received', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2324', branchScope: 'CURRENT_BRANCH' },
  { code: '23242', nameAr: 'لقاء المنجز', nameEn: 'Against Completed Work', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2324', branchScope: 'ALL_BRANCHES' },

  { code: '2325', nameAr: 'دائنو النشاط غير الجاري', nameEn: 'Non-Operating Creditors', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 4, parentCode: '232', branchScope: 'ALL_BRANCHES' },

  { code: '2326', nameAr: 'حسابات دائنة متنوعة', nameEn: 'Miscellaneous Payables', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 4, parentCode: '232', branchScope: 'ALL_BRANCHES' },
  { code: '23261', nameAr: 'تأمينات مستلمة', nameEn: 'Deposits Received', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2326', branchScope: 'CURRENT_BRANCH' },
  { code: '23262', nameAr: 'إيرادات مستلمة مقدماً', nameEn: 'Unearned Revenues', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2326', branchScope: 'CURRENT_BRANCH' },
  { code: '23263', nameAr: 'مصاريف مستحقة', nameEn: 'Accrued Expenses', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2326', branchScope: 'CURRENT_BRANCH' },
  { code: '23264', nameAr: 'رواتب وأجور مستحقة', nameEn: 'Accrued Salaries & Wages', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2326', branchScope: 'CURRENT_BRANCH' },
  { code: '23265', nameAr: 'رواتب وأجور معادة', nameEn: 'Returned Salaries', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2326', branchScope: 'CURRENT_BRANCH' },
  { code: '23266', nameAr: 'هيئة التقاعد الوطنية', nameEn: 'National Pension Authority', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2326', branchScope: 'ALL_BRANCHES' },
  { code: '23267', nameAr: 'التقاعد والضمان الاجتماعي', nameEn: 'Social Security Fund', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2326', branchScope: 'ALL_BRANCHES' },
  { code: '23268', nameAr: 'فروقات أصول دائنة', nameEn: 'Credit Asset Variances', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 5, parentCode: '2326', branchScope: 'ALL_BRANCHES' },
  { code: '232681', nameAr: 'فروقات نقدية دائنة', nameEn: 'Cash Variances Credit', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 6, parentCode: '23268', branchScope: 'CURRENT_BRANCH' },
  { code: '232682', nameAr: 'فروقات مخزنية دائنة', nameEn: 'Inventory Variances Credit', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 6, parentCode: '23268', branchScope: 'CURRENT_BRANCH' },
  { code: '232683', nameAr: 'فروقات أصول غير متداولة دائنة', nameEn: 'Non-Current Asset Variances Credit', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 6, parentCode: '23268', branchScope: 'CURRENT_BRANCH' },

  { code: '2327', nameAr: 'استقطاعات لحساب الغير', nameEn: 'Deductions for Others', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 4, parentCode: '232', branchScope: 'ALL_BRANCHES' },
  { code: '2328', nameAr: 'دائنو توزيع الأرباح', nameEn: 'Dividends Payable', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 4, parentCode: '232', branchScope: 'ALL_BRANCHES' },
  { code: '23281', nameAr: 'حصة الخزينة العامة', nameEn: 'Public Treasury Share', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2328', branchScope: 'ALL_BRANCHES' },
  { code: '23282', nameAr: 'حصة العاملين من الأرباح', nameEn: 'Employees Profit Share', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2328', branchScope: 'ALL_BRANCHES' },
  { code: '23283', nameAr: 'حصة صندوق الحماية الاجتماعية', nameEn: 'Social Welfare Fund Share', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2328', branchScope: 'ALL_BRANCHES' },
  { code: '23284', nameAr: 'دائنو توزيع أرباح أخرى', nameEn: 'Other Dividends Payable', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2328', branchScope: 'ALL_BRANCHES' },
  { code: '23285', nameAr: 'حصة المساهمين', nameEn: 'Shareholders Dividends', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2328', branchScope: 'ALL_BRANCHES' },
  { code: '2329', nameAr: 'دائنو أسعار الصرف المؤجلة', nameEn: 'Deferred FX Creditors', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 4, parentCode: '232', branchScope: 'ALL_BRANCHES' },

  { code: '234', nameAr: 'المصارف الدائنة (سحب على المكشوف)', nameEn: 'Bank Overdraft', type: 'LIABILITY', category: 'BANK', isParent: false, level: 3, parentCode: '23', branchScope: 'ALL_BRANCHES' },
  { code: '235', nameAr: 'الالتزامات قصيرة الأجل', nameEn: 'Short-Term Liabilities', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 3, parentCode: '23', branchScope: 'ALL_BRANCHES' },
  { code: '2351', nameAr: 'قروض مستلمة قصيرة الأجل', nameEn: 'Short-Term Loans Received', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 4, parentCode: '235', branchScope: 'ALL_BRANCHES' },
  { code: '23511', nameAr: 'قروض قصيرة من القطاع العام', nameEn: 'Short Loans Public', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2351', branchScope: 'ALL_BRANCHES' },
  { code: '23512', nameAr: 'قروض قصيرة من القطاع التعاوني', nameEn: 'Short Loans Cooperative', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2351', branchScope: 'ALL_BRANCHES' },
  { code: '23513', nameAr: 'قروض قصيرة من القطاع المختلط', nameEn: 'Short Loans Mixed', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2351', branchScope: 'ALL_BRANCHES' },
  { code: '23514', nameAr: 'قروض قصيرة من القطاع الخاص', nameEn: 'Short Loans Private', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2351', branchScope: 'ALL_BRANCHES' },
  { code: '23515', nameAr: 'قروض قصيرة من العالم الخارجي', nameEn: 'Short Loans Foreign', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2351', branchScope: 'ALL_BRANCHES' },

  // 24 - الالتزامات الأخرى
  { code: '24', nameAr: 'الالتزامات الأخرى', nameEn: 'Other Liabilities', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 2, parentCode: '2', branchScope: 'ALL_BRANCHES' },
  { code: '241', nameAr: 'التزامات ضريبية مؤجلة', nameEn: 'Deferred Tax Liabilities', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 3, parentCode: '24', branchScope: 'ALL_BRANCHES' },
  { code: '242', nameAr: 'التزامات ومطالبات وغرامات مؤجلة', nameEn: 'Deferred Fines & Claims', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 3, parentCode: '24', branchScope: 'ALL_BRANCHES' },
  { code: '243', nameAr: 'التزامات عقود الإيجار', nameEn: 'Lease Contract Liabilities', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 3, parentCode: '24', branchScope: 'ALL_BRANCHES' },
  { code: '245', nameAr: 'إيرادات مؤجلة', nameEn: 'Deferred Revenues', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 3, parentCode: '24', branchScope: 'ALL_BRANCHES' },
  { code: '246', nameAr: 'التزامات بيع البضائع وعقود الصرف المؤجلة', nameEn: 'Repo & FX Contract Liabilities', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 3, parentCode: '24', branchScope: 'ALL_BRANCHES' },
  { code: '247', nameAr: 'التزام حق استخدام الأصول غير الملموسة', nameEn: 'Right of Use Liabilities', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 3, parentCode: '24', branchScope: 'ALL_BRANCHES' },
  { code: '248', nameAr: 'الالتزامات الناشئة عن العقود', nameEn: 'Contractual Liabilities', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 3, parentCode: '24', branchScope: 'ALL_BRANCHES' },

  // 25 - التخصيصات
  { code: '25', nameAr: 'التخصيصات والمخصصات', nameEn: 'Provisions', type: 'LIABILITY', category: 'GENERAL', isParent: true, level: 2, parentCode: '2', branchScope: 'ALL_BRANCHES' },
  { code: '251', nameAr: 'مخصص انخفاض الأصول', nameEn: 'Asset Impairment Provision', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 3, parentCode: '25', branchScope: 'ALL_BRANCHES' },
  { code: '255', nameAr: 'مخصص الالتزامات والمطالبات', nameEn: 'Claims Provision', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 3, parentCode: '25', branchScope: 'ALL_BRANCHES' },
  { code: '257', nameAr: 'مخصص خسائر فروقات أسعار الصرف الأجنبي', nameEn: 'FX Loss Provision', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 3, parentCode: '25', branchScope: 'ALL_BRANCHES' },
  { code: '258', nameAr: 'مخصصات متنوعة', nameEn: 'Miscellaneous Provisions', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 3, parentCode: '25', branchScope: 'ALL_BRANCHES' },

  // 26 - حقوق الملكية
  { code: '26', nameAr: 'حقوق الملكية', nameEn: 'Equity', type: 'EQUITY', category: 'GENERAL', isParent: true, level: 2, parentCode: '2', branchScope: 'ALL_BRANCHES' },
  { code: '261', nameAr: 'رأس المال', nameEn: 'Capital', type: 'EQUITY', category: 'GENERAL', isParent: true, level: 3, parentCode: '26', branchScope: 'ALL_BRANCHES' },
  { code: '2611', nameAr: 'رأس المال المدفوع', nameEn: 'Paid-in Capital', type: 'EQUITY', category: 'GENERAL', isParent: false, level: 4, parentCode: '261', branchScope: 'ALL_BRANCHES' },
  { code: '262', nameAr: 'رأس المال الإضافي / الاحتياطيات', nameEn: 'Reserves & Additional Capital', type: 'EQUITY', category: 'GENERAL', isParent: true, level: 3, parentCode: '26', branchScope: 'ALL_BRANCHES' },
  { code: '2622', nameAr: 'احتياطيات رأسمالية', nameEn: 'Capital Reserves', type: 'EQUITY', category: 'GENERAL', isParent: true, level: 4, parentCode: '262', branchScope: 'ALL_BRANCHES' },
  { code: '26221', nameAr: 'احتياطي التوسعات', nameEn: 'Expansion Reserve', type: 'EQUITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2622', branchScope: 'ALL_BRANCHES' },
  { code: '26222', nameAr: 'الاحتياطي العام', nameEn: 'General Reserve', type: 'EQUITY', category: 'GENERAL', isParent: false, level: 5, parentCode: '2622', branchScope: 'ALL_BRANCHES' },
  { code: '2625', nameAr: 'الاحتياطي القانوني', nameEn: 'Legal Reserve', type: 'EQUITY', category: 'GENERAL', isParent: false, level: 4, parentCode: '262', branchScope: 'ALL_BRANCHES' },
  { code: '2627', nameAr: 'احتياطيات متنوعة', nameEn: 'Miscellaneous Reserves', type: 'EQUITY', category: 'GENERAL', isParent: false, level: 4, parentCode: '262', branchScope: 'ALL_BRANCHES' },

  { code: '263', nameAr: 'الأرباح المحتجزة', nameEn: 'Retained Earnings', type: 'EQUITY', category: 'GENERAL', isParent: true, level: 3, parentCode: '26', branchScope: 'ALL_BRANCHES' },
  { code: '2631', nameAr: 'الفائض المتراكم (الأرباح المدورة)', nameEn: 'Accumulated Surplus', type: 'EQUITY', category: 'GENERAL', isParent: false, level: 4, parentCode: '263', branchScope: 'ALL_BRANCHES' },
  { code: '2632', nameAr: 'العجز المتراكم (الخسائر المدورة)', nameEn: 'Accumulated Deficit', type: 'EQUITY', category: 'GENERAL', isParent: false, level: 4, parentCode: '263', branchScope: 'ALL_BRANCHES' },
  { code: '2633', nameAr: 'تغير السياسات والتقديرات وتصحيح الأخطاء', nameEn: 'Changes in Policies & Errors', type: 'EQUITY', category: 'GENERAL', isParent: false, level: 4, parentCode: '263', branchScope: 'ALL_BRANCHES' },
  { code: '264', nameAr: 'الدخل الشامل الآخر', nameEn: 'Other Comprehensive Income', type: 'EQUITY', category: 'GENERAL', isParent: false, level: 3, parentCode: '26', branchScope: 'ALL_BRANCHES' },
  { code: '269', nameAr: 'حساب النشاط الجاري', nameEn: 'Current Operating Account', type: 'EQUITY', category: 'GENERAL', isParent: true, level: 3, parentCode: '26', branchScope: 'ALL_BRANCHES' },
  { code: '2691', nameAr: 'النشاط الجاري (الأرباح والخسائر للعام الحالي)', nameEn: 'Current Operating Profit/Loss', type: 'EQUITY', category: 'GENERAL', isParent: false, level: 4, parentCode: '269', branchScope: 'ALL_BRANCHES' },

  { code: '28', nameAr: 'الحسابات التنظيمية المؤجلة', nameEn: 'Deferred Regulatory Creditor Accounts', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 2, parentCode: '2', branchScope: 'ALL_BRANCHES' },
  { code: '29', nameAr: 'الحسابات المتقابلة الدائنة', nameEn: 'Contra Credit Accounts', type: 'LIABILITY', category: 'GENERAL', isParent: false, level: 2, parentCode: '2', branchScope: 'ALL_BRANCHES' },

  // 3 - الاستخدامات (المصروفات)
  { code: '3', nameAr: 'الاستخدامات (المصروفات)', nameEn: 'Expenditures (Expenses)', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 1, parentCode: null, branchScope: 'ALL_BRANCHES' },

  // 31 - الرواتب والأجور
  { code: '31', nameAr: 'الرواتب والأجور', nameEn: 'Salaries & Wages', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 2, parentCode: '3', branchScope: 'ALL_BRANCHES' },
  { code: '311', nameAr: 'الرواتب النقدية للموظفين', nameEn: 'Cash Salaries', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 3, parentCode: '31', branchScope: 'ALL_BRANCHES' },
  { code: '3111', nameAr: 'رواتب الموظفين الأساسية', nameEn: 'Basic Salaries', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '311', branchScope: 'CURRENT_BRANCH' },
  { code: '3112', nameAr: 'مخصصات الشهادة', nameEn: 'Degree Allowances', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '311', branchScope: 'CURRENT_BRANCH' },
  { code: '3113', nameAr: 'مخصصات المنصب والإدارة', nameEn: 'Position Allowances', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '311', branchScope: 'CURRENT_BRANCH' },
  { code: '3114', nameAr: 'مخصصات عائلية', nameEn: 'Family Allowances', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '311', branchScope: 'CURRENT_BRANCH' },
  { code: '3115', nameAr: 'مخصصات مهنية وفنية', nameEn: 'Technical Allowances', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '311', branchScope: 'CURRENT_BRANCH' },
  { code: '3116', nameAr: 'أجور أعمال إضافية (Overtime)', nameEn: 'Overtime Wages', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '311', branchScope: 'CURRENT_BRANCH' },
  { code: '3117', nameAr: 'مخصصات تعويضية', nameEn: 'Compensatory Allowances', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '311', branchScope: 'CURRENT_BRANCH' },
  { code: '3118', nameAr: 'مكافآت وحوافز مبيعات التذاكر', nameEn: 'Bonuses & Sales Incentives', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '311', branchScope: 'CURRENT_BRANCH' },
  { code: '314', nameAr: 'المساهمة في الضمان الاجتماعي للموظفين', nameEn: 'Social Security Contribution', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 3, parentCode: '31', branchScope: 'CURRENT_BRANCH' },
  { code: '318', nameAr: 'منافع الموظفين', nameEn: 'Employee Benefits', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 3, parentCode: '31', branchScope: 'CURRENT_BRANCH' },

  // 32 - المستلزمات السلعية
  { code: '32', nameAr: 'المستلزمات السلعية', nameEn: 'Material Supplies', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 2, parentCode: '3', branchScope: 'ALL_BRANCHES' },
  { code: '325', nameAr: 'المتنوعات السلعية', nameEn: 'Miscellaneous Materials', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 3, parentCode: '32', branchScope: 'ALL_BRANCHES' },
  { code: '3251', nameAr: 'اللوازم والمهمات والمطبوعات', nameEn: 'Supplies & Forms', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '325', branchScope: 'CURRENT_BRANCH' },
  { code: '3252', nameAr: 'القرطاسية ومستلزمات المكاتب', nameEn: 'Office Stationery', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '325', branchScope: 'CURRENT_BRANCH' },
  { code: '327', nameAr: 'المياه والكهرباء', nameEn: 'Water & Electricity', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 3, parentCode: '32', branchScope: 'ALL_BRANCHES' },
  { code: '3271', nameAr: 'المياه', nameEn: 'Water', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '327', branchScope: 'CURRENT_BRANCH' },
  { code: '3272', nameAr: 'الكهرباء والمولدات', nameEn: 'Electricity & Generators', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '327', branchScope: 'CURRENT_BRANCH' },
  { code: '329', nameAr: 'مستلزمات سلعية أخرى', nameEn: 'Other Material Supplies', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 3, parentCode: '32', branchScope: 'CURRENT_BRANCH' },

  // 33 - المستلزمات الخدمية
  { code: '33', nameAr: 'المستلزمات الخدمية (المصروفات التشغيلية والخدمية)', nameEn: 'Service Supplies (Operating Expenses)', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 2, parentCode: '3', branchScope: 'ALL_BRANCHES' },
  { code: '331', nameAr: 'نفقات الخدمات الأساسية', nameEn: 'Basic Service Expenses', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 3, parentCode: '33', branchScope: 'ALL_BRANCHES' },
  { code: '3311', nameAr: 'نفقات النقل والإيفاد والاتصالات', nameEn: 'Travel & Transportation Expenses', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 4, parentCode: '331', branchScope: 'ALL_BRANCHES' },
  { code: '33111', nameAr: 'نقل العاملين', nameEn: 'Staff Transportation', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '3311', branchScope: 'CURRENT_BRANCH' },
  { code: '33113', nameAr: 'السفر والإيفاد لمهام العمل', nameEn: 'Business Travel & Missions', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '3311', branchScope: 'CURRENT_BRANCH' },
  { code: '3313', nameAr: 'نفقات الاتصالات (الإنترنت والهاتف والاشتراكات الرقمية)', nameEn: 'Telecommunications & Internet', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '331', branchScope: 'CURRENT_BRANCH' },
  { code: '3314', nameAr: 'خدمات أبحاث واستشارات وتطوير', nameEn: 'Consulting & Development', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '331', branchScope: 'CURRENT_BRANCH' },
  { code: '3315', nameAr: 'نفقات التدريب والتطوير وتأهيل الكوادر', nameEn: 'Training & Development', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '331', branchScope: 'CURRENT_BRANCH' },
  { code: '3316', nameAr: 'خدمات الترويج والضيافة والعلاقات العامة', nameEn: 'Promotion & Hospitality', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 4, parentCode: '331', branchScope: 'ALL_BRANCHES' },
  { code: '33161', nameAr: 'دعاية وإعلان وحملات التسويق', nameEn: 'Advertising & Marketing', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '3316', branchScope: 'CURRENT_BRANCH' },
  { code: '33162', nameAr: 'نشر وطبع البروشورات والمواد الإعلانية', nameEn: 'Publishing & Printing', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '3316', branchScope: 'CURRENT_BRANCH' },
  { code: '33163', nameAr: 'ضيافة واستقبال العملاء والوفود', nameEn: 'Hospitality', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '3316', branchScope: 'CURRENT_BRANCH' },
  { code: '33166', nameAr: 'مؤتمرات ومعارض سياحية وندوات', nameEn: 'Tourism Conferences & Exhibitions', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '3316', branchScope: 'CURRENT_BRANCH' },

  { code: '3319', nameAr: 'نفقات أساسية أخرى (اشتراكات أنظمة الحجز GDS)', nameEn: 'GDS & Reservation Systems', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 4, parentCode: '331', branchScope: 'ALL_BRANCHES' },
  { code: '33191', nameAr: 'اشتراك نظام Amadeus', nameEn: 'Amadeus Subscription', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '3319', branchScope: 'CURRENT_BRANCH' },
  { code: '33192', nameAr: 'اشتراك نظام Sabre', nameEn: 'Sabre Subscription', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '3319', branchScope: 'CURRENT_BRANCH' },
  { code: '33193', nameAr: 'اشتراك نظام Galileo / Travelport', nameEn: 'Galileo / Travelport Subscription', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '3319', branchScope: 'CURRENT_BRANCH' },
  { code: '33194', nameAr: 'أنظمة الحجز والخدمات السحابية والبرمجيات', nameEn: 'Cloud Systems & Reservation Software', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '3319', branchScope: 'CURRENT_BRANCH' },

  { code: '332', nameAr: 'نفقات الصيانة', nameEn: 'Maintenance Expenses', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 3, parentCode: '33', branchScope: 'ALL_BRANCHES' },
  { code: '33216', nameAr: 'صيانة أثاث وأجهزة مكاتب', nameEn: 'Office Equipment Maintenance', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 4, parentCode: '332', branchScope: 'ALL_BRANCHES' },
  { code: '332161', nameAr: 'صيانة أثاث', nameEn: 'Furniture Maintenance', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '33216', branchScope: 'CURRENT_BRANCH' },
  { code: '332162', nameAr: 'صيانة أجهزة تكييف وتبريد', nameEn: 'AC Maintenance', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '33216', branchScope: 'CURRENT_BRANCH' },
  { code: '332163', nameAr: 'صيانة حاسبات وشبكات وسيرفرات', nameEn: 'IT & Network Maintenance', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '33216', branchScope: 'CURRENT_BRANCH' },
  { code: '332164', nameAr: 'صيانة طابعات وآلات استنساخ', nameEn: 'Printers & Copiers Maintenance', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '33216', branchScope: 'CURRENT_BRANCH' },
  { code: '332165', nameAr: 'صيانة أدوات وأجهزة مكاتب أخرى', nameEn: 'Other Office Maintenance', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '33216', branchScope: 'CURRENT_BRANCH' },

  { code: '334', nameAr: 'استئجار أصول غير متداولة', nameEn: 'Rent Expenses', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 3, parentCode: '33', branchScope: 'ALL_BRANCHES' },
  { code: '33412', nameAr: 'استئجار مبانٍ وإنشاءات (إيجار مقرات وفروع المكتب)', nameEn: 'Office Building Rent', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '334', branchScope: 'CURRENT_BRANCH' },
  { code: '33416', nameAr: 'استئجار أثاث وأجهزة مكاتب', nameEn: 'Office Equipment Rent', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '334', branchScope: 'CURRENT_BRANCH' },

  { code: '335', nameAr: 'خسائر الاستثمارات وفروقات الصرف', nameEn: 'Investment & FX Losses', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 3, parentCode: '33', branchScope: 'ALL_BRANCHES' },
  { code: '3355', nameAr: 'خسائر فروقات أسعار الصرف الأجنبي', nameEn: 'Foreign Exchange Losses', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '335', branchScope: 'CURRENT_BRANCH' },

  { code: '336', nameAr: 'مصروفات خدمية متنوعة', nameEn: 'Miscellaneous Service Expenses', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 3, parentCode: '33', branchScope: 'ALL_BRANCHES' },
  { code: '3361', nameAr: 'اشتراكات وانتماءات نقابية ومنظمات سياحية (IATA / اتحاد السفر)', nameEn: 'Subscriptions & Tourism Memberships', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '336', branchScope: 'CURRENT_BRANCH' },
  { code: '3362', nameAr: 'أقساط التأمين', nameEn: 'Insurance Premiums', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '336', branchScope: 'CURRENT_BRANCH' },
  { code: '3365', nameAr: 'خدمات واستشارات قانونية وقضائية', nameEn: 'Legal Services', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '336', branchScope: 'CURRENT_BRANCH' },

  { code: '3366', nameAr: 'خدمات وعمولات مصرفية وبوابات الدفع', nameEn: 'Banking & Payment Gateway Fees', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 4, parentCode: '336', branchScope: 'ALL_BRANCHES' },
  { code: '33661', nameAr: 'عمولات ورسوم الحسابات البنكية', nameEn: 'Bank Account Fees', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '3366', branchScope: 'CURRENT_BRANCH' },
  { code: '33662', nameAr: 'عمولات أجهزة نقاط البيع POS', nameEn: 'POS Machine Fees', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '3366', branchScope: 'CURRENT_BRANCH' },
  { code: '33663', nameAr: 'عمولات بوابات الدفع الإلكتروني (Online Gateway)', nameEn: 'E-Payment Gateway Fees', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '3366', branchScope: 'CURRENT_BRANCH' },
  { code: '33664', nameAr: 'رسوم وعمولات الحسابات المصرفية الإلكترونية والماستر', nameEn: 'Master & Electronic Account Fees', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 5, parentCode: '3366', branchScope: 'CURRENT_BRANCH' },
  { code: '3367', nameAr: 'أجور تدقيق وتنظيم الحسابات والمحاسبة القانونية', nameEn: 'Auditing & Accounting Fees', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '336', branchScope: 'CURRENT_BRANCH' },

  { code: '337', nameAr: 'فوائد مدينة', nameEn: 'Interest Expenses', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 3, parentCode: '33', branchScope: 'ALL_BRANCHES' },
  { code: '339', nameAr: 'مصروفات تشغيلية أخرى', nameEn: 'Other Operating Expenses', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 3, parentCode: '33', branchScope: 'ALL_BRANCHES' },
  { code: '3399', nameAr: 'مصروفات نثرية وتشغيلية متنوعة', nameEn: 'Petty & Miscellaneous Expenses', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '339', branchScope: 'CURRENT_BRANCH' },

  { code: '34', nameAr: 'المقاولات الثانوية وخدمات التشغيل', nameEn: 'Subcontracting & Operations', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 2, parentCode: '3', branchScope: 'ALL_BRANCHES' },
  { code: '35', nameAr: 'مشتريات البضائع والأراضي بغرض البيع', nameEn: 'Purchases of Goods for Resale', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 2, parentCode: '3', branchScope: 'ALL_BRANCHES' },
  { code: '351', nameAr: 'مشتريات البضائع بغرض البيع', nameEn: 'Purchases of Goods', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 3, parentCode: '35', branchScope: 'ALL_BRANCHES' },
  { code: '3511', nameAr: 'مشتريات محلية', nameEn: 'Local Purchases', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '351', branchScope: 'CURRENT_BRANCH' },
  { code: '3512', nameAr: 'مشتريات مستوردة', nameEn: 'Imported Purchases', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '351', branchScope: 'CURRENT_BRANCH' },
  { code: '352', nameAr: 'مشتريات الأراضي بغرض البيع', nameEn: 'Purchases of Land for Resale', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 3, parentCode: '35', branchScope: 'ALL_BRANCHES' },

  { code: '36', nameAr: 'كلف الإنتاج والبضائع المباعة', nameEn: 'Cost of Goods Sold', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 2, parentCode: '3', branchScope: 'ALL_BRANCHES' },
  { code: '37', nameAr: 'الاندثارات والإطفاءات', nameEn: 'Depreciation & Amortization', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 2, parentCode: '3', branchScope: 'ALL_BRANCHES' },
  { code: '37116', nameAr: 'اندثار أثاث وأجهزة مكاتب', nameEn: 'Depreciation of Office Equipment', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 3, parentCode: '37', branchScope: 'CURRENT_BRANCH' },

  { code: '38', nameAr: 'المصروفات التحويلية والضرائب', nameEn: 'Transfer Expenses & Taxes', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 2, parentCode: '3', branchScope: 'ALL_BRANCHES' },
  { code: '382', nameAr: 'مصروفات تحويلية متنوعة', nameEn: 'Miscellaneous Transfer Expenses', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 3, parentCode: '38', branchScope: 'ALL_BRANCHES' },
  { code: '3821', nameAr: 'تبرعات للغير', nameEn: 'Donations', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '382', branchScope: 'CURRENT_BRANCH' },
  { code: '3822', nameAr: 'تعويضات وغرامات', nameEn: 'Fines & Compensations Paid', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '382', branchScope: 'CURRENT_BRANCH' },
  { code: '3823', nameAr: 'ديون مشطوبة', nameEn: 'Bad Debts Written Off', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '382', branchScope: 'CURRENT_BRANCH' },
  { code: '384', nameAr: 'ضرائب ورسوم', nameEn: 'Taxes & Fees', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 3, parentCode: '38', branchScope: 'ALL_BRANCHES' },
  { code: '3841', nameAr: 'ضريبة الدخل', nameEn: 'Income Tax', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '384', branchScope: 'CURRENT_BRANCH' },
  { code: '3842', nameAr: 'رسوم إنتاج وخدمات', nameEn: 'Production & Service Fees', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '384', branchScope: 'CURRENT_BRANCH' },
  { code: '3843', nameAr: 'ضرائب ورسوم حكومية أخرى', nameEn: 'Other Taxes & Govt Fees', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 4, parentCode: '384', branchScope: 'CURRENT_BRANCH' },
  { code: '385', nameAr: 'إعانات', nameEn: 'Subsidies', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 3, parentCode: '38', branchScope: 'ALL_BRANCHES' },

  { code: '39', nameAr: 'المصروفات والخسائر الأخرى', nameEn: 'Other Expenses & Losses', type: 'EXPENSE', category: 'GENERAL', isParent: true, level: 2, parentCode: '3', branchScope: 'ALL_BRANCHES' },
  { code: '391', nameAr: 'خسائر بيع الأصول', nameEn: 'Loss on Sale of Assets', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 3, parentCode: '39', branchScope: 'CURRENT_BRANCH' },
  { code: '392', nameAr: 'مصروفات عرضية وغير متكررة', nameEn: 'Incidental Expenses', type: 'EXPENSE', category: 'GENERAL', isParent: false, level: 3, parentCode: '39', branchScope: 'CURRENT_BRANCH' },

  // 4 - الموارد (الإيرادات)
  { code: '4', nameAr: 'الموارد (الإيرادات)', nameEn: 'Revenues', type: 'REVENUE', category: 'GENERAL', isParent: true, level: 1, parentCode: null, branchScope: 'ALL_BRANCHES' },
  { code: '41', nameAr: 'إيراد النشاط السلعي', nameEn: 'Commodity Activity Revenue', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 2, parentCode: '4', branchScope: 'ALL_BRANCHES' },

  // 42 - إيراد النشاط التجاري
  { code: '42', nameAr: 'إيراد النشاط التجاري والسياحي', nameEn: 'Commercial & Tourism Revenues', type: 'REVENUE', category: 'GENERAL', isParent: true, level: 2, parentCode: '4', branchScope: 'ALL_BRANCHES' },
  { code: '421', nameAr: 'إيراد مبيعات بضائع وأراضٍ بغرض البيع', nameEn: 'Revenue from Sales of Goods', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 3, parentCode: '42', branchScope: 'ALL_BRANCHES' },
  { code: '423', nameAr: 'عمولة مستلمة (عمولات التذاكر والطيران)', nameEn: 'Commissions Received', type: 'REVENUE', category: 'GENERAL', isParent: true, level: 3, parentCode: '42', branchScope: 'ALL_BRANCHES' },
  { code: '4231', nameAr: 'عمولة بيع التذاكر', nameEn: 'Ticket Sales Commission', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '423', branchScope: 'CURRENT_BRANCH' },
  { code: '4232', nameAr: 'عمولات شركات الطيران', nameEn: 'Airline Commissions', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '423', branchScope: 'CURRENT_BRANCH' },
  { code: '4233', nameAr: 'عمولات موردي ومنصات التذاكر', nameEn: 'Ticket Consolidator Commissions', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '423', branchScope: 'CURRENT_BRANCH' },
  { code: '4234', nameAr: 'حوافز وتارجت شركات الطيران (Override & Incentives)', nameEn: 'Airline Target Incentives', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '423', branchScope: 'CURRENT_BRANCH' },
  { code: '4239', nameAr: 'عمولات مبيعات سياحية أخرى', nameEn: 'Other Sales Commissions', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '423', branchScope: 'CURRENT_BRANCH' },

  { code: '424', nameAr: 'إيراد الفندقة والبرامج السياحية', nameEn: 'Hotels & Tourism Package Revenues', type: 'REVENUE', category: 'GENERAL', isParent: true, level: 3, parentCode: '42', branchScope: 'ALL_BRANCHES' },
  { code: '4241', nameAr: 'إيراد / عمولة حجوزات الفنادق', nameEn: 'Hotel Booking Revenues', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '424', branchScope: 'CURRENT_BRANCH' },
  { code: '4242', nameAr: 'إيراد البرامج والرحلات السياحية', nameEn: 'Tourism Packages Revenue', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '424', branchScope: 'CURRENT_BRANCH' },
  { code: '4243', nameAr: 'إيراد رحلات المجموعات والكروبات (Groups)', nameEn: 'Group Tours Revenue', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '424', branchScope: 'CURRENT_BRANCH' },
  { code: '4244', nameAr: 'إيراد خدمات سياحية مساندة ونقل', nameEn: 'Ancillary Tourism & Transport', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '424', branchScope: 'CURRENT_BRANCH' },
  { code: '425', nameAr: 'إيرادات تجارية متنوعة', nameEn: 'Miscellaneous Commercial Revenues', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 3, parentCode: '42', branchScope: 'ALL_BRANCHES' },

  // 43 - إيراد النشاط الخدمي
  { code: '43', nameAr: 'إيراد النشاط الخدمي (أجور خدمات السفر والتذاكر)', nameEn: 'Service Activity Revenues', type: 'REVENUE', category: 'GENERAL', isParent: true, level: 2, parentCode: '4', branchScope: 'ALL_BRANCHES' },
  { code: '431', nameAr: 'إيراد خدمات أساسية', nameEn: 'Basic Service Revenue', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 3, parentCode: '43', branchScope: 'ALL_BRANCHES' },
  { code: '435', nameAr: 'أرباح الاستثمارات المالية وفروقات أسعار الصرف الأجنبي', nameEn: 'Financial & FX Profits', type: 'REVENUE', category: 'GENERAL', isParent: true, level: 3, parentCode: '43', branchScope: 'ALL_BRANCHES' },
  { code: '4355', nameAr: 'أرباح فروقات أسعار الصرف الأجنبي', nameEn: 'Foreign Exchange Gain', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '435', branchScope: 'CURRENT_BRANCH' },

  { code: '436', nameAr: 'إيراد خدمات السفر والتذاكر المتنوعة', nameEn: 'Miscellaneous Travel Service Fees', type: 'REVENUE', category: 'GENERAL', isParent: true, level: 3, parentCode: '43', branchScope: 'ALL_BRANCHES' },
  { code: '4361', nameAr: 'أجور إصدار التذاكر (Issuance Fees)', nameEn: 'Ticket Issuance Fees', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '436', branchScope: 'CURRENT_BRANCH' },
  { code: '4362', nameAr: 'أجور خدمة الحجز وتعديل المواعيد', nameEn: 'Booking & Change Fees', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '436', branchScope: 'CURRENT_BRANCH' },
  { code: '4363', nameAr: 'أجور إعادة إصدار التذاكر (Reissue Fees)', nameEn: 'Ticket Reissue Fees', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '436', branchScope: 'CURRENT_BRANCH' },
  { code: '4364', nameAr: 'أجور استرجاع التذاكر (Refund Fees)', nameEn: 'Ticket Refund Fees', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '436', branchScope: 'CURRENT_BRANCH' },
  { code: '4365', nameAr: 'أجور ورسوم خدمة الفيزا والتأشيرات (Visa)', nameEn: 'Visa Service Fees', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '436', branchScope: 'CURRENT_BRANCH' },
  { code: '4366', nameAr: 'أجور خدمة حجز الفنادق', nameEn: 'Hotel Service Fees', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '436', branchScope: 'CURRENT_BRANCH' },
  { code: '4369', nameAr: 'أجور خدمات سفر وترفيه أخرى', nameEn: 'Other Travel Service Fees', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '436', branchScope: 'CURRENT_BRANCH' },

  { code: '437', nameAr: 'فوائد دائنة', nameEn: 'Interest Income', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 3, parentCode: '43', branchScope: 'ALL_BRANCHES' },
  { code: '439', nameAr: 'إيرادات تشغيلية أخرى', nameEn: 'Other Operating Revenues', type: 'REVENUE', category: 'GENERAL', isParent: true, level: 3, parentCode: '43', branchScope: 'ALL_BRANCHES' },
  { code: '4392', nameAr: 'إيراد عمولة بيع', nameEn: 'Sales Commission Income', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '439', branchScope: 'CURRENT_BRANCH' },

  { code: '44', nameAr: 'إيراد التشغيل للغير', nameEn: 'Operation for Others Revenue', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 2, parentCode: '4', branchScope: 'ALL_BRANCHES' },
  { code: '45', nameAr: 'كلفة الأصول المصنعة داخلياً', nameEn: 'Cost of Internally Manufactured Assets', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 2, parentCode: '4', branchScope: 'ALL_BRANCHES' },
  { code: '46', nameAr: 'كلف الإنتاج المحول إلى المخازن', nameEn: 'Transferred Production Cost', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 2, parentCode: '4', branchScope: 'ALL_BRANCHES' },

  { code: '48', nameAr: 'الإيرادات التحويلية', nameEn: 'Transfer Revenues', type: 'REVENUE', category: 'GENERAL', isParent: true, level: 2, parentCode: '4', branchScope: 'ALL_BRANCHES' },
  { code: '481', nameAr: 'منح تمويلية وتبرعات', nameEn: 'Grants & Donations', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 3, parentCode: '48', branchScope: 'ALL_BRANCHES' },
  { code: '482', nameAr: 'إيرادات تحويلية متنوعة', nameEn: 'Miscellaneous Transfer Revenues', type: 'REVENUE', category: 'GENERAL', isParent: true, level: 3, parentCode: '48', branchScope: 'ALL_BRANCHES' },
  { code: '4821', nameAr: 'تبرعات مستلمة', nameEn: 'Donations Received', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '482', branchScope: 'ALL_BRANCHES' },
  { code: '4822', nameAr: 'تعويضات وغرامات مستلمة', nameEn: 'Compensations & Fines Received', type: 'REVENUE', category: 'GENERAL', isParent: true, level: 4, parentCode: '482', branchScope: 'ALL_BRANCHES' },
  { code: '48221', nameAr: 'تعويضات مستلمة', nameEn: 'Compensations Received', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 5, parentCode: '4822', branchScope: 'ALL_BRANCHES' },
  { code: '48222', nameAr: 'غرامات مستلمة', nameEn: 'Fines Received', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 5, parentCode: '4822', branchScope: 'ALL_BRANCHES' },
  { code: '4823', nameAr: 'ديون سبق شطبها مستردة', nameEn: 'Recovered Bad Debts', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 4, parentCode: '482', branchScope: 'ALL_BRANCHES' },
  { code: '483', nameAr: 'مخصصات انتفت الحاجة إليها', nameEn: 'Reversed Provisions', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 3, parentCode: '48', branchScope: 'ALL_BRANCHES' },

  { code: '49', nameAr: 'الإيرادات والمكاسب الأخرى', nameEn: 'Other Revenues & Gains', type: 'REVENUE', category: 'GENERAL', isParent: true, level: 2, parentCode: '4', branchScope: 'ALL_BRANCHES' },
  { code: '491', nameAr: 'المكاسب الرأسمالية (أرباح بيع أصول)', nameEn: 'Capital Gains', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 3, parentCode: '49', branchScope: 'ALL_BRANCHES' },
  { code: '492', nameAr: 'إيرادات عرضية ومتنوعة', nameEn: 'Incidental Revenues', type: 'REVENUE', category: 'GENERAL', isParent: false, level: 3, parentCode: '49', branchScope: 'CURRENT_BRANCH' }
];

async function seedCompany(companyId, mainBranchId) {
  console.log(`\n========================================`);
  console.log(`Seeding Unified Chart of Accounts 2026 for Company: ${companyId}`);

  // Delete dependent tables first to avoid FK constraints
  await prisma.receiptVoucher.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.paymentVoucher.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.journalEntryLine.deleteMany({ where: { journalEntry: { companyId } } }).catch(() => {});
  await prisma.journalEntry.deleteMany({ where: { companyId } }).catch(() => {});

  await prisma.customer.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.supplier.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.cashbox.deleteMany({ where: { companyId } }).catch(() => {});
  await prisma.bank.deleteMany({ where: { companyId } }).catch(() => {});

  // Unlink parents to prevent restrict constraint
  await prisma.account.updateMany({
    where: { companyId },
    data: { parentId: null }
  });

  // Delete all existing accounts
  const del = await prisma.account.deleteMany({
    where: { companyId }
  });
  console.log(`Deleted ${del.count} old accounts.`);

  // 2. Insert new accounts hierarchically by level (1 to 7)
  const codeToIdMap = new Map();
  const maxLevel = Math.max(...chartData.map(a => a.level));

  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    const levelAccounts = chartData.filter(a => a.level === lvl);
    for (const item of levelAccounts) {
      const parentId = item.parentCode ? codeToIdMap.get(item.parentCode) || null : null;
      
      const created = await prisma.account.create({
        data: {
          code: item.code,
          nameAr: item.nameAr,
          nameEn: item.nameEn,
          type: item.type,
          category: item.category,
          isParent: item.isParent,
          level: item.level,
          parentId: parentId,
          companyId: companyId,
          currency: item.currency || 'IQD',
          branchScope: item.branchScope,
          branchIds: item.branchScope === 'CURRENT_BRANCH' && mainBranchId ? [mainBranchId] : [],
          balance: 0,
          creditLimit: 5000000,
          paymentDays: 30,
          paymentMode: 'CREDIT_ALLOWED',
          overduePolicy: 'BLOCK'
        }
      });

      codeToIdMap.set(item.code, created.id);
    }
    console.log(`Level ${lvl}: Created ${levelAccounts.length} accounts.`);
  }

  // 3. Link cashbox, bank, customer, supplier to appropriate new leaf accounts
  const hqCashIQD = codeToIdMap.get('134111');
  const hqBankIQD = codeToIdMap.get('134211');
  const indClient = codeToIdMap.get('132141');
  const tickSupp = codeToIdMap.get('232142');

  if (hqCashIQD) {
    const cash = await prisma.cashbox.findFirst({ where: { companyId } });
    if (cash) {
      await prisma.cashbox.update({ where: { id: cash.id }, data: { accountId: hqCashIQD } });
    }
  }

  if (hqBankIQD) {
    const b = await prisma.bank.findFirst({ where: { companyId } });
    if (b) {
      await prisma.bank.update({ where: { id: b.id }, data: { accountId: hqBankIQD } });
    }
  }

  if (indClient) {
    const cust = await prisma.customer.findFirst({ where: { companyId } });
    if (cust) {
      await prisma.customer.update({ where: { id: cust.id }, data: { accountId: indClient } });
    }
  }

  if (tickSupp) {
    const supps = await prisma.supplier.findMany({ where: { companyId } });
    for (const s of supps) {
      await prisma.supplier.update({ where: { id: s.id }, data: { accountId: tickSupp } });
    }
  }

  console.log(`Successfully seeded Unified Chart 2026 for company ${companyId}`);
}

async function main() {
  const companies = await prisma.company.findMany();
  const branches = await prisma.branch.findMany({ where: { isMain: true } });

  for (const comp of companies) {
    const mainBranch = branches.find(b => b.companyId === comp.id) || branches[0];
    await seedCompany(comp.id, mainBranch?.id);
  }

  const totalAccounts = await prisma.account.count();
  console.log(`\n========================================`);
  console.log(`DONE! Total Accounts now in DB: ${totalAccounts}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
