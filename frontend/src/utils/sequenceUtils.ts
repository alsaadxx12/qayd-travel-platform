export interface SequenceConfig {
  id: string;
  nameAr: string;
  nameEn: string;
  prefix: string;
  branchCode: string;
  includeYear: boolean;
  nextNumber: number;
  padding: number;
  separator: string;
  category: 'tickets' | 'visas' | 'groups' | 'refunds' | 'changes' | 'vouchers' | 'hotels';
}

export function getActiveBranchIdAndCode(): { branchId: string; branchCode: string; branchName: string } {
  try {
    const activeBranchId = localStorage.getItem('activeBranchId');
    const activeBranchCode = localStorage.getItem('activeBranchCode');
    const activeBranchName = localStorage.getItem('activeBranchName');

    if (activeBranchId && activeBranchCode) {
      return {
        branchId: activeBranchId,
        branchCode: activeBranchCode.toUpperCase(),
        branchName: activeBranchName || 'الروضتين للسفر والسياحة',
      };
    }

    const savedBranchesStr = localStorage.getItem('system_branches_v2');
    if (savedBranchesStr) {
      const branches: any[] = JSON.parse(savedBranchesStr);
      if (Array.isArray(branches) && branches.length > 0) {
        const kabBranch = branches.find(b => b.code === 'KAB' || (b.nameAr && b.nameAr.includes('الروضتين')));
        if (kabBranch) {
          return { branchId: kabBranch.id, branchCode: kabBranch.code || 'KAB', branchName: kabBranch.nameAr || 'الروضتين للسفر والسياحة' };
        }
        const first = branches[0];
        return { branchId: first.id, branchCode: (first.code || 'KAB').toUpperCase(), branchName: first.nameAr || 'الروضتين للسفر والسياحة' };
      }
    }
  } catch (e) { /* ignore */ }

  return { branchId: 'b-rawdatain', branchCode: 'KAB', branchName: 'الروضتين للسفر والسياحة' };
}

export function getDefaultSequencesForBranch(branchCode: string = 'KAB'): Record<string, SequenceConfig> {
  const code = (branchCode || 'KAB').toUpperCase();
  return {
    tickets: {
      id: 'tickets',
      nameAr: 'فواتير تذاكر الطيران',
      nameEn: 'Flight Ticket Invoices',
      prefix: 'TKT',
      branchCode: code,
      includeYear: true,
      nextNumber: 1001,
      padding: 5,
      separator: '-',
      category: 'tickets',
    },
    visas: {
      id: 'visas',
      nameAr: 'فواتير الفيزا والمعاملات',
      nameEn: 'Visa Invoices',
      prefix: 'VISA',
      branchCode: code,
      includeYear: true,
      nextNumber: 1001,
      padding: 5,
      separator: '-',
      category: 'visas',
    },
    groups: {
      id: 'groups',
      nameAr: 'فواتير الكروبات والرحلات الجماعية',
      nameEn: 'Group Tour Invoices',
      prefix: 'GRP',
      branchCode: code,
      includeYear: true,
      nextNumber: 1001,
      padding: 5,
      separator: '-',
      category: 'groups',
    },
    refunds: {
      id: 'refunds',
      nameAr: 'فواتير الاسترجاع والارتجاع',
      nameEn: 'Refund Invoices',
      prefix: 'RFD',
      branchCode: code,
      includeYear: true,
      nextNumber: 1001,
      padding: 5,
      separator: '-',
      category: 'refunds',
    },
    changes: {
      id: 'changes',
      nameAr: 'فواتير التغيرات وتعديل التذاكر',
      nameEn: 'Ticket Change & Reissue Invoices',
      prefix: 'CHG',
      branchCode: code,
      includeYear: true,
      nextNumber: 1001,
      padding: 5,
      separator: '-',
      category: 'changes',
    },
    receiptVouchers: {
      id: 'receiptVouchers',
      nameAr: 'سندات القبض المالية',
      nameEn: 'Receipt Vouchers',
      prefix: 'RV',
      branchCode: code,
      includeYear: true,
      nextNumber: 1001,
      padding: 5,
      separator: '-',
      category: 'vouchers',
    },
    paymentVouchers: {
      id: 'paymentVouchers',
      nameAr: 'سندات الدفع المالية',
      nameEn: 'Payment Vouchers',
      prefix: 'PV',
      branchCode: code,
      includeYear: true,
      nextNumber: 1001,
      padding: 5,
      separator: '-',
      category: 'vouchers',
    },
    journalEntries: {
      id: 'journalEntries',
      nameAr: 'سندات وقيود اليومية',
      nameEn: 'Journal Entries & Vouchers',
      prefix: 'JV',
      branchCode: code,
      includeYear: true,
      nextNumber: 1001,
      padding: 5,
      separator: '-',
      category: 'vouchers',
    },
    hotels: {
      id: 'hotels',
      nameAr: 'فواتير وحجوزات الفنادق',
      nameEn: 'Hotel Booking Invoices',
      prefix: 'HTL',
      branchCode: code,
      includeYear: true,
      nextNumber: 1001,
      padding: 5,
      separator: '-',
      category: 'hotels',
    },
    exchange: {
      id: 'exchange',
      nameAr: 'فواتير الصرافة',
      nameEn: 'Currency Exchange Vouchers',
      prefix: 'FX',
      branchCode: code,
      includeYear: true,
      nextNumber: 1001,
      padding: 5,
      separator: '-',
      category: 'vouchers',
    },
  };
}

