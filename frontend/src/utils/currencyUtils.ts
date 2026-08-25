/**
 * Centralized Currency Utilities for Travel Agency Accounting
 * Single Source of Truth for currency symbols, labels, decimals, and formatting.
 */

export type CurrencyCode = 'IQD' | 'USD';

export const getCurrencySymbol = (currencyCode?: string | null): string => {
  const code = (currencyCode || 'IQD').toUpperCase();
  if (code === 'USD') return '$';
  return 'IQD';
};

export const getCurrencyLabel = (currencyCode?: string | null): string => {
  const code = (currencyCode || 'IQD').toUpperCase();
  if (code === 'USD') return '$ USD';
  return 'IQD';
};

export const getCurrencyDecimals = (currencyCode?: string | null): number => {
  const code = (currencyCode || 'IQD').toUpperCase();
  if (code === 'USD') return 2;
  return 0;
};

/**
 * Formats a numeric amount dynamically according to the currency code:
 * - IQD: 0 decimals with thousands separator (e.g. 190,000 IQD)
 * - USD: 2 decimals with thousands separator (e.g. $150.00)
 */
export const formatCurrency = (
  amount: number | null | undefined,
  currencyCode?: string | null,
  options?: { showSymbol?: boolean; ltrSymbol?: boolean },
): string => {
  const code = (currencyCode || 'IQD').toUpperCase();
  const val = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const showSymbol = options?.showSymbol !== false;

  if (code === 'USD') {
    const formatted = val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return showSymbol ? `$${formatted}` : formatted;
  }

  // IQD
  const formatted = Math.round(val).toLocaleString('en-US');
  return showSymbol ? `${formatted} IQD` : formatted;
};

/**
 * Parses user string input into a valid clean number
 * Supports Arabic numerals (١٢٣), English numerals, and shortcuts (e.g. 100k -> 100000)
 */
export const parseCurrencyInput = (
  input: string | number | null | undefined,
  currencyCode?: string | null,
): number => {
  if (input === null || input === undefined || input === '') return 0;
  if (typeof input === 'number') return isNaN(input) ? 0 : input;

  // Convert Arabic/Eastern numbers
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let cleanStr = String(input);
  arabicNumerals.forEach((d, idx) => {
    cleanStr = cleanStr.replaceAll(d, String(idx));
  });

  // Clean currency symbols, commas, spaces
  cleanStr = cleanStr.replace(/[$د.عIQD\s,]/gi, '').trim();

  // Multiplier shortcuts (k = 1,000, m = 1,000,000)
  if (/[kKك]$/.test(cleanStr)) {
    const num = parseFloat(cleanStr.slice(0, -1));
    return isNaN(num) ? 0 : num * 1000;
  }
  if (/[mMم]$/.test(cleanStr)) {
    const num = parseFloat(cleanStr.slice(0, -1));
    return isNaN(num) ? 0 : num * 1000000;
  }

  const parsed = parseFloat(cleanStr);
  if (isNaN(parsed)) return 0;

  const decimals = getCurrencyDecimals(currencyCode);
  if (decimals === 0) {
    return Math.round(parsed);
  }
  return Math.round(parsed * 100) / 100;
};
