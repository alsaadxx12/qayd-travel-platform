import { apiRequest } from './client';
import { accountsApi, type CreateAccountPayload } from './accounts';
import { journalEntriesApi, type CreateJournalEntryPayload } from './journalEntries';

export interface ClearingAccountItem {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  category: 'BOURSE' | 'OFFICE' | 'CLIENT';
  type: string;
  balanceUSD: number;          // الرصيد الفعلي بالدولار
  balanceIQD: number;          // الرصيد الفعلي بالدينار
  balanceTOMAN: number;        // الرصيد الفعلي بالتومان
  totalConsolidatedUSD: number; // إجمالي التقييم الشامل بالدولار
  contactPerson?: string;
  phone?: string;
  notes?: string;
  parentId?: string;
  /** محتسَب ضمن شجرة الحسابات (الميزانية) — تحت الجذر 29؛ وإلا رقابي تحت 9. */
  countable?: boolean;
}

export interface StatementRow {
  id: string;
  entryId: string;
  date: string;
  reference?: string;
  description: string;
  beneficiary?: string;
  notes?: string;
  debit: number;
  credit: number;
  balance: number;
  currency: 'USD' | 'IQD' | 'TOMAN';
  isMatched?: boolean;
  isAudited?: boolean;
}

// Default Fallback Conversion Rates
export const DEFAULT_RATES = {
  IQD_PER_USD: 1530,        // 1 USD = 1,530 IQD
  TOMAN_PER_USD: 92000,     // 1 USD = 92,000 TOMAN (9,200,000 Toman per $100)
};

export function mapAccountToClearingItem(acc: any, customRates?: { iqdRate?: number; tomanRate?: number }): ClearingAccountItem {
  let cat: 'BOURSE' | 'OFFICE' | 'CLIENT' = 'OFFICE';
  const code: string = acc.code || '';
  // الفرعان متوازيان: 9x رقابي خارج الميزانية، 29x محتسَب ضمنها؛ آخر رقم يحدّد النوع.
  if (code.startsWith('91') || code.startsWith('291')) cat = 'BOURSE';
  else if (code.startsWith('92') || code.startsWith('292')) cat = 'OFFICE';
  else if (code.startsWith('93') || code.startsWith('293')) cat = 'CLIENT';

  let balUSD = 0;
  let balIQD = 0;
  let balTOMAN = 0;
  const realLedgerBalance = Number(acc.balance || 0);

  const rawNotes = (acc as any).address || (acc as any).notes || '';
  let multiData: any = null;
  if (typeof rawNotes === 'string' && rawNotes.includes('{') && rawNotes.includes('}')) {
    try {
      multiData = JSON.parse(rawNotes.substring(rawNotes.indexOf('{'), rawNotes.lastIndexOf('}') + 1));
    } catch (e) {}
  }

  if (multiData) {
    balUSD = Number(multiData.usd ?? realLedgerBalance);
    balIQD = Number(multiData.iqd || 0);
    balTOMAN = Number(multiData.toman || 0);

    // If no foreign currency balances are set, ledger balance is the true USD balance
    if (balIQD === 0 && balTOMAN === 0 && realLedgerBalance !== 0) {
      balUSD = realLedgerBalance;
    }
  } else {
    const curr = (acc.currency || '').toUpperCase();
    if (curr === 'TOMAN' || curr === 'IRR') {
      balTOMAN = realLedgerBalance;
    } else if (curr === 'IQD') {
      balIQD = realLedgerBalance;
    } else {
      balUSD = realLedgerBalance;
    }
  }

  const iqdRate = customRates?.iqdRate || DEFAULT_RATES.IQD_PER_USD;
  const tomanRate = customRates?.tomanRate || DEFAULT_RATES.TOMAN_PER_USD;
  const totalUSD = balUSD + (balIQD / iqdRate) + (balTOMAN / tomanRate);

  return {
    id: acc.id,
    code: acc.code,
    nameAr: acc.nameAr,
    nameEn: acc.nameEn,
    category: cat,
    type: acc.type,
    balanceUSD: balUSD,
    balanceIQD: balIQD,
    balanceTOMAN: balTOMAN,
    totalConsolidatedUSD: totalUSD,
    contactPerson: (acc as any).contactPerson,
    phone: (acc as any).phone,
    notes: (acc as any).address && !(acc as any).address.startsWith('{') ? (acc as any).address : undefined,
    parentId: acc.parentId,
    countable: String(acc.code || '').startsWith('29'),
  };
}

