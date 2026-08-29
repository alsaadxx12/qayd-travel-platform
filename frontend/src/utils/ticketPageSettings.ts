export const TICKET_PAGE_SETTINGS_KEY = 'ticket_page_defaults';

/**
 * Editor screens that share the same "window settings" panel.
 * Each keeps its own saved defaults — a hotel booking and a ticket rarely want the
 * same currency or the same default customer.
 */
export type EditorModule = 'tickets' | 'hotels' | 'visas' | 'refunds';

const MODULE_KEY: Record<EditorModule, string> = {
  // 'tickets' intentionally keeps the original key so settings saved before this
  // panel was generalised are not silently lost.
  tickets: TICKET_PAGE_SETTINGS_KEY,
  hotels: 'hotel_page_defaults',
  visas: 'visa_page_defaults',
  refunds: 'refund_page_defaults',
};

export interface TicketPageSettings {
  defaultCurrency: 'IQD' | 'USD';
  defaultCustomerName: string;
  defaultCustomerId: string;
  linkCashboxToEmployee: boolean;
  defaultPaymentMethod: string;
  defaultPaymentType: 'نقدي' | 'آجل';
  datesDefaultToday: boolean;
  entryDateIncludesTime: boolean;
}

export const DEFAULT_TICKET_PAGE_SETTINGS: TicketPageSettings = {
  defaultCurrency: 'IQD',
  defaultCustomerName: 'مسافر كاش',
  defaultCustomerId: '',
  linkCashboxToEmployee: true,
  defaultPaymentMethod: 'CASH_HAND',
  defaultPaymentType: 'نقدي',
  datesDefaultToday: true,
  entryDateIncludesTime: true,
};

function storageKey(companyId?: string, module: EditorModule = 'tickets') {
  const base = MODULE_KEY[module] || TICKET_PAGE_SETTINGS_KEY;
  return companyId ? `${base}_${companyId}` : base;
}

/**
 * Settings live in this browser, so each employee keeps their own defaults without
 * changing anything for a colleague.
 */
export function loadTicketPageSettings(
  companyId?: string,
  module: EditorModule = 'tickets',
): TicketPageSettings {
  try {
    const base = MODULE_KEY[module] || TICKET_PAGE_SETTINGS_KEY;
    const raw = localStorage.getItem(storageKey(companyId, module)) || localStorage.getItem(base);
    if (!raw) return { ...DEFAULT_TICKET_PAGE_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_TICKET_PAGE_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_TICKET_PAGE_SETTINGS };
  }
}

export function saveTicketPageSettings(
  settings: TicketPageSettings,
  companyId?: string,
  module: EditorModule = 'tickets',
) {
  localStorage.setItem(storageKey(companyId, module), JSON.stringify(settings));
}

export function findDefaultCashCustomer(
  candidates: Array<{
    id?: string;
    accountId?: string;
    nameAr?: string;
    nameEn?: string;
    name?: string;
    code?: string;
  }>,
  settings: TicketPageSettings,
) {
  const hint = (settings.defaultCustomerName || DEFAULT_TICKET_PAGE_SETTINGS.defaultCustomerName).trim();
  if (settings.defaultCustomerId) {
    const byId = candidates.find(
      (c) => c.id === settings.defaultCustomerId || c.accountId === settings.defaultCustomerId,
    );
    if (byId) return byId;
  }
  const lower = hint.toLowerCase();
  return (
    candidates.find((c) => [c.nameAr, c.nameEn, c.name, c.code].some((v) => String(v || '').trim() === hint)) ||
    candidates.find((c) => [c.nameAr, c.nameEn, c.name].some((v) => String(v || '').includes(hint))) ||
    candidates.find((c) =>
      [c.nameAr, c.nameEn, c.name].some((v) => String(v || '').toLowerCase().includes('cash')),
    ) ||
    candidates.find((c) => String(c.nameEn || '').toLowerCase().includes(lower)) ||
    null
  );
}

export function customerDisplayName(row: any, isAr: boolean) {
  if (!row) return '';
  return isAr
    ? row.nameAr || row.name || row.nameEn || ''
    : row.nameEn || row.nameAr || row.name || '';
}
