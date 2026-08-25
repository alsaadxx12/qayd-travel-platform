// Deleted Records Archive Utility
// Saves deleted items to localStorage before they are permanently removed from the API

const ARCHIVE_KEY = 'system_deleted_records_archive';

export interface DeletedRecord {
  id: string;
  type: 'ticket' | 'visa' | 'group' | 'hotel' | 'receipt_voucher' | 'payment_voucher' | 'journal_entry';
  typeLabel: { ar: string; en: string };
  number: string;
  description: string;
  amount?: number;
  currency?: string;
  date?: string;
  deletedAt: string;
  deletedBy?: string;
  originalData: any;
}

function getArchive(): DeletedRecord[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveArchive(records: DeletedRecord[]): void {
  try {
    const trimmed = records.slice(0, 500);
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Error saving archive:', err);
  }
}

export function archiveDeletedRecord(record: DeletedRecord): void {
  const existing = getArchive();
  const filtered = existing.filter((r) => r.id !== record.id);
  saveArchive([record, ...filtered]);
}

export function getDeletedRecords(): DeletedRecord[] {
  return getArchive();
}

export function removeFromArchive(id: string): void {
  const existing = getArchive();
  saveArchive(existing.filter((r) => r.id !== id));
}

export function clearArchive(): void {
  localStorage.removeItem(ARCHIVE_KEY);
}

export function archiveTicket(ticket: any, deletedBy?: string): void {
  archiveDeletedRecord({
    id: ticket.id || ticket.number || 't-' + Date.now(),
    type: 'ticket',
    typeLabel: { ar: 'تذكرة طيران', en: 'Flight Ticket' },
    number: ticket.number || ticket.invoiceNumber || '',
    description: ticket.customerName || ticket.passengerName || ticket.pnr || '',
    amount: ticket.netSell || ticket.totalSell || 0,
    currency: ticket.currency || 'IQD',
    date: ticket.issueDate || ticket.date || '',
    deletedAt: new Date().toISOString(),
    deletedBy,
    originalData: ticket,
  });
}

export function archiveVisa(visa: any, deletedBy?: string): void {
  archiveDeletedRecord({
    id: visa.id || 'v-' + Date.now(),
    type: 'visa',
    typeLabel: { ar: 'فيزا', en: 'Visa' },
    number: visa.invoiceNumber || visa.number || '',
    description: visa.customerName || visa.applicantName || '',
    amount: visa.netSell || visa.totalSell || visa.sellPrice || 0,
    currency: visa.currency || 'IQD',
    date: visa.issueDate || visa.date || '',
    deletedAt: new Date().toISOString(),
    deletedBy,
    originalData: visa,
  });
}

export function archiveGroup(group: any, deletedBy?: string): void {
  archiveDeletedRecord({
    id: group.id || 'g-' + Date.now(),
    type: 'group',
    typeLabel: { ar: 'كروب', en: 'Group' },
    number: group.number || group.groupNumber || '',
    description: group.name || group.groupName || '',
    amount: group.totalSell || group.totalSale || 0,
    currency: group.currency || 'IQD',
    date: group.date || group.departureDate || '',
    deletedAt: new Date().toISOString(),
    deletedBy,
    originalData: group,
  });
}

export function archiveHotel(hotel: any, deletedBy?: string): void {
  archiveDeletedRecord({
    id: hotel.id || 'h-' + Date.now(),
    type: 'hotel',
    typeLabel: { ar: 'حجز فندق', en: 'Hotel Booking' },
    number: hotel.invoiceNumber || '',
    description: (hotel.hotelName || '') + ' - ' + (hotel.customerName || ''),
    amount: hotel.totalSale || hotel.totalSell || 0,
    currency: hotel.currency || 'USD',
    date: hotel.issueDate || hotel.checkInDate || '',
    deletedAt: new Date().toISOString(),
    deletedBy,
    originalData: hotel,
  });
}

export function archiveVoucher(voucher: any, voucherType: 'receipt' | 'payment', deletedBy?: string): void {
  archiveDeletedRecord({
    id: voucher.id || 'rv-' + Date.now(),
    type: voucherType === 'receipt' ? 'receipt_voucher' : 'payment_voucher',
    typeLabel: voucherType === 'receipt'
      ? { ar: 'سند قبض', en: 'Receipt Voucher' }
      : { ar: 'سند دفع', en: 'Payment Voucher' },
    number: voucher.voucherNumber || '',
    description: voucher.description || '',
    amount: voucher.amount || 0,
    currency: voucher.currency || 'IQD',
    date: voucher.date || '',
    deletedAt: new Date().toISOString(),
    deletedBy,
    originalData: voucher,
  });
}