export const clearingsApi = {
  // Convert any currency to USD
  convertToUSD: (amount: number, currency: 'USD' | 'IQD' | 'TOMAN' | string, customRate?: number): number => {
    if (!amount || amount === 0) return 0;
    if (currency === 'USD') return amount;
    if (currency === 'IQD') {
      const rate = customRate && customRate > 0 ? customRate : DEFAULT_RATES.IQD_PER_USD;
      return amount / rate;
    }
    if (currency === 'TOMAN') {
      const rate = customRate && customRate > 0 ? customRate : DEFAULT_RATES.TOMAN_PER_USD;
      return amount / rate;
    }
    return amount;
  },

  // Get all clearing accounts from the real accounts table (codes starting with 9)
  // Pass prefetchedAccounts to avoid redundant getFlat() calls
  getAll: async (customRates?: { iqdRate?: number; tomanRate?: number }, prefetchedAccounts?: any[]): Promise<ClearingAccountItem[]> => {
    try {
      const allAccounts = prefetchedAccounts || await accountsApi.getFlat();
      // Filter accounts under code 9 / 91
      const PARENT_CODES = ['9', '91', '92', '93', '29', '291', '292', '293'];
      const clearingAccounts = allAccounts.filter(
        (acc) =>
          (acc.code?.startsWith('9') || acc.code?.startsWith('29')) &&
          !PARENT_CODES.includes(acc.code),
      );

      return clearingAccounts.map(acc => mapAccountToClearingItem(acc, customRates));
    } catch (e) {
      console.error('Error fetching clearing accounts:', e);
      return [];
    }
  },

  // Create a new multi-currency clearing account in Supabase
  create: async (payload: {
    category: 'BOURSE' | 'OFFICE' | 'CLIENT';
    nameAr: string;
    nameEn?: string;
    phone?: string;
    contactPerson?: string;
    notes?: string;
    openingBalanceType?: 'DEBIT' | 'CREDIT';
    openingBalanceUSD?: number;
    openingBalanceIQD?: number;
    openingBalanceTOMAN?: number;
    iqdRate?: number;
    tomanRate?: number;
    countable?: boolean;
  }, prefetchedAccounts?: any[]) => {
    /*
     * الأب حسب النوع وحسب الاحتساب.
     *
     * غير محتسَب (الافتراضي): تحت الجذر 9 الرقابي — 91/92/93، خارج الميزانية.
     * محتسَب: تحت الجذر 29 ضمن الميزانية — 291/292/293، فيظهر في شجرة الحسابات
     * ويُحتسب في الموجودات/المطلوبات.
     */
    const on = payload.countable === true;
    let parentCode = on ? '292' : '92'; // المكاتب الوسيطة افتراضاً
    if (payload.category === 'BOURSE') parentCode = on ? '291' : '91';
    else if (payload.category === 'CLIENT') parentCode = on ? '293' : '93';

    // إعادة استعمال قائمة الحسابات المحمّلة في الصفحة — تجنّباً لجلبها من جديد.
    const allAccounts = prefetchedAccounts && prefetchedAccounts.length
      ? prefetchedAccounts
      : await accountsApi.getFlat();
    const parentAccount = allAccounts.find(a => a.code === parentCode);
    const siblings = allAccounts.filter(a => a.code.startsWith(parentCode) && a.code !== parentCode);

    let nextCodeNum = 1;
    if (siblings.length > 0) {
      const nums = siblings.map(s => {
        const sub = s.code.substring(parentCode.length);
        const parsed = parseInt(sub, 10);
        return isNaN(parsed) ? 0 : parsed;
      });
      nextCodeNum = Math.max(...nums) + 1;
    }
    const finalCode = `${parentCode}${String(nextCodeNum).padStart(2, '0')}`;

    const isCredit = payload.openingBalanceType === 'CREDIT';
    const sign = isCredit ? -1 : 1;

    const multiData = {
      usd: sign * (payload.openingBalanceUSD || 0),
      iqd: sign * (payload.openingBalanceIQD || 0),
      toman: sign * (payload.openingBalanceTOMAN || 0),
      note: payload.notes || '',
    };

    const accountPayload: CreateAccountPayload = {
      code: finalCode,
      nameAr: payload.nameAr,
      nameEn: payload.nameEn || undefined,
      type: 'LIABILITY',
      category: 'GENERAL',
      parentId: parentAccount?.id,
      currency: 'MULTI',
      phone: payload.phone,
      contactPerson: payload.contactPerson,
      address: JSON.stringify(multiData),
    };

    const created = await accountsApi.create(accountPayload);

    // If there are opening balances, record opening journal entries in Supabase
    const iqdRate = payload.iqdRate || DEFAULT_RATES.IQD_PER_USD;
    const tomanRate = payload.tomanRate || DEFAULT_RATES.TOMAN_PER_USD;

    const totalOpenUSD = (payload.openingBalanceUSD || 0) + 
      ((payload.openingBalanceIQD || 0) / iqdRate) + 
      ((payload.openingBalanceTOMAN || 0) / tomanRate);

    const debitAccId = isCredit ? (parentAccount?.id || created.id) : created.id;
    const creditAccId = isCredit ? created.id : (parentAccount?.id || created.id);
    const natureLabel = isCredit ? 'دائن (علينا/له)' : 'مدين (لنا/في ذمته)';

    if (totalOpenUSD > 0 && created?.id) {
      try {
        await journalEntriesApi.create({
          date: new Date().toISOString().split('T')[0],
          description: `رصيد افتتاحي [${natureLabel}] متعدد العملات لحساب التصفية: ${payload.nameAr} ($${totalOpenUSD.toFixed(2)})`,
          reference: `OPEN-${created.code}`,
          postImmediately: true,
          lines: [
            {
              accountId: debitAccId,
              debit: totalOpenUSD,
              credit: 0,
              description: `رصيد افتتاحي [${natureLabel}] ($:${payload.openingBalanceUSD || 0}, IQD:${payload.openingBalanceIQD || 0}, TOMAN:${payload.openingBalanceTOMAN || 0})`,
            },
            {
              accountId: creditAccId,
              debit: 0,
              credit: totalOpenUSD,
              description: `مقابل رصيد افتتاحي تصفية خارجية [${natureLabel}]`,
            }
          ]
        } as any);
      } catch (err) {
        console.warn('Could not post opening entry for clearing account:', err);
      }
    }

    return created;
  },

  // Update existing clearing account
  update: async (
    id: string,
    payload: {
      nameAr: string;
      nameEn?: string;
      phone?: string;
      contactPerson?: string;
      notes?: string;
    }
  ) => {
    // Preserve existing address JSON data if present (to retain initial multi-currency values)
    const existing = await accountsApi.getById(id);
    let existingMultiData: any = {};
    if (existing?.address && existing.address.startsWith('{')) {
      try {
        existingMultiData = JSON.parse(existing.address);
      } catch (e) {}
    }
    existingMultiData.note = payload.notes || '';

    return accountsApi.update(id, {
      nameAr: payload.nameAr,
      nameEn: payload.nameEn || undefined,
      phone: payload.phone,
      contactPerson: payload.contactPerson,
      address: JSON.stringify(existingMultiData),
    });
  },

  // Record a Voucher / Movement (Receipt, Payment, or Journal Entry)
  createVoucher: async (payload: {
    voucherType: 'RECEIPT' | 'PAYMENT' | 'JOURNAL';
    clearingAccountId: string;
    clearingAccountName: string;
    counterAccountId: string;
    counterAccountName: string;
    amount: number;
    currency: 'USD' | 'IQD' | 'TOMAN';
    exchangeRate?: number;
    convertedUSDAmount: number;
    reference?: string;
    date?: string;
    description?: string;
  }) => {
    // RECEIPT (قبض من التصفية): CounterAccount is Debit, ClearingAccount is Credit
    // PAYMENT (دفع إلى التصفية): ClearingAccount is Debit, CounterAccount is Credit
    // JOURNAL (قيد تصفية): ClearingAccount is Debit, CounterAccount is Credit
    const isReceipt = payload.voucherType === 'RECEIPT';
    const debitAccountId = isReceipt ? payload.counterAccountId : payload.clearingAccountId;
    const creditAccountId = isReceipt ? payload.clearingAccountId : payload.counterAccountId;

    const voucherLabel = isReceipt ? 'سند قبض تصفية' : payload.voucherType === 'PAYMENT' ? 'سند دفع تصفية' : 'قيد تصفية خارجية';

    const entryPayload = {
      date: payload.date || new Date().toISOString().split('T')[0],
      description: payload.description || `${voucherLabel}: ${payload.clearingAccountName} (${payload.amount.toLocaleString()} ${payload.currency} = $${payload.convertedUSDAmount.toFixed(2)})`,
      reference: payload.reference || `${isReceipt ? 'REC' : 'PAY'}-${Date.now().toString().slice(-6)}`,
      postImmediately: true,
      lines: [
        {
          accountId: debitAccountId,
          debit: payload.convertedUSDAmount,
          credit: 0,
          description: `${voucherLabel} - ${payload.amount.toLocaleString()} ${payload.currency}`,
        },
        {
          accountId: creditAccountId,
          debit: 0,
          credit: payload.convertedUSDAmount,
          description: `${voucherLabel} - ${payload.amount.toLocaleString()} ${payload.currency}`,
        },
      ],
    };

    const entry = await journalEntriesApi.create(entryPayload as any);

    // Update multi-currency balance metadata for the clearing account
    try {
      const acc = await accountsApi.getById(payload.clearingAccountId);
      let multiData: any = { usd: 0, iqd: 0, toman: 0, note: '' };
      if (acc?.address && acc.address.includes('{') && acc.address.includes('}')) {
        try {
          multiData = JSON.parse(acc.address.substring(acc.address.indexOf('{'), acc.address.lastIndexOf('}') + 1));
        } catch (e) {}
      }

      // Delta: Payment increases clearing debit balance (+), Receipt decreases clearing balance (-)
      const sign = isReceipt ? -1 : 1;
      if (payload.currency === 'USD') {
        multiData.usd = (Number(multiData.usd) || 0) + (sign * payload.amount);
      } else if (payload.currency === 'IQD') {
        multiData.iqd = (Number(multiData.iqd) || 0) + (sign * payload.amount);
      } else if (payload.currency === 'TOMAN') {
        multiData.toman = (Number(multiData.toman) || 0) + (sign * payload.amount);
      }

      await accountsApi.update(payload.clearingAccountId, {
        address: JSON.stringify(multiData),
      });
    } catch (err) {
      console.warn('Could not update multi-currency metadata for clearing account:', err);
    }

    return entry;
  },

  // Update an existing Voucher / Movement with complete financial consistency
  updateVoucher: async (
    entryId: string,
    payload: {
      voucherType: 'RECEIPT' | 'PAYMENT' | 'JOURNAL';
      clearingAccountId: string;
      clearingAccountName: string;
      counterAccountId: string;
      counterAccountName: string;
      amount: number;
      currency: 'USD' | 'IQD' | 'TOMAN';
      exchangeRate?: number;
      convertedUSDAmount: number;
      reference?: string;
      date?: string;
      description?: string;
    }
  ) => {
    const isReceipt = payload.voucherType === 'RECEIPT';
    const debitAccountId = isReceipt ? payload.counterAccountId : payload.clearingAccountId;
    const creditAccountId = isReceipt ? payload.clearingAccountId : payload.counterAccountId;
    const voucherLabel = isReceipt ? 'سند قبض تصفية' : payload.voucherType === 'PAYMENT' ? 'سند دفع تصفية' : 'قيد تصفية خارجية';

    const lines = [
      {
        accountId: debitAccountId,
        debit: payload.convertedUSDAmount,
        credit: 0,
        description: `${voucherLabel} - ${payload.amount.toLocaleString()} ${payload.currency}`,
      },
      {
        accountId: creditAccountId,
        debit: 0,
        credit: payload.convertedUSDAmount,
        description: `${voucherLabel} - ${payload.amount.toLocaleString()} ${payload.currency}`,
      },
    ];

    if (entryId) {
      try {
        return await journalEntriesApi.update(entryId, {
          description: payload.description || `${voucherLabel}: ${payload.clearingAccountName} (${payload.amount.toLocaleString()} ${payload.currency} = $${payload.convertedUSDAmount.toFixed(2)})`,
          date: payload.date,
          lines,
        });
      } catch (e) {
        // Fallback: delete old and recreate
        await journalEntriesApi.delete(entryId).catch(() => {});
      }
    }

    return clearingsApi.createVoucher(payload);
  },

  // Get Single Clearing Account with multi-currency balance
  // Pass prefetchedAccounts to avoid redundant getFlat() calls
  getById: async (accountId: string, customRates?: { iqdRate?: number; tomanRate?: number }, prefetchedAccounts?: any[]): Promise<ClearingAccountItem | null> => {
    try {
      if (prefetchedAccounts && prefetchedAccounts.length > 0) {
        const found = prefetchedAccounts.find(a => a.id === accountId);
        return found ? mapAccountToClearingItem(found, customRates) : null;
      }
      const acc = await accountsApi.getById(accountId);
      if (!acc) return null;
      return mapAccountToClearingItem(acc, customRates);
    } catch (err) {
      console.warn('Error fetching single clearing account:', err);
      return null;
    }
  },

  // Perform Currency Exchange operation within clearing account (e.g. TOMAN/IQD -> USD or vice versa)
  exchangeCurrency: async (payload: {
    clearingAccountId: string;
    clearingAccountName: string;
    fromCurrency: 'USD' | 'IQD' | 'TOMAN';
    fromAmount: number;
    toCurrency: 'USD' | 'IQD' | 'TOMAN';
    toAmount: number;
    exchangeRate: number;
    date?: string;
    description?: string;
  }) => {
    // 1. Post a journal entry representing the currency exchange
    const entryPayload = {
      date: payload.date || new Date().toISOString().split('T')[0],
      description: payload.description || `حركة صرافة لحساب ${payload.clearingAccountName}: تصريف ${payload.fromAmount.toLocaleString()} ${payload.fromCurrency} إلى ${payload.toAmount.toLocaleString()} ${payload.toCurrency} (سعر الصرف: ${payload.exchangeRate})`,
      reference: `EXCH-${Date.now().toString().slice(-6)}`,
      postImmediately: true,
      lines: [
        {
          accountId: payload.clearingAccountId,
          debit: payload.toCurrency === 'USD' ? payload.toAmount : (payload.toAmount / (payload.exchangeRate || 1)),
          credit: payload.fromCurrency === 'USD' ? payload.fromAmount : (payload.fromAmount / (payload.exchangeRate || 1)),
          description: `صرافة: من ${payload.fromCurrency} إلى ${payload.toCurrency}`,
        },
      ],
    };

    const entry = await journalEntriesApi.create(entryPayload as any);

    // 2. Update multi-currency balances metadata
    try {
      const acc = await accountsApi.getById(payload.clearingAccountId);
      let multiData: any = { usd: 0, iqd: 0, toman: 0, note: '' };
      if (acc?.address && acc.address.includes('{') && acc.address.includes('}')) {
        try {
          multiData = JSON.parse(acc.address.substring(acc.address.indexOf('{'), acc.address.lastIndexOf('}') + 1));
        } catch (e) {}
      }

      // Deduct fromCurrency
      if (payload.fromCurrency === 'USD') multiData.usd = (Number(multiData.usd) || 0) - payload.fromAmount;
      else if (payload.fromCurrency === 'IQD') multiData.iqd = (Number(multiData.iqd) || 0) - payload.fromAmount;
      else if (payload.fromCurrency === 'TOMAN') multiData.toman = (Number(multiData.toman) || 0) - payload.fromAmount;

      // Add toCurrency
      if (payload.toCurrency === 'USD') multiData.usd = (Number(multiData.usd) || 0) + payload.toAmount;
      else if (payload.toCurrency === 'IQD') multiData.iqd = (Number(multiData.iqd) || 0) + payload.toAmount;
      else if (payload.toCurrency === 'TOMAN') multiData.toman = (Number(multiData.toman) || 0) + payload.toAmount;

      await accountsApi.update(payload.clearingAccountId, {
        address: JSON.stringify(multiData),
      });
    } catch (err) {
      console.warn('Error updating multi-currency exchange:', err);
    }

    return entry;
  },

  // Fetch detailed account statement movements (server-side filtered for performance)
  getStatement: async (accountId: string): Promise<StatementRow[]> => {
    try {
      const entries = await journalEntriesApi.getByAccountId(accountId);
      const rawRows: any[] = [];

      // Filter entries that touch this account (already pre-filtered by backend)
      entries.forEach((entry: any) => {
        const matchingLines = (entry.lines || []).filter((l: any) => l.accountId === accountId);
        matchingLines.forEach((line: any) => {
          const deb = Number(line.debit || 0);
          const cred = Number(line.credit || 0);

          let detectedCurrency: 'USD' | 'IQD' | 'TOMAN' = 'USD';
          const text = `${entry.description || ''} ${line.description || ''}`.toUpperCase();

          if (entry.currency === 'USD' || entry.currency === 'IQD' || entry.currency === 'TOMAN') {
            detectedCurrency = entry.currency;
          } else if (text.includes('$:') || text.includes('$')) {
            const usdMatch = text.match(/\$[:\s]*([\d,.]+)/);
            const iqdMatch = text.match(/IQD[:\s]*([\d,.]+)/);
            const tomMatch = text.match(/TOMAN[:\s]*([\d,.]+)/);
            const usdVal = usdMatch ? parseFloat(usdMatch[1].replace(/,/g, '')) : 0;
            const iqdVal = iqdMatch ? parseFloat(iqdMatch[1].replace(/,/g, '')) : 0;
            const tomVal = tomMatch ? parseFloat(tomMatch[1].replace(/,/g, '')) : 0;

            if (usdVal > 0 && iqdVal === 0 && tomVal === 0) {
              detectedCurrency = 'USD';
            } else if (tomVal > 0 && usdVal === 0 && iqdVal === 0) {
              detectedCurrency = 'TOMAN';
            } else if (iqdVal > 0 && usdVal === 0 && tomVal === 0) {
              detectedCurrency = 'IQD';
            } else if (text.includes('تومان') && !text.includes('TOMAN:0') && !text.includes('تومان: 0') && !text.includes('TOMAN: 0')) {
              detectedCurrency = 'TOMAN';
            } else if ((text.includes('دينار') || text.includes('د.ع') || text.includes('IQD')) && !text.includes('IQD:0') && !text.includes('دينار: 0')) {
              detectedCurrency = 'IQD';
            } else {
              detectedCurrency = 'USD';
            }
          } else if (text.includes('تومان') || text.includes('TOMAN')) {
            detectedCurrency = 'TOMAN';
          } else if (text.includes('دينار') || text.includes('د.ع') || text.includes('IQD')) {
            detectedCurrency = 'IQD';
          } else {
            detectedCurrency = 'USD';
          }

          // Parse beneficiary if present
          let parsedBeneficiary = '';
          const benefMatch = text.match(/لصالح \/ بواسطة:\s*([^—|]+)/i) || (line.description || entry.description || '').match(/المستفيد[:\s]+([^—|]+)/i);
          if (benefMatch) {
            parsedBeneficiary = benefMatch[1].trim();
          }

          // Parse notes if present
          let parsedNotes = '';
          const notesMatch = (line.description || entry.description || '').match(/\[ملاحظات:\s*([^\]]+)\]/i);
          if (notesMatch) {
            parsedNotes = notesMatch[1].trim();
          }

          rawRows.push({
            id: line.id || `${entry.id}_${line.accountId}`,
            entryId: entry.id,
            date: entry.date ? entry.date.split('T')[0] : new Date().toISOString().split('T')[0],
            reference: entry.reference || entry.code || entry.entryNumber || '',
            description: line.description || entry.description || 'حركة تصفية',
            beneficiary: parsedBeneficiary || undefined,
            notes: parsedNotes || undefined,
            debit: deb,
            credit: cred,
            currency: detectedCurrency,
            isMatched: false,
            isAudited: entry.isAudited ?? false,
          });
        });
      });

      // Sort chronological ascending (oldest first) to compute running cumulative balance accurately
      rawRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let runningBalance = 0;
      const rowsWithBalance: StatementRow[] = rawRows.map(r => {
        runningBalance += (r.debit - r.credit);
        return {
          ...r,
          balance: runningBalance,
        };
      });

      // Return descending (newest first) for user-friendly statement display
      return rowsWithBalance.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (err) {
      console.warn('Error getting statement rows:', err);
      return [];
    }
  },
};


