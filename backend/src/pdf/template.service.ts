import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

// ── Label translations ──
const LABELS: Record<string, Record<string, string>> = {
  ar: {
    accountLabel: 'TO:',
    statementTitle: 'STATEMENT OF ACCOUNT',
    accountSummary: 'Account summary',
    periodFrom: 'Period',
    periodTo: 'to',
    noCol: 'No.',
    dateDoc: 'Date',
    description: 'Details',
    docTypeCol: 'Type',
    debit: 'Debit',
    credit: 'Credit',
    runningBalance: 'Balance',
    passengerList: 'Passenger List',
    noMovements: 'No financial movements recorded for this period',
    summaryTitle: 'Financial Summary',
    openingBalance: 'Opening Balance',
    previousBalance: 'Previous Balance',
    totalDebit: 'Total debit / invoiced amount',
    totalCredit: 'Total credit / amount paid',
    netBalance: 'Balance due',
    phoneLabel: 'Mobile',
    emailLabel: 'Email',
    addressLabel: 'Address',
    currency: 'IQD',
    officialStatement: 'Official Account Statement',
  },
  en: {
    accountLabel: 'TO:',
    statementTitle: 'STATEMENT OF ACCOUNT',
    accountSummary: 'Account summary',
    periodFrom: 'Period',
    periodTo: 'to',
    noCol: 'No.',
    dateDoc: 'Date',
    description: 'Details',
    docTypeCol: 'Type',
    debit: 'Debit',
    credit: 'Credit',
    runningBalance: 'Balance',
    passengerList: 'Passenger List',
    noMovements: 'No financial movements recorded for this period',
    summaryTitle: 'Financial Summary',
    openingBalance: 'Opening Balance',
    previousBalance: 'Previous Balance',
    totalDebit: 'Total debit / invoiced amount',
    totalCredit: 'Total credit / amount paid',
    netBalance: 'Balance due',
    phoneLabel: 'Mobile',
    emailLabel: 'Email',
    addressLabel: 'Address',
    currency: 'IQD',
    officialStatement: 'Official Account Statement',
  },
};

export interface StatementRow {
  rowNumber: number;
  date: string;
  docRef?: string;
  pnr?: string;
  route?: string;
  routeFrom?: string;
  routeTo?: string;
  hasPnr?: boolean;
  passengers?: { fullName: string; type: string; typeClass: string; isChild: boolean }[];
  statement: string;
  debit: number;
  credit: number;
  runningBalance: number;
  currency?: string;
}

export interface StatementTotals {
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
  openingBalance?: number;
  previousBalance?: number;
}

export interface TemplateSettings {
  templatePreset?: string;  // classic | modern | compact
  logoUrl?: string;
  logoSize?: number;
  logoBorderRadius?: number;
  primaryColor?: string;
  fontFamily?: string;
  fontSize?: number;
  tableTextColor?: string;
  tableHeaderTextColor?: string;
  companyNameAr?: string;
  companyNameEn?: string;
  subtitleAr?: string;
  subtitleEn?: string;
  commercialReg?: string;
  phone?: string;
  email?: string;
  addressAr?: string;
  addressEn?: string;
  footerTextAr?: string;
  footerTextEn?: string;
  showSummary?: boolean;
  showOpeningBalance?: boolean;
  /**
   * The «إظهار رمز QR» switch from the print-template settings. Declared here so it
   * is a real part of the contract rather than something that happened to survive
   * the settings spread — the templates read it to decide whether to draw the code.
   */
  showQrCode?: boolean;
  qrSize?: number;
  qrShowLabel?: boolean;
  fontSizes?: {
    companyTitle?: number;
    subtitle?: number;
    headerDetails?: number;
    docTitle?: number;
    tableHeader?: number;
    tableBody?: number;
    footer?: number;
    summaryTitle?: number;
    summaryMetrics?: number;
  };
}