export function loadSequenceSettings(branchId?: string, defaultBranchCode?: string): Record<string, SequenceConfig> {
  try {
    const activeInfo = getActiveBranchIdAndCode();
    const targetBranchId = branchId && branchId !== 'default' && branchId !== 'b1' ? branchId : activeInfo.branchId;
    const targetBranchCode = defaultBranchCode && defaultBranchCode !== 'BGD' ? defaultBranchCode : activeInfo.branchCode;

    const key = `app_sequence_settings_branch_${targetBranchId}`;
    const raw = localStorage.getItem(key);
    const defaults = getDefaultSequencesForBranch(targetBranchCode);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    const activeInfo = getActiveBranchIdAndCode();
    return getDefaultSequencesForBranch(defaultBranchCode || activeInfo.branchCode);
  }
}

export function saveSequenceSettings(settings: Record<string, SequenceConfig>, branchId: string = 'default'): void {
  try {
    const key = `app_sequence_settings_branch_${branchId}`;
    localStorage.setItem(key, JSON.stringify(settings));
  } catch (err) {
    console.error('Error saving sequence settings:', err);
  }
}

export function formatSequencePreview(config: SequenceConfig): string {
  const parts: string[] = [];
  if (config.branchCode) parts.push(config.branchCode.toUpperCase());
  if (config.prefix) parts.push(config.prefix.toUpperCase());
  if (config.includeYear) parts.push(new Date().getFullYear().toString());

  const numStr = String(config.nextNumber).padStart(config.padding, '0');
  parts.push(numStr);

  return parts.join(config.separator || '-');
}

export function getNextSequenceNumber(key: string, branchId?: string, defaultBranchCode?: string): string {
  const activeInfo = getActiveBranchIdAndCode();
  const targetBranchId = branchId && branchId !== 'default' && branchId !== 'b1' ? branchId : activeInfo.branchId;
  const targetBranchCode = defaultBranchCode && defaultBranchCode !== 'BGD' ? defaultBranchCode : activeInfo.branchCode;

  const settings = loadSequenceSettings(targetBranchId, targetBranchCode);
  const config = settings[key] || getDefaultSequencesForBranch(targetBranchCode)[key];

  if (config) {
    config.branchCode = targetBranchCode;
  }

  const formatted = formatSequencePreview(config);

  // Increment nextNumber and save
  config.nextNumber += 1;
  settings[key] = config;
  saveSequenceSettings(settings, targetBranchId);

  return formatted;
}
