/**
 * Arabic to English transliteration utility
 * Converts Arabic text to a reasonable English phonetic representation
 */

const AR_TO_EN: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'aa',
  'ب': 'b', 'ت': 't', 'ث': 'th',
  'ج': 'j', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
  'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd',
  'ط': 't', 'ظ': 'dh', 'ع': 'a', 'غ': 'gh',
  'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l',
  'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w',
  'ي': 'y', 'ى': 'a', 'ة': 'a', 'ئ': 'e',
  'ء': "'", 'ؤ': 'o',
  // Diacritics (tashkeel) - strip
  '\u064B': '', '\u064C': '', '\u064D': '', '\u064E': '',
  '\u064F': '', '\u0650': '', '\u0651': '', '\u0652': '',
};

// Common Arabic words → English translations for accounting context
const WORD_MAP: Record<string, string> = {
  'صندوق': 'Cashbox',
  'حساب': 'Account',
  'حسابات': 'Accounts',
  'بنك': 'Bank',
  'بنكي': 'Bank',
  'فرع': 'Branch',
  'شركة': 'Company',
  'عميل': 'Customer',
  'عملاء': 'Customers',
  'مورد': 'Supplier',
  'موردين': 'Suppliers',
  'مبيعات': 'Sales',
  'مشتريات': 'Purchases',
  'إيرادات': 'Revenue',
  'إيراد': 'Revenue',
  'مصاريف': 'Expenses',
  'مصروفات': 'Expenses',
  'تكاليف': 'Costs',
  'تكلفة': 'Cost',
  'خدمة': 'Service',
  'خدمات': 'Services',
  'رأسمال': 'Capital',
  'رأس': 'Capital',
  'المال': 'Capital',
  'أرباح': 'Profits',
  'خسائر': 'Losses',
  'ضريبة': 'Tax',
  'ضرائب': 'Taxes',
  'رواتب': 'Salaries',
  'إيجار': 'Rent',
  'كهرباء': 'Electricity',
  'ماء': 'Water',
  'هاتف': 'Phone',
  'إنترنت': 'Internet',
  'نقد': 'Cash',
  'النقد': 'Cash',
  'النقود': 'Cash',
  'التقود': 'Cash',
  'نقدي': 'Cash',
  'تذاكر': 'Tickets',
  'طيران': 'Aviation',
  'سياحة': 'Tourism',
  'سفر': 'Travel',
  'فنادق': 'Hotels',
  'تأشيرات': 'Visas',
  'جوية': 'Airways',
  'الجوية': 'Airways',
  'العراقية': 'Iraqi',
  'الخطوط': 'Airlines',
  'دولار': 'Dollar',
  'دينار': 'Dinar',
  'أجنبي': 'Foreign',
  'محلي': 'Local',
  'رئيسي': 'Main',
  'الرئيسي': 'Main',
  'عام': 'General',
  'العام': 'General',
  'الموجودات': 'Assets',
  'موجودات': 'Assets',
  'التزامات': 'Liabilities',
  'حقوق': 'Equity',
  'الملكية': 'Ownership',
  'في': 'In',
  'من': 'From',
  'إلى': 'To',
  'على': 'On',
  'مع': 'With',
  'بغداد': 'Baghdad',
  'أربيل': 'Erbil',
  'البصرة': 'Basra',
  'كربلاء': 'Karbala',
  'النجف': 'Najaf',
  'سليمانية': 'Sulaymaniyah',
  'الموصل': 'Mosul',
  'العراق': 'Iraq',
};

/**
 * Transliterate a single Arabic word to English
 */
function transliterateWord(word: string): string {
  // Strip the definite article "ال" prefix for lookup
  const stripped = word.replace(/^ال/, '');
  
  // Check word map first (with and without ال)
  if (WORD_MAP[word]) return WORD_MAP[word];
  if (WORD_MAP[stripped]) return WORD_MAP[stripped];

  // Fallback to character-by-character transliteration
  let result = '';
  for (const ch of word) {
    result += AR_TO_EN[ch] ?? ch;
  }
  
  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Convert Arabic text to English transliteration
 * Uses word-level dictionary first, then falls back to character mapping
 */
export function arabicToEnglish(text: string): string {
  if (!text || !text.trim()) return '';
  
  const words = text.trim().split(/\s+/);
  return words.map(transliterateWord).join(' ');
}