export interface StatementPdfData {
  accountName: string;
  accountCode?: string;
  accountId?: string;
  accountPhone?: string;
  accountEmail?: string;
  accountAddress?: string;
  startDate: string;
  endDate: string;
  rows: StatementRow[];
  totals: StatementTotals;
  lang?: 'ar' | 'en';
  settings?: TemplateSettings;
  /**
   * The account's portal barcode as a data URL. Absent when no barcode has been
   * issued for this account — the templates then print nothing rather than a dead
   * square, so an un-issued account never gets a code that leads nowhere.
   */
  qrDataUrl?: string | null;
}

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private compiledTemplates: Map<string, Handlebars.TemplateDelegate> = new Map();
  private fontFaceCss: string = '';

  getFontFaceCss(): string {
    return this.fontFaceCss;
  }

  constructor() {
    this.registerHelpers();
    this.loadFonts();
    this.precompileTemplates();
  }

  private registerHelpers() {
    // Format number with locale-based separators
    Handlebars.registerHelper('fmtNum', (num: any) => {
      if (num == null || isNaN(num)) return '0.00';
      return Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });

    // Truncate string
    Handlebars.registerHelper('truncate', (str: any, len: number) => {
      if (!str) return '-';
      const s = String(str);
      return s.length > len ? s.slice(-len) : s;
    });
  }

  /**
   * Load local font files and generate @font-face CSS with base64 data URIs
   */
  private loadFonts() {
    const fontDirs = [
      path.join(__dirname, 'fonts'),
      path.join(process.cwd(), 'src', 'pdf', 'fonts'),
      path.join(process.cwd(), 'dist', 'pdf', 'fonts'),
    ];

    let fontsDir = '';
    for (const dir of fontDirs) {
      if (fs.existsSync(dir)) {
        fontsDir = dir;
        break;
      }
    }

    if (!fontsDir) {
      this.logger.warn('No fonts directory found, will use Google Fonts CDN fallback');
      return;
    }

    const fontMap: { file: string; weight: number }[] = [
      { file: 'IBMPlexSansArabic-Regular.woff2', weight: 400 },
      { file: 'IBMPlexSansArabic-Medium.woff2', weight: 500 },
      { file: 'IBMPlexSansArabic-SemiBold.woff2', weight: 600 },
      { file: 'IBMPlexSansArabic-Bold.woff2', weight: 700 },
    ];

    const faces: string[] = [];
    for (const { file, weight } of fontMap) {
      const filePath = path.join(fontsDir, file);
      try {
        const buffer = fs.readFileSync(filePath);
        const base64 = buffer.toString('base64');
        faces.push(`@font-face {
  font-family: 'IBM Plex Sans Arabic';
  font-style: normal;
  font-weight: ${weight};
  font-display: block;
  src: url(data:font/woff2;base64,${base64}) format('woff2');
}`);
        this.logger.log(`Font loaded: ${file} (${buffer.length} bytes)`);
      } catch (err) {
        this.logger.warn(`Font file not found: ${filePath}`);
      }
    }

    this.fontFaceCss = faces.join('\n');
  }

  private precompileTemplates() {
    // Try multiple paths: __dirname/templates (dist), src/pdf/templates (dev)
    const possibleDirs = [
      path.join(__dirname, 'templates'),
      path.join(process.cwd(), 'src', 'pdf', 'templates'),
      path.join(process.cwd(), 'dist', 'pdf', 'templates'),
    ];

    let templatesDir = possibleDirs[0];
    for (const dir of possibleDirs) {
      if (fs.existsSync(dir)) {
        templatesDir = dir;
        break;
      }
    }

    this.logger.log(`Templates directory resolved to: ${templatesDir}`);
    const presets = ['classic', 'modern', 'compact'];

    for (const preset of presets) {
      const filePath = path.join(templatesDir, `${preset}.hbs`);
      try {
        const source = fs.readFileSync(filePath, 'utf-8');
        this.compiledTemplates.set(preset, Handlebars.compile(source));
        this.logger.log(`Template "${preset}" compiled successfully`);
      } catch (err) {
        this.logger.warn(`Template "${preset}" not found at ${filePath}, will use classic fallback`);
      }
    }
  }

  /**
   * Lighten a hex color for gradient usage
   */
  private lightenColor(hex: string, percent: number = 20): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + Math.round(255 * percent / 100));
    const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round(255 * percent / 100));
    const b = Math.min(255, (num & 0x0000FF) + Math.round(255 * percent / 100));
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
  }

  /**
   * Render statement HTML from template + data
   */
  renderStatementHtml(data: StatementPdfData): string {
    const lang = data.lang || 'ar';
    const isEn = lang === 'en';
    const settings = data.settings || {};
    const preset = settings.templatePreset || 'classic';
    const t = LABELS[lang] || LABELS['ar'];

    const defaultFontSizes = {
      companyTitle: 20,
      subtitle: 12,
      headerDetails: 11,
      docTitle: 12,
      tableHeader: 11.5,
      tableBody: 11,
      footer: 11.5,
      summaryTitle: 13,
      summaryMetrics: 14,
    };

    // Build template context
    const context = {
      settings,
      // Fonts (embedded base64)
      fontFaceCss: new Handlebars.SafeString(this.fontFaceCss),

      // Language
      langAttr: isEn ? 'en' : 'ar',
      dir: isEn ? 'ltr' : 'rtl',
      isRtl: !isEn,
      t,

      // Company info (language-aware)
      companyName: isEn ? (settings.companyNameEn || settings.companyNameAr || '') : (settings.companyNameAr || settings.companyNameEn || ''),
      subtitle: isEn ? (settings.subtitleEn || settings.subtitleAr || '') : (settings.subtitleAr || settings.subtitleEn || ''),
      commercialReg: settings.commercialReg || '',
      phone: settings.phone || '',
      email: settings.email || '',
      address: isEn ? (settings.addressEn || settings.addressAr || '') : (settings.addressAr || settings.addressEn || ''),
      footerText: isEn ? (settings.footerTextEn || settings.footerTextAr || '') : (settings.footerTextAr || settings.footerTextEn || ''),

      // Logo
      logoUrl: settings.logoUrl || '',
      logoSize: settings.logoSize || 80,
      logoBorderRadius: settings.logoBorderRadius || 0,

      // Styling
      primaryColor: settings.primaryColor || '#163B5C',
      primaryColorLight: this.lightenColor(settings.primaryColor || '#163B5C', 15),
      fontFamily: settings.fontFamily || 'IBM Plex Sans Arabic',
      fontSize: settings.fontSize || 11,
      tableTextColor: settings.tableTextColor || '#0f172a',
      tableHeaderTextColor: settings.tableHeaderTextColor || '#ffffff',

      // Font sizes
      fontSizes: { ...defaultFontSizes, ...(settings.fontSizes || {}) },

      // Settings flags
      showSummary: settings.showSummary !== false,
      showOpeningBalance: settings.showOpeningBalance !== false,

      // The barcode, and the size the settings asked for. 42px was hard-coded in the
      // markup before, so the size control in the settings screen did nothing.
      qrDataUrl: data.qrDataUrl || '',
      qrSize: Math.min(120, Math.max(28, Number(settings.qrSize) || 42)),
      qrLabel: isEn ? 'Scan for statement' : 'امسح لعرض كشفك',

      // Account info
      accountName: data.accountName,
      accountCode: data.accountCode,
      accountPhone: data.accountPhone || '',
      accountEmail: data.accountEmail || '',
      accountAddress: data.accountAddress || '',
      startDate: data.startDate,
      endDate: data.endDate,

      printDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' - ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),

      // Data
      rows: (data.rows || []).map(row => {
        const paxList = row.passengers || [];
        const adtCount = paxList.filter(p => p.type === 'ADT' || p.type === 'ADULT').length;
        const chdCount = paxList.filter(p => p.type === 'CHD' || p.type === 'CHILD').length;
        const infCount = paxList.filter(p => p.type === 'INF' || p.type === 'INFANT').length;
        const paxNamesStr = paxList.map(p => p.fullName).join(', ');
        const paxSummaryLine = paxList.length ? `${adtCount} ADT ${chdCount} CHD ${infCount} INF: ${paxNamesStr}` : '';
        const isPrevRow = (row.docRef && (row.docRef.includes('PREV') || row.docRef.includes('OPEN'))) || (row.statement && row.statement.toLowerCase().includes('previous balance'));
        const docType = isPrevRow ? '' : ((row as any).type || (row as any).docType || 'DT-ISSUE');

        return {
          ...row,
          docType,
          paxSummaryLine,
          isPrevRow,
          hasPnr: !!(row.pnr && row.pnr !== '-') || !!(row.route && row.route !== '-') || !!(paxList.length > 0),
          routeFrom: row.route ? row.route.split(/\s*[-→➜>]\s*/)[0]?.trim() : '',
          routeTo: row.route ? row.route.split(/\s*[-→➜>]\s*/)[1]?.trim() : '',
          passengers: paxList.map(p => ({
            ...p,
            typeClass: p.type === 'ADT' ? 'pax-type-adt' : p.type === 'CHD' ? 'pax-type-chd' : 'pax-type-inf',
            isChild: p.type === 'CHD' || p.type === 'INF',
          })),
        };
      }),
      totals: data.totals,
    };

    // Get compiled template
    let template = this.compiledTemplates.get(preset);
    if (!template) {
      template = this.compiledTemplates.get('classic');
    }
    if (!template) {
      throw new Error(`No template found for preset "${preset}"`);
    }

    return template(context);
  }
}
