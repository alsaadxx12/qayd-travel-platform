import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Badge,
  ActionIcon,
  Tooltip,
  Modal,
  Menu,
  Button,
  Popover,
} from '@mantine/core';
import {
  FileCheck2,
  Plus,
  RefreshCw,
  Search,
  Filter,
  X,
  Copy,
  Check,
  MoreVertical,
  Edit,
  Trash2,
  Printer,
  History,
  ShieldCheck,
  BadgeCheck,
  ShieldAlert,
  Clock3,
  Banknote,
  ReceiptText,
  TrendingUp,
  RotateCcw,
  Image as ImageIcon,
  UsersRound,
  FileText,
  Building2,
  Calendar,
  Globe,
  MapPin,
  ListFilter,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Layers,
  LayoutList,
  User,
  ServerOff,
} from 'lucide-react';
import { InvoiceAuditLogModal } from '../../components/tickets/InvoiceAuditLogModal';
import { VisaRefundEditorWorkspace } from '../../components/visas/VisaRefundEditorWorkspace';
import { CurrencySegmentedControl } from '../../components/ui/CurrencySegmentedControl';
import { SegmentedDatePicker } from '../../components/ui/SegmentedDatePicker';
import { SearchableCombobox, ComboboxOption } from '../../components/ui/SearchableCombobox';
import { CountryFlagImage } from '../../components/ui/CountryFlagImage';
import { ticketsApi, type TicketData } from '../../api/tickets';
import { partnersApi, Customer, Supplier } from '../../api/partners';
import { showSuccessNotification, showErrorNotification, showInfoNotification } from '../../utils/notifications';
import { archiveVisa } from '../../utils/deletedRecordsArchive';
import { formatCurrency } from '../../utils/currencyUtils';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useAiPageContext } from '../../hooks/useAiPageContext';

const VisaInvoiceEditorWorkspace = React.lazy(() =>
  import('../../components/visas/VisaInvoiceEditorWorkspace').then((module) => ({
    default: module.VisaInvoiceEditorWorkspace,
  })),
);

const VISA_AUDIT_MARKER = '[[VISA_PASSENGER_AUDIT:';

const readVisaPassengerAuditMap = (notes?: string | null): Record<string, boolean> => {
  if (!notes) return {};
  const markerStart = notes.indexOf(VISA_AUDIT_MARKER);
  if (markerStart === -1) return {};
  const payloadStart = markerStart + VISA_AUDIT_MARKER.length;
  const payloadEnd = notes.indexOf(']]', payloadStart);
  if (payloadEnd === -1) return {};

  try {
    const parsed = JSON.parse(notes.slice(payloadStart, payloadEnd));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeVisaPassengerAuditMap = (notes: string | null | undefined, auditMap: Record<string, boolean>) => {
  const cleanNotes = String(notes || '')
    .replace(/\[\[VISA_PASSENGER_AUDIT:[\s\S]*?\]\]/g, '')
    .trim();
  const marker = `${VISA_AUDIT_MARKER}${JSON.stringify(auditMap)}]]`;
  return cleanNotes ? `${cleanNotes}\n${marker}` : marker;
};

const getPassengerAuditKey = (passenger: any, index: number) =>
  String(passenger?.id || passenger?.passportNumber || passenger?.documentNumber || passenger?.ticketNumber || passenger?.name || `p-${index}`);

const toNullableNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const firstRealNumber = (...values: any[]): number | null => {
  for (const value of values) {
    const num = toNullableNumber(value);
    if (num !== null) return num;
  }
  return null;
};

const displayMissing = (isAr: boolean) => (isAr ? 'غير محدد' : 'Not set');

const formatNullableMoney = (value: any, currency: string, isAr: boolean) => {
  const num = toNullableNumber(value);
  if (num === null) return displayMissing(isAr);
  return currency === 'USD'
    ? `$${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    : `${num.toLocaleString('en-US')} IQD`;
};

export const VisasPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const user = useAuthStore((s) => s.user);

  // Modals state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedVisa, setSelectedVisa] = useState<any | null>(null);
  const [auditLogOpen, setAuditLogOpen] = useState<boolean>(false);
  const [auditLogVisa, setAuditLogVisa] = useState<any | null>(null);

  // Delete Confirmation State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [visaToDelete, setVisaToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Raw data state
  const [visas, setVisas] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openingVisaId, setOpeningVisaId] = useState<string | null>(null);
  const [copiedInvoiceNumber, setCopiedInvoiceNumber] = useState<string | null>(null);

  // Context Menu, Receipt Modal & Refund Modal States
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visa: any } | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState<boolean>(false);
  const [selectedReceiptVisa, setSelectedReceiptVisa] = useState<any | null>(null);
  const [refundWorkspaceOpen, setRefundWorkspaceOpen] = useState<boolean>(false);
  const [visaForRefund, setVisaForRefund] = useState<any | null>(null);

  const openVisa = selectedVisa || selectedReceiptVisa || contextMenu?.visa || visaForRefund;
  useAiPageContext({
    route: '/visas',
    entity: openVisa ? 'ticket' : undefined,
    recordId: openVisa?.id,
    label: openVisa?.invoiceNumber || openVisa?.pnr,
  });

  // Close context menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    if (contextMenu) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [contextMenu]);

  // Handle right click on visa row
  const handleVisaContextMenu = (e: React.MouseEvent, visaItem: any) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 220;
    const menuHeight = 250;
    const x = e.clientX + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 10 : e.clientX;
    const y = e.clientY + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 10 : e.clientY;
    setContextMenu({ x, y, visa: visaItem });
  };

  // Filter States
  const [viewMode, setViewMode] = useState<'aggregated' | 'detailed'>('aggregated');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'AUDITED' | 'UNAUDITED'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [visaTypeFilter, setVisaTypeFilter] = useState<string>('');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Partners lists for filters
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const suppliersListRef = useRef<Supplier[]>([]);
  const customersListRef = useRef<Customer[]>([]);
  const partnersLoadStartedRef = useRef(false);
  const initialVisaFetchStartedRef = useRef(false);

  // Partner lists are filter metadata. Load them after the primary visa request
  // so they never block the financial records or compete with the first query.
  const loadPartners = useCallback(async () => {
    if (partnersLoadStartedRef.current) return;
    partnersLoadStartedRef.current = true;

    try {
      const [sups, custs] = await Promise.all([
        partnersApi.getSuppliers(),
        partnersApi.getCustomers(),
      ]);
      suppliersListRef.current = sups || [];
      customersListRef.current = custs || [];
      setSuppliersList(sups || []);
      setCustomersList(custs || []);
    } catch (err) {
      console.error('Failed to load partners for visa filters:', err);
    }
  }, []);

  // Fetch real Visas from database
  const fetchVisas = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await ticketsApi.getVisas({ limit: 150 });
      const isVisaRecord = (ticket: any) =>
          ticket.tripType === 'VISA' ||
          ticket.invoiceNumber?.startsWith('VISA-') ||
          ticket.invoiceNumber?.startsWith('KAB-VISA') ||
          String(ticket.invoiceNumber || '').toUpperCase().includes('VISA') ||
          ticket.pnr?.includes('فيزا') ||
          String(ticket.pnr || '').toUpperCase().includes('VISA') ||
          ticket.airline?.includes('فيزا') ||
          String(ticket.airline || '').toUpperCase().includes('VISA') ||
          (ticket.passengers && ticket.passengers.some((passenger: any) => passenger.pnr?.includes('فيزا') || passenger.visaType));
      const isRefundRecord = (ticket: any) =>
        ticket.tripType === 'REFUND' || ticket.status === 'REFUNDED' || String(ticket.invoiceNumber || '').startsWith('REF-');
      const allVisaRecords = data || [];
      const visaRefunds = allVisaRecords.filter((ticket: any) => isRefundRecord(ticket) && isVisaRecord(ticket));
      const visaRecords = allVisaRecords.filter((ticket: any) => !isRefundRecord(ticket) && isVisaRecord(ticket));

      const enriched = visaRecords.map((v: any, idx: number) => {
        const firstPass = v.passengers?.[0];
        const rawPnr = firstPass?.pnr || v.airline || v.route || '';
        let primaryVisaType = '';
        let visaOrderNumber = firstPass?.orderNumber || '';

        if (rawPnr) {
          const match = String(rawPnr).match(/^([^\[]+)(?:\[([^\]]+)\])?/);
          if (match) {
            primaryVisaType = match[1].trim();
            if (!visaOrderNumber && match[2]) {
              visaOrderNumber = match[2].trim();
            }
          } else {
            primaryVisaType = String(rawPnr);
          }
        }
        primaryVisaType = primaryVisaType.replace(/\[.*?\]/g, '').trim();

        const matchedRefunds = visaRefunds.filter((refund: any) => {
          const reference = String(refund.reference || '').trim();
          const refundOrder = String(refund.pnr || '').trim().toUpperCase();
          const visaOrder = String(v.pnr || '').trim().toUpperCase();
          return (reference && (reference === v.invoiceNumber || reference === v.id))
            || (refundOrder && visaOrder && refundOrder === visaOrder);
        });
        const refundedDocuments = new Set<string>();
        const refundedNames = new Set<string>();
        matchedRefunds.forEach((refund: any) => {
          (refund.passengers || []).forEach((passenger: any) => {
            const documentNumber = String(passenger.documentNumber || passenger.ticketNumber || '').trim().toUpperCase();
            const passengerName = String(passenger.name || '').trim().toUpperCase();
            if (documentNumber) refundedDocuments.add(documentNumber);
            if (passengerName) refundedNames.add(passengerName);
          });
        });

        const passengerAuditMap = readVisaPassengerAuditMap(v.notes);
        const passengersWithAudit = (v.passengers || []).map((p: any, pIdx: number) => {
          const auditKey = getPassengerAuditKey(p, pIdx);
          const documentNumber = String(p.passportNumber || p.documentNumber || p.ticketNumber || '').trim().toUpperCase();
          const passengerName = String(p.name || '').trim().toUpperCase();
          const isRefunded = Boolean(
            p.isRefunded
            || p.status === 'REFUNDED'
            || p.status === 'مسترجع'
            || (documentNumber && refundedDocuments.has(documentNumber))
            || (passengerName && refundedNames.has(passengerName))
            || (matchedRefunds.length > 0 && (v.passengers || []).length === 1),
          );
          return {
            ...p,
            isAudited: passengerAuditMap[auditKey] !== undefined ? passengerAuditMap[auditKey] : Boolean(v.isAudited),
            isRefunded,
          };
        });

        const primaryPassenger = firstPass?.name || v.customerName || '';
        const passCount = v.passengers?.length || 1;
        const totalSell = firstRealNumber(v.totalSell, v.netSell);
        const totalBuy = firstRealNumber(v.totalBuy, v.netBuy);
        const explicitProfit = toNullableNumber(v.profit);
        const profit = explicitProfit !== null
          ? explicitProfit
          : totalSell !== null && totalBuy !== null
          ? totalSell - totalBuy
          : null;
        const currency = (v.currency || 'USD').toUpperCase();
        const allPassengerNames = (v.passengers || []).map((p: any) => p.name).filter(Boolean);
        const refundedCount = passengersWithAudit.filter((passenger: any) => passenger.isRefunded).length;
        const refundStatus = refundedCount === 0 ? 'NONE' : refundedCount >= passCount ? 'FULL' : 'PARTIAL';

        const rawCust = v.customer?.nameAr || v.customer?.nameEn || v.customerName || v.agentName || '';
        let customerName = rawCust;
        if (rawCust) {
          const foundCust = (customersListRef.current || []).find((c: any) => c.id === rawCust || c.code === rawCust || c.nameAr === rawCust || c.nameEn === rawCust);
          if (foundCust) {
            customerName = foundCust.nameAr || foundCust.nameEn || foundCust.code || rawCust;
          }
        }
        if (!customerName) customerName = '';

        // English-formatted date string
        let dateFormatted = '—';
        if (v.issueDate) {
          const d = new Date(v.issueDate);
          dateFormatted = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : String(v.issueDate).substring(0, 10);
        }

        // Clean Supplier Resolution
        const relatedSupplierName = v.supplier?.nameAr || v.supplier?.nameEn || '';
        const rawSupp = relatedSupplierName || v.supplierAccountName || v.supplierAccount || v.supplierName || '';
        let supplierName = relatedSupplierName || v.supplierAccountName;
        if (!supplierName || supplierName === 'مزود تأشيرات' || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(supplierName)) {
          const foundSupp = (suppliersListRef.current || []).find((s: any) => s.id === v.supplierAccount || s.accountId === v.supplierAccount || s.code === v.supplierAccount || s.id === rawSupp || s.code === rawSupp);
          if (foundSupp) {
            supplierName = foundSupp.nameAr || foundSupp.nameEn || (foundSupp as any).name || foundSupp.code;
          }
        }
        if (!supplierName) {
          supplierName = '';
        }

        return {
          ...v,
          passengers: passengersWithAudit.length > 0 ? passengersWithAudit : v.passengers,
          rawInvoice: v,
          rowNumber: idx + 1,
          dateFormatted,
          primaryVisaType,
          visaOrderNumber,
          primaryPassenger,
          allPassengerNames: allPassengerNames.length > 0 ? allPassengerNames : [primaryPassenger],
          passCount,
          totalSell,
          totalBuy,
          profit,
          currency,
          customerNameDisplay: customerName,
          supplierNameDisplay: supplierName,
          statusDisplay: v.status || '',
          refundedCount,
          refundStatus,
          isAudited: Boolean(v.isAudited),
        };
      });

      setVisas(enriched);
    } catch (err: any) {
      console.error('Failed to fetch visas:', err);
      setVisas([]);
      setLoadError(err.message || (isAr ? 'تعذر الاتصال بالخادم' : 'Could not connect to the server'));
      showErrorNotification(
        isAr ? 'خطأ في جلب التأشيرات' : 'Error Fetching Visas',
        err.message || (isAr ? 'تعذر جلب سجل التأشيرات من الخادم' : 'Could not fetch visas from server')
      );
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    if (!initialVisaFetchStartedRef.current) {
      initialVisaFetchStartedRef.current = true;
      void fetchVisas().finally(() => {
        void loadPartners();
      });
    }

    const handleBranchChange = () => {
      fetchVisas();
    };

    window.addEventListener('active-branch-changed', handleBranchChange);
    return () => {
      window.removeEventListener('active-branch-changed', handleBranchChange);
    };
  }, [fetchVisas, loadPartners]);

  // Handle open create modal
  const handleOpenCreateModal = () => {
    setSelectedVisa(null);
    setModalOpen(true);
  };

  // Handle open edit modal
  const handleOpenEditModal = async (visa: any) => {
    const listRecord = visa.rawInvoice || visa;
    const recordId = listRecord?.id;
    if (!recordId || openingVisaId) return;

    try {
      setOpeningVisaId(recordId);
      const fullRecord = await ticketsApi.getOne(recordId);
      setSelectedVisa(fullRecord);
      setModalOpen(true);
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'تعذر فتح المعاملة' : 'Could Not Open Visa',
        err.message || (isAr ? 'تعذر جلب تفاصيل معاملة الفيزا.' : 'Could not load the visa transaction details.'),
      );
    } finally {
      setOpeningVisaId(null);
    }
  };

  // Handle delete visa record confirmation
  const handleConfirmDeleteVisa = async () => {
    if (!visaToDelete?.id) return;
    try {
      setDeleting(true);
      archiveVisa(visaToDelete?.rawInvoice || visaToDelete);
      await ticketsApi.delete(visaToDelete.id);
      showSuccessNotification(
        isAr ? 'تم الحذف' : 'Deleted',
        isAr ? 'تم حذف معاملة التأشيرة بنجاح.' : 'Visa record deleted successfully.'
      );
      setVisas((prev) => prev.filter((v) => v.id !== visaToDelete.id));
      setDeleteConfirmOpen(false);
      setVisaToDelete(null);
    } catch (err: any) {
      showErrorNotification(
        isAr ? 'خطأ في الحذف' : 'Delete Failed',
        err.message || (isAr ? 'تعذر حذف المعاملة' : 'Could not delete visa record')
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleRequestDelete = (visa: any) => {
    setVisaToDelete(visa);
    setDeleteConfirmOpen(true);
  };

  // Optimistic update on save
  const handleVisaSaved = () => {
    fetchVisas();
    setModalOpen(false);
    setSelectedVisa(null);
  };

  // Copy invoice number
  const handleCopyInvoiceNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedInvoiceNumber(num);
    setTimeout(() => setCopiedInvoiceNumber(null), 2000);
    showSuccessNotification(
      isAr ? 'تم النسخ' : 'Copied',
      isAr ? `تم نسخ رقم الفاتورة ${num}` : `Copied invoice ${num}`
    );
  };

  // Toggle Individual Passenger Visa Status (Issued / NotIssued)
  const handleTogglePassengerStatus = async (dRow: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const parentVisa = dRow.parentVisa;
    if (!parentVisa) return;

    const currentStatus = dRow.status;
    const targetStatus = currentStatus === 'Issued' ? 'NotIssued' : 'Issued';

    const currentPassengers = parentVisa.passengers && parentVisa.passengers.length > 0
      ? [...parentVisa.passengers]
      : [{ name: parentVisa.primaryPassenger, passportNumber: '', status: currentStatus }];

    const updatedPassengers = currentPassengers.map((p: any, idx: number) => {
      if (idx === dRow.passengerRawIndex || p.id === dRow.passengerId) {
        return { ...p, status: targetStatus };
      }
      return p;
    });

    const allIssued = updatedPassengers.every((p: any) => p.status === 'Issued' || p.status === 'صادر');

    // Optimistic Update
    setVisas((prev) =>
      prev.map((v) => {
        if (v.id === parentVisa.id || v.invoiceNumber === parentVisa.invoiceNumber) {
          return {
            ...v,
            passengers: updatedPassengers,
            status: allIssued ? 'CONFIRMED' : 'DRAFT',
            statusDisplay: allIssued ? 'CONFIRMED' : 'DRAFT',
          };
        }
        return v;
      })
    );

    try {
      if (parentVisa.id) {
        await ticketsApi.update(parentVisa.id, {
          passengers: updatedPassengers,
          status: allIssued ? 'CONFIRMED' : 'DRAFT',
        });
      }
      showSuccessNotification(
        isAr ? 'حالة التأشيرة' : 'Visa Status',
        isAr
          ? `تم تعديل حالة التأشيرة للمسافر (${dRow.passengerName}) إلى: ${targetStatus === 'Issued' ? 'صادر' : 'غير صادر'}`
          : `Visa status updated for ${dRow.passengerName}: ${targetStatus}`
      );
    } catch (err: any) {
      fetchVisas();
      showErrorNotification(
        isAr ? 'خطأ في تعديل الحالة' : 'Status Update Failed',
        err.message || (isAr ? 'تعذر حفظ حالة التأشيرة' : 'Could not update visa status')
      );
    }
  };

  // Toggle Individual Passenger Audit Status
  const handleTogglePassengerAudit = async (dRow: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const parentVisa = dRow.parentVisa;
    if (!parentVisa) return;

    const targetAudit = !dRow.isAudited;

    const currentPassengers = parentVisa.passengers && parentVisa.passengers.length > 0
      ? [...parentVisa.passengers]
      : [{ name: parentVisa.primaryPassenger, passportNumber: '', isAudited: parentVisa.isAudited }];

    const updatedPassengers = currentPassengers.map((p: any, idx: number) => {
      if (idx === dRow.passengerRawIndex || p.id === dRow.passengerId) {
        return { ...p, isAudited: targetAudit };
      }
      return { ...p, isAudited: p.isAudited !== undefined ? p.isAudited : Boolean(parentVisa.isAudited) };
    });

    const auditedCount = updatedPassengers.filter((p: any) => Boolean(p.isAudited)).length;
    const isMasterAudited = auditedCount === updatedPassengers.length;
    const auditMap = updatedPassengers.reduce<Record<string, boolean>>((acc, passenger, index) => {
      acc[getPassengerAuditKey(passenger, index)] = Boolean(passenger.isAudited);
      return acc;
    }, {});
    const nextNotes = writeVisaPassengerAuditMap(parentVisa.notes, auditMap);

    // Optimistic Update
    setVisas((prev) =>
      prev.map((v) => {
        if (v.id === parentVisa.id || v.invoiceNumber === parentVisa.invoiceNumber) {
          return {
            ...v,
            passengers: updatedPassengers,
            isAudited: isMasterAudited,
            notes: nextNotes,
          };
        }
        return v;
      })
    );

    try {
      if (parentVisa.id) {
        await ticketsApi.update(parentVisa.id, {
          passengers: updatedPassengers,
          isAudited: isMasterAudited,
          auditedBy: user?.name || user?.email || undefined,
          notes: nextNotes,
        });
      }
      showSuccessNotification(
        isAr ? 'تدقيق المسافر' : 'Passenger Audit',
        targetAudit
          ? (isAr ? `تم تدقيق المسافر (${dRow.passengerName}) بنجاح.` : `Audited passenger (${dRow.passengerName})`)
          : (isAr ? `تم إلغاء التدقيق عن المسافر (${dRow.passengerName}).` : `Un-audited passenger (${dRow.passengerName})`)
      );
    } catch (err: any) {
      fetchVisas();
      showErrorNotification(
        isAr ? 'فشل تحديث التدقيق' : 'Audit Failed',
        err.message || (isAr ? 'تعذر حفظ حالة التدقيق' : 'Could not update audit status')
      );
    }
  };

  // Toggle Master Audit (All Passengers in Invoice)
  const handleToggleAudit = async (visa: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const invoiceId = visa.id || visa.invoiceNumber;
    const currentPassengers = visa.passengers && visa.passengers.length > 0
      ? [...visa.passengers]
      : [{ name: visa.primaryPassenger, passportNumber: '', isAudited: visa.isAudited }];

    const auditedCount = currentPassengers.filter((p: any) => p.isAudited !== undefined ? Boolean(p.isAudited) : Boolean(visa.isAudited)).length;
    const isAllCurrentlyAudited = auditedCount === currentPassengers.length;
    const targetStatus = !isAllCurrentlyAudited;

    const updatedPassengers = currentPassengers.map((p: any) => ({
      ...p,
      isAudited: targetStatus,
    }));
    const auditMap = updatedPassengers.reduce<Record<string, boolean>>((acc, passenger, index) => {
      acc[getPassengerAuditKey(passenger, index)] = targetStatus;
      return acc;
    }, {});
    const nextNotes = writeVisaPassengerAuditMap(visa.notes, auditMap);

    try {
      setVisas((prev) =>
        prev.map((v) => (v.id === invoiceId ? { ...v, isAudited: targetStatus, passengers: updatedPassengers, notes: nextNotes } : v))
      );

      if (visa.id) {
        await ticketsApi.update(visa.id, {
          isAudited: targetStatus,
          auditedBy: user?.name || user?.email || undefined,
          passengers: updatedPassengers,
          notes: nextNotes,
        });
      }

      showSuccessNotification(
        isAr ? 'التدقيق المالي' : 'Financial Audit',
        targetStatus
          ? (isAr ? `تم تدقيق واعتماد كافة مسافري المعاملة (${visa.invoiceNumber}) بنجاح.` : `All passengers audited for (${visa.invoiceNumber}).`)
          : (isAr ? `تمت إعادة معاملة الفيزا (${visa.invoiceNumber}) إلى قيد المراجعة.` : `Visa (${visa.invoiceNumber}) marked as unaudited.`)
      );
    } catch (err: any) {
      fetchVisas();
      showErrorNotification(
        isAr ? 'فشل تحديث التدقيق' : 'Audit Toggle Failed',
        err.message || (isAr ? 'تعذر تعديل حالة التدقيق' : 'Could not update audit status')
      );
    }
  };

  // Extract unique visa types for the filter dropdown
  const uniqueVisaTypeOptions: ComboboxOption[] = useMemo(() => {
    const set = new Set<string>();
    visas.forEach((v) => {
      if (v.primaryVisaType && v.primaryVisaType !== '—') {
        set.add(v.primaryVisaType);
      }
    });
    return Array.from(set).map((type) => ({
      value: type,
      label: type,
    }));
  }, [visas]);

  // Formatted Combobox Options for Suppliers & Customers
  const supplierOptions: ComboboxOption[] = useMemo(() => {
    return suppliersList.map((s) => ({
      value: s.nameAr || s.nameEn || s.id,
      label: (isAr ? s.nameAr : (s.nameEn || s.nameAr)) || s.code || '',
    }));
  }, [suppliersList, isAr]);

  const customerOptions: ComboboxOption[] = useMemo(() => {
    return customersList.map((c) => ({
      value: c.nameAr || c.nameEn || c.id,
      label: (isAr ? c.nameAr : (c.nameEn || c.nameAr)) || c.code || '',
    }));
  }, [customersList, isAr]);

  // ── Filter Data ──
  const filteredVisas = useMemo(() => {
    return visas.filter((v) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchInvoice = (v.invoiceNumber || '').toLowerCase().includes(q);
        const matchCustomer = (v.customerName || '').toLowerCase().includes(q);
        const matchSupplier = (v.supplierAccountName || v.supplierName || '').toLowerCase().includes(q);
        const matchType = (v.primaryVisaType || '').toLowerCase().includes(q);
        const matchPassenger = (v.allPassengerNames || []).some((p: string) => p.toLowerCase().includes(q));
        const matchRef = (v.reference || '').toLowerCase().includes(q);

        if (!matchInvoice && !matchCustomer && !matchSupplier && !matchType && !matchPassenger && !matchRef) {
          return false;
        }
      }

      // 2. Currency
      if (currencyFilter !== 'ALL') {
        const isUSD = (v.currency || '').toUpperCase() === 'USD';
        if (currencyFilter === 'USD' && !isUSD) return false;
        if (currencyFilter === 'IQD' && isUSD) return false;
      }

      // 3. Audit Status
      if (auditFilter === 'AUDITED' && !v.isAudited) return false;
      if (auditFilter === 'UNAUDITED' && v.isAudited) return false;

      // 4. Invoice Status
      if (statusFilter !== 'ALL' && String(v.status || '').toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }

      // 5. Date From / To
      if (dateFrom && v.issueDate) {
        const vDate = new Date(v.issueDate);
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (!isNaN(vDate.getTime()) && vDate < fromDate) {
          return false;
        }
      }
      if (dateTo && v.issueDate) {
        const vDate = new Date(v.issueDate);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (!isNaN(vDate.getTime()) && vDate > toDate) {
          return false;
        }
      }

      // 6. Visa Type
      if (visaTypeFilter && v.primaryVisaType !== visaTypeFilter) {
        return false;
      }

      // 7. Supplier Filter
      if (supplierFilter && !v.supplierNameDisplay.includes(supplierFilter)) {
        return false;
      }

      // 8. Customer Filter
      if (customerFilter && !v.customerNameDisplay.includes(customerFilter)) {
        return false;
      }

      return true;
    });
  }, [
    visas,
    searchQuery,
    currencyFilter,
    auditFilter,
    statusFilter,
    dateFrom,
    dateTo,
    visaTypeFilter,
    supplierFilter,
    customerFilter,
  ]);

  // ── KPI Summary Calculations ──
  const kpis = useMemo(() => {
    let totalSellUSD = 0;
    let totalSellIQD = 0;
    let totalBuyUSD = 0;
    let totalBuyIQD = 0;
    let totalProfitUSD = 0;
    let totalProfitIQD = 0;
    let auditedCount = 0;
    let unauditedCount = 0;
    let pendingAuditCount = 0;

    filteredVisas.forEach((v) => {
      const isUSD = (v.currency || '').toUpperCase() === 'USD';
      const sell = Number(v.totalSell || 0);
      const buy = Number(v.totalBuy || 0);
      const profit = Number(v.profit !== undefined ? v.profit : (sell - buy));

      if (isUSD) {
        totalSellUSD += sell;
        totalBuyUSD += buy;
        totalProfitUSD += profit;
      } else {
        totalSellIQD += sell;
        totalBuyIQD += buy;
        totalProfitIQD += profit;
      }

      if (v.isAudited) {
        auditedCount++;
      } else if (v.status === 'DRAFT') {
        pendingAuditCount++;
      } else {
        unauditedCount++;
      }
    });

    return {
      totalSellUSD,
      totalSellIQD,
      totalBuyUSD,
      totalBuyIQD,
      totalProfitUSD,
      totalProfitIQD,
      auditedCount,
      unauditedCount,
      pendingAuditCount,
      totalCount: filteredVisas.length,
    };
  }, [filteredVisas]);

  // Detailed Passenger-Level Flattened Items
  const detailedVisaItems = useMemo(() => {
    const list: any[] = [];
    filteredVisas.forEach((v) => {
      const passengersList =
        v.passengers && Array.isArray(v.passengers) && v.passengers.length > 0
          ? v.passengers
          : [
              {
                name: v.primaryPassenger,
                passportNumber: '',
                visaType: v.primaryVisaType,
                orderNumber: v.visaOrderNumber,
                fareBuy: null,
                fareSell: null,
                status: v.statusDisplay || 'NotIssued',
                notes: '',
              },
            ];

      passengersList.forEach((p: any, pIdx: number) => {
        const passBuy = firstRealNumber(p.fareBuy, p.buyPrice);
        const passSell = firstRealNumber(p.fareSell, p.salePrice);
        const passProfit = passSell !== null && passBuy !== null ? passSell - passBuy : null;
        const passVisaType = p.visaType || v.primaryVisaType || '';
        const passOrderNumber = p.orderNumber || p.voucherNumber || v.visaOrderNumber || '';
        const passName = p.name || p.passenger || v.primaryPassenger || '';
        const passDoc = p.passportNumber || p.documentNumber || p.ticketNumber || '';
        const passStatus = p.status === 'Issued' || p.status === 'صادر' || p.status === 'CONFIRMED' ? 'Issued' : 'NotIssued';
        const isPassAudited = p.isAudited !== undefined ? Boolean(p.isAudited) : Boolean(v.isAudited);

        // Short invoice format e.g. "BR-01-VISA-2026-01011" -> "#01011"
        let shortInvoiceNumber = v.invoiceNumber || 'VISA';
        const invParts = String(v.invoiceNumber || '').split('-');
        if (invParts.length > 1) {
          shortInvoiceNumber = '#' + invParts[invParts.length - 1];
        } else if (!shortInvoiceNumber.startsWith('#')) {
          shortInvoiceNumber = '#' + shortInvoiceNumber;
        }

        const isFirstInGroup = pIdx === 0;
        const isLastInGroup = pIdx === passengersList.length - 1;
        const isSinglePassenger = passengersList.length === 1;

        list.push({
          rowId: `${v.id}-p-${pIdx}`,
          passengerId: p.id || `p-${pIdx}`,
          passengerRawIndex: pIdx,
          parentVisa: v,
          invoiceNumber: v.invoiceNumber,
          shortInvoiceNumber,
          isFirstInGroup,
          isLastInGroup,
          isSinglePassenger,
          passengerIndex: pIdx + 1,
          totalPassengersInInvoice: passengersList.length,
          passengerName: passName,
          passportNumber: passDoc,
          visaType: passVisaType,
          orderNumber: passOrderNumber,
          supplierName: p.supplierName || v.supplierNameDisplay || '',
          customerName: p.customerName || v.customerNameDisplay || '',
          buyPrice: passBuy,
          salePrice: passSell,
          profit: passProfit,
          status: passStatus,
          currency: (v.currency || '').toUpperCase(),
          dateFormatted: v.dateFormatted,
          employeeName: p.employeeName || v.employeeName,
          paymentType: v.paymentType,
          isAudited: isPassAudited,
        });
      });
    });
    return list;
  }, [filteredVisas, isAr]);

  // Total Items Count & Pagination
  const totalItemsCount = viewMode === 'aggregated' ? filteredVisas.length : detailedVisaItems.length;
  const totalPages = Math.ceil(totalItemsCount / pageSize) || 1;

  const paginatedVisas = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredVisas.slice(start, start + pageSize);
  }, [filteredVisas, currentPage, pageSize]);

  const paginatedDetailedVisas = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return detailedVisaItems.slice(start, start + pageSize);
  }, [detailedVisaItems, currentPage, pageSize]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (currencyFilter !== 'ALL') count++;
    if (auditFilter !== 'ALL') count++;
    if (statusFilter !== 'ALL') count++;
    if (searchQuery.trim()) count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    if (visaTypeFilter) count++;
    if (supplierFilter) count++;
    if (customerFilter) count++;
    return count;
  }, [
    currencyFilter,
    auditFilter,
    statusFilter,
    searchQuery,
    dateFrom,
    dateTo,
    visaTypeFilter,
    supplierFilter,
    customerFilter,
  ]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setCurrencyFilter('ALL');
    setAuditFilter('ALL');
    setStatusFilter('ALL');
    setDateFrom(null);
    setDateTo(null);
    setVisaTypeFilter('');
    setSupplierFilter('');
    setCustomerFilter('');
    setCurrentPage(1);
  };

  const financialDataReady = !loading && !loadError;

  return (
    <div
      className={`w-full max-w-[1760px] mx-auto px-6 py-5 select-none font-sans space-y-4 bg-[#F7F8FA] min-h-screen text-${direction === 'rtl' ? 'right' : 'left'}`}
      dir={direction}
      style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* ══════════════════════════════════════════════════════════════
          1. UNIFIED PAGE HEADER (86px Height)
         ══════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white rounded-[14px] border border-[#E5E7EB] px-5 py-4 min-h-[86px] shadow-2xs">
        {/* Title and Icon Container (38x38px) */}
        <div className="flex items-center gap-3.5">
          <div className="w-[38px] h-[38px] rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center font-bold shadow-2xs shrink-0">
            <FileCheck2 size={21} strokeWidth={1.85} />
          </div>
          <div>
            <h1 className="font-bold text-[20px] text-[#111827] leading-tight">
              {isAr ? 'خدمات التأشيرات' : 'Visas Management'}
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="h-[44px] px-5 rounded-[9px] bg-[#F45A0A] hover:bg-[#DD4F05] active:scale-[0.98] text-white font-semibold text-[13.5px] shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus size={17} strokeWidth={2.4} />
            <span>{isAr ? 'إصدار تأشيرة جديدة' : 'New Visa Invoice'}</span>
          </button>

          <button
            type="button"
            onClick={fetchVisas}
            disabled={loading}
            className="h-[44px] px-4 rounded-[9px] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#334155] font-semibold text-[13px] flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            title={isAr ? 'تحديث البيانات' : 'Refresh'}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-[#F45A0A]' : 'text-[#64748B]'} />
            <span className="hidden sm:inline">{isAr ? 'تحديث' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          2. FOUR FINANCIAL KPI CARDS (Height 120px, Unified Design System)
         ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Sales */}
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[120px] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-800">{isAr ? 'المبيعات' : 'Sales'}</span>
            <div className="w-[38px] h-[38px] rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center shrink-0">
              <Banknote size={20} strokeWidth={1.85} />
            </div>
          </div>
          <div>
            <div className="grid grid-cols-2 gap-2 items-baseline">
              <div className="flex items-baseline gap-1" dir="ltr">
                <span className="text-[17px] font-black font-mono text-[#111827] tabular-nums leading-tight">
                  {financialDataReady ? `$${kpis.totalSellUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </span>
              </div>
              <div className="flex items-baseline gap-1" dir="ltr">
                <span className="text-[16px] font-black font-mono text-[#111827] tabular-nums leading-tight">
                  {financialDataReady ? kpis.totalSellIQD.toLocaleString() : '—'}
                </span>
                <span className="text-[9.5px] font-mono font-bold text-slate-400">{isAr ? 'د.ع' : 'IQD'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Total Buy Cost */}
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[120px] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-800">{isAr ? 'المشتريات' : 'Cost'}</span>
            <div className="w-[38px] h-[38px] rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center shrink-0">
              <ReceiptText size={20} strokeWidth={1.85} />
            </div>
          </div>
          <div>
            <div className="grid grid-cols-2 gap-2 items-baseline">
              <div className="flex items-baseline gap-1" dir="ltr">
                <span className="text-[17px] font-black font-mono text-[#111827] tabular-nums leading-tight">
                  {financialDataReady ? `$${kpis.totalBuyUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </span>
              </div>
              <div className="flex items-baseline gap-1" dir="ltr">
                <span className="text-[16px] font-black font-mono text-[#111827] tabular-nums leading-tight">
                  {financialDataReady ? kpis.totalBuyIQD.toLocaleString() : '—'}
                </span>
                <span className="text-[9.5px] font-mono font-bold text-slate-400">{isAr ? 'د.ع' : 'IQD'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Net Profit */}
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 shadow-2xs flex flex-col justify-between h-[120px] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-800">{isAr ? 'الربح الصافي' : 'Net Profit'}</span>
            <div className="w-[38px] h-[38px] rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center shrink-0">
              <TrendingUp size={20} strokeWidth={1.85} />
            </div>
          </div>
          <div>
            <div className="grid grid-cols-2 gap-2 items-baseline">
              <div className="flex items-baseline gap-1" dir="ltr">
                <span className={`text-[17px] font-black font-mono tabular-nums leading-tight ${kpis.totalProfitUSD >= 0 ? 'text-[#078B61]' : 'text-[#DC2626]'}`}>
                  {!financialDataReady ? '—' : kpis.totalProfitUSD >= 0 ? `+$${kpis.totalProfitUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `-$${Math.abs(kpis.totalProfitUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                </span>
              </div>
              <div className="flex items-baseline gap-1" dir="ltr">
                <span className={`text-[16px] font-black font-mono tabular-nums leading-tight ${kpis.totalProfitIQD >= 0 ? 'text-[#078B61]' : 'text-[#DC2626]'}`}>
                  {!financialDataReady ? '—' : kpis.totalProfitIQD >= 0 ? `+${kpis.totalProfitIQD.toLocaleString()}` : `-${Math.abs(kpis.totalProfitIQD).toLocaleString()}`}
                </span>
                <span className="text-[9.5px] font-mono font-bold text-slate-400">{isAr ? 'د.ع' : 'IQD'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Financial Audit Status */}
        <div
          onClick={() => {
            setAuditFilter((prev) => (prev === 'ALL' ? 'UNAUDITED' : prev === 'UNAUDITED' ? 'AUDITED' : 'ALL'));
            setCurrentPage(1);
          }}
          className={`bg-white rounded-[14px] p-4 shadow-2xs transition-all cursor-pointer flex flex-col justify-between h-[120px] border ${
            auditFilter !== 'ALL' ? 'border-[#F45A0A] bg-orange-50/20' : 'border-[#E5E7EB] hover:border-slate-300'
          }`}
          title={isAr ? 'تصفية حسب حالة التدقيق' : 'Filter by audit status'}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-800">{isAr ? 'التدقيق المالي' : 'Audit'}</span>
            <div className="w-[38px] h-[38px] rounded-[10px] bg-[#FFF3E8] text-[#F45A0A] flex items-center justify-center shrink-0">
              <ShieldCheck size={20} strokeWidth={1.85} />
            </div>
          </div>
          <div>
            <div className="grid grid-cols-3 gap-1 text-center pt-1 border-t border-slate-100">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5">
                  <BadgeCheck size={11} /> {isAr ? 'مدققة' : 'Audited'}
                </span>
                <span className="font-mono font-bold text-[15px] text-emerald-800">{financialDataReady ? kpis.auditedCount : '—'}</span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] text-amber-700 font-bold flex items-center gap-0.5">
                  <Clock3 size={11} /> {isAr ? 'مراجعة' : 'Review'}
                </span>
                <span className="font-mono font-bold text-[15px] text-amber-800">{financialDataReady ? kpis.pendingAuditCount : '—'}</span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[10px] text-[#C2410C] font-bold flex items-center gap-0.5">
                  <ShieldAlert size={11} /> {isAr ? 'غير مدققة' : 'Pending'}
                </span>
                <span className="font-mono font-bold text-[15px] text-[#C2410C]">{financialDataReady ? kpis.unauditedCount : '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          3. STREAMLINED FILTERS BAR (Search + Date Range + Currency Only)
         ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-3.5 shadow-2xs">
        <div className="flex items-center justify-between gap-3.5 flex-wrap">
          {/* General Search Input */}
          <div className="relative min-w-[280px] max-w-[420px] flex-1">
            <Search size={16} className={`absolute ${direction === 'rtl' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-slate-400`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={isAr ? 'ابحث برقم المعاملة، المسافر، العميل، نوع الفيزا...' : 'Search by invoice #, passenger, customer, visa type...'}
              className={`w-full h-[44px] ${direction === 'rtl' ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'} rounded-[10px] bg-[#FAFAFA] border border-[#E5E7EB] text-[13.5px] text-[#111827] placeholder-[#9CA3AF] outline-none hover:bg-white hover:border-[#D1D5DB] focus:bg-white focus:border-2 focus:border-[#F45A0A] transition-colors`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={`absolute ${direction === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer`}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Date Range Filters (From & To) */}
          <div className="flex items-center gap-3.5 flex-wrap">
            {/* From Date */}
            <div className="flex items-center gap-2" dir="ltr">
              <span className="text-xs font-bold text-slate-600 shrink-0 select-none">{isAr ? 'من:' : 'From:'}</span>
              <div className="w-[245px]">
                <SegmentedDatePicker
                  placeholder={isAr ? 'تاريخ البداية' : 'Start date'}
                  value={dateFrom}
                  onChange={(d) => {
                    setDateFrom(d);
                    setCurrentPage(1);
                  }}
                  clearable={true}
                />
              </div>
            </div>

            {/* To Date */}
            <div className="flex items-center gap-2" dir="ltr">
              <span className="text-xs font-bold text-slate-600 shrink-0 select-none">{isAr ? 'إلى:' : 'To:'}</span>
              <div className="w-[245px]">
                <SegmentedDatePicker
                  placeholder={isAr ? 'تاريخ النهاية' : 'End date'}
                  value={dateTo}
                  onChange={(d) => {
                    setDateTo(d);
                    setCurrentPage(1);
                  }}
                  clearable={true}
                />
              </div>
            </div>
          </div>

          {/* Currency Segmented Switcher (All Currencies + IQD + USD) */}
          <div className="flex items-center gap-2">
            <CurrencySegmentedControl
              value={currencyFilter}
              onChange={(val) => {
                setCurrencyFilter(val);
                setCurrentPage(1);
              }}
              showAllOption={true}
              showLabel={false}
            />
          </div>

          {/* View Mode Switcher: تجميعي / تفصيلي */}
          <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setViewMode('aggregated');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                viewMode === 'aggregated'
                  ? 'bg-white text-[#F45A0A] shadow-xs border border-[#FFD8B2]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={14} className={viewMode === 'aggregated' ? 'text-[#F45A0A]' : 'text-slate-400'} />
              <span>{isAr ? 'تجميعي' : 'Summary'}</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${viewMode === 'aggregated' ? 'bg-[#FFF3E8] text-[#F45A0A]' : 'bg-slate-200 text-slate-600'}`}>
                {filteredVisas.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode('detailed');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                viewMode === 'detailed'
                  ? 'bg-white text-[#F45A0A] shadow-xs border border-[#FFD8B2]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutList size={14} className={viewMode === 'detailed' ? 'text-[#F45A0A]' : 'text-slate-400'} />
              <span>{isAr ? 'تفصيلي (المسافرين والأسعار)' : 'Detailed (Pax)'}</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${viewMode === 'detailed' ? 'bg-[#FFF3E8] text-[#F45A0A]' : 'bg-slate-200 text-slate-600'}`}>
                {detailedVisaItems.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          4. MODERN DATA TABLE CARD (Aggregated vs Detailed Views)
         ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-${direction === 'rtl' ? 'right' : 'left'} border-collapse text-[13px] whitespace-nowrap`}>
            {/* Table Header (48px) */}
            <thead>
              {viewMode === 'aggregated' ? (
                <tr className="h-[48px] bg-[#F8FAFC] border-b border-[#E5E7EB] text-[#475569] font-bold text-[12.5px] whitespace-nowrap">
                  <th className="px-3.5 py-2 whitespace-nowrap text-center w-12">#</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">{isAr ? 'رقم المعاملة' : 'Invoice #'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">{isAr ? 'نوع التأشيرة / الوجهة' : 'Visa Type / Destination'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap text-center">{isAr ? 'المسافرون' : 'Passengers'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">{isAr ? 'المزود / المورد' : 'Supplier'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap text-center">{isAr ? 'التكلفة (شراء)' : 'Buy Cost'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">{isAr ? 'العميل / الحساب' : 'Customer'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap text-center">{isAr ? 'سعر البيع' : 'Sell Price'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap text-center">{isAr ? 'صافي الربح' : 'Profit'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap text-center">{isAr ? 'طريقة السداد' : 'Payment'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap">{isAr ? 'التاريخ والموظف' : 'Date & Staff'}</th>
                  <th className="px-3.5 py-2 whitespace-nowrap text-center">{isAr ? 'التدقيق' : 'Audit'}</th>
                  <th className="px-2.5 py-2 whitespace-nowrap text-center w-12">{isAr ? 'دخول' : 'Open'}</th>
                </tr>
              ) : (
                <tr className="h-[48px] bg-[#F8FAFC] border-b border-[#E5E7EB] text-[#475569] font-bold text-[12.5px] whitespace-nowrap">
                  <th className="px-2.5 py-2 whitespace-nowrap text-center w-10">#</th>
                  <th className="px-3 py-2 whitespace-nowrap min-w-[125px]">{isAr ? 'رقم المعاملة' : 'Invoice #'}</th>
                  <th className="px-2.5 py-2 w-[130px] whitespace-nowrap">{isAr ? 'اسم المسافر' : 'Passenger Name'}</th>
                  <th className="px-2.5 py-2 min-w-[105px] text-center whitespace-nowrap">{isAr ? 'رقم الجواز' : 'Passport #'}</th>
                  <th className="px-3 py-2 min-w-[130px] whitespace-nowrap">{isAr ? 'نوع التأشيرة' : 'Visa Type'}</th>
                  <th className="px-3 py-2 whitespace-nowrap">{isAr ? 'المورد (قطعت من)' : 'Supplier'}</th>
                  <th className="px-3 py-2 text-center text-rose-700 font-bold whitespace-nowrap">{isAr ? 'سعر الشراء' : 'Buy Price'}</th>
                  <th className="px-3 py-2 whitespace-nowrap">{isAr ? 'العميل (قطعت إلى)' : 'Customer'}</th>
                  <th className="px-3 py-2 text-center text-emerald-700 font-bold whitespace-nowrap">{isAr ? 'سعر البيع' : 'Sale Price'}</th>
                  <th className="px-3 py-2 text-center font-bold whitespace-nowrap">{isAr ? 'الربح' : 'Profit'}</th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">{isAr ? 'حالة التأشيرة' : 'Status'}</th>
                  <th className="px-3 py-2 whitespace-nowrap">{isAr ? 'التاريخ والموظف' : 'Date & Staff'}</th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">{isAr ? 'التدقيق' : 'Audit'}</th>
                  <th className="px-2.5 py-2 text-center w-12 whitespace-nowrap">{isAr ? 'دخول' : 'Open'}</th>
                </tr>
              )}
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-[#F1F5F9]">
              {viewMode === 'aggregated' ? (
                paginatedVisas.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-14 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        {loading ? (
                          <>
                            <div className="w-12 h-12 rounded-full bg-orange-50 text-[#F45A0A] flex items-center justify-center">
                              <RefreshCw size={22} className="animate-spin" />
                            </div>
                            <div className="font-bold text-slate-800 text-sm">
                              {isAr ? 'جارٍ جلب بيانات الفيزا الحقيقية...' : 'Loading real visa data...'}
                            </div>
                          </>
                        ) : loadError ? (
                          <>
                            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                              <ServerOff size={23} />
                            </div>
                            <div className="font-bold text-red-700 text-sm">
                              {isAr ? 'تعذر الاتصال بالبيانات' : 'Could not connect to data service'}
                            </div>
                            <div className="text-xs text-slate-500 max-w-lg whitespace-normal">{loadError}</div>
                            <Button size="xs" color="red" variant="light" radius="md" leftSection={<RefreshCw size={14} />} onClick={fetchVisas}>
                              {isAr ? 'إعادة المحاولة' : 'Retry'}
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-full bg-orange-50 text-[#F45A0A] flex items-center justify-center">
                              <FileCheck2 size={24} />
                            </div>
                            <div className="font-bold text-slate-800 text-sm">
                              {isAr ? 'لا توجد معاملات تأشيرات مطابقة' : 'No visa records found'}
                            </div>
                            <Button
                              size="xs"
                              color="orange"
                              radius="md"
                              leftSection={<Plus size={14} />}
                              onClick={handleOpenCreateModal}
                              className="bg-[#F45A0A] hover:bg-orange-600 mt-1 cursor-pointer font-semibold"
                            >
                              {isAr ? 'إصدار تأشيرة جديدة' : 'New Visa Invoice'}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedVisas.map((vRow, idx) => {
                    const isUSD = (vRow.currency || '').toUpperCase() === 'USD';
                    const profitValue = toNullableNumber(vRow.profit);
                    const isProfitPositive = profitValue !== null && profitValue > 0;
                    const isProfitNegative = profitValue !== null && profitValue < 0;

                    return (
                      <tr
                        key={vRow.id || idx}
                        className="h-[64px] hover:bg-[#FFFDFC] transition-colors group cursor-pointer select-none"
                        onClick={() => handleOpenEditModal(vRow)}
                        onContextMenu={(e) => handleVisaContextMenu(e, vRow)}
                      >
                        {/* Index */}
                        <td className="px-3.5 py-3 text-center text-slate-400 text-xs font-mono">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </td>

                        {/* Invoice Number */}
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 text-[13px] group-hover:text-[#F45A0A] transition-colors">
                              {vRow.invoiceNumber || displayMissing(isAr)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyInvoiceNumber(vRow.invoiceNumber);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition-opacity p-0.5 cursor-pointer"
                              title={isAr ? 'نسخ رقم الفاتورة' : 'Copy invoice #'}
                            >
                              {copiedInvoiceNumber === vRow.invoiceNumber ? (
                                <Check size={13} className="text-emerald-600" />
                              ) : (
                                <Copy size={13} />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Visa Type / Country Flag */}
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <CountryFlagImage
                              name={vRow.primaryVisaType || vRow.airline || ''}
                              size="md"
                              className="w-[32px] h-[32px] rounded-[8px] object-cover shrink-0 border border-slate-200 shadow-2xs"
                            />
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-xs truncate max-w-[150px]">
                                {vRow.primaryVisaType || displayMissing(isAr)}
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono mt-0.5">
                                <span>{vRow.visaOrderNumber ? `#${vRow.visaOrderNumber}` : displayMissing(isAr)}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Passengers & Passports Popover */}
                        <td className="px-3.5 py-3 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                          <Popover position="top" withArrow shadow="md" radius="md">
                            <Popover.Target>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-orange-50/70 border border-slate-200 hover:border-[#F45A0A] text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                              >
                                <UsersRound size={14} className="text-slate-400" />
                                <span>
                                  {vRow.passCount} {isAr ? 'مسافر' : 'pax'}
                                </span>
                              </button>
                            </Popover.Target>
                            <Popover.Dropdown className="p-2.5 space-y-2 min-w-[280px] max-w-[340px] font-sans" dir={direction}>
                              <div className="font-bold text-[11.5px] text-slate-600 border-b border-slate-100 pb-1.5 flex items-center justify-between">
                                <span>{isAr ? 'قائمة المسافرين والجوازات:' : 'Travelers & Passports:'}</span>
                                <span className="text-[10.5px] bg-orange-50 text-[#F45A0A] border border-orange-200 px-1.5 py-0.5 rounded font-mono font-bold">
                                  {vRow.passCount} {isAr ? 'مسافر' : 'pax'}
                                </span>
                              </div>
                              <div className="space-y-1.5 max-h-[290px] overflow-y-auto pr-0.5">
                                {(vRow.passengers && vRow.passengers.length > 0
                                  ? vRow.passengers
                                  : [{ name: vRow.primaryPassenger, documentNumber: '' }]
                                ).map((p: any, pIdx: number) => {
                                  const pName = p.name || p.passenger || vRow.primaryPassenger || displayMissing(isAr);
                                  const pDoc = p.documentNumber || p.passportNumber || p.ticketNumber || '';
                                  return (
                                    <div
                                      key={pIdx}
                                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-orange-50/70 border border-slate-200/70 hover:border-orange-200 transition-all text-xs"
                                    >
                                      <div className="w-5 h-5 rounded-full bg-white border border-slate-200 text-[#F45A0A] font-mono font-bold text-[10.5px] flex items-center justify-center shrink-0 shadow-2xs">
                                        {pIdx + 1}
                                      </div>
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-1.5">
                                          <span className="font-bold text-slate-900 truncate text-[12px]">{pName}</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              navigator.clipboard.writeText(pName);
                                              showSuccessNotification(
                                                isAr ? 'تم النسخ' : 'Copied',
                                                isAr ? `تم نسخ اسم المسافر: ${pName}` : `Copied traveler: ${pName}`
                                              );
                                            }}
                                            className="p-1 rounded text-slate-400 hover:text-[#F45A0A] hover:bg-white transition-colors cursor-pointer shrink-0"
                                            title={isAr ? 'نسخ الاسم' : 'Copy Name'}
                                          >
                                            <Copy size={12} />
                                          </button>
                                        </div>
                                        {pDoc ? (
                                          <div className="flex items-center justify-between gap-1.5 mt-0.5">
                                            <div className="flex items-center gap-1">
                                              <span className="text-[10.5px] font-semibold text-slate-400">{isAr ? 'الجواز:' : 'Passport:'}</span>
                                              <span className="font-mono text-[11px] font-bold text-slate-800 tracking-wider">#{pDoc}</span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                navigator.clipboard.writeText(pDoc);
                                                showSuccessNotification(
                                                  isAr ? 'تم النسخ' : 'Copied',
                                                  isAr ? `تم نسخ رقم الجواز: ${pDoc}` : `Copied passport: ${pDoc}`
                                                );
                                              }}
                                              className="p-1 rounded text-slate-400 hover:text-[#F45A0A] hover:bg-white transition-colors cursor-pointer shrink-0"
                                              title={isAr ? 'نسخ رقم الجواز' : 'Copy Passport #'}
                                            >
                                              <Copy size={12} />
                                            </button>
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </Popover.Dropdown>
                          </Popover>
                        </td>

                        {/* Supplier */}
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <span className="text-slate-700 font-bold text-xs truncate max-w-[140px] block">
                            {vRow.supplierNameDisplay || displayMissing(isAr)}
                          </span>
                        </td>

                        {/* Buy Cost */}
                        <td className="px-3.5 py-3 whitespace-nowrap font-black tabular-nums text-slate-800 text-[13.5px] text-center">
                          {formatNullableMoney(vRow.totalBuy, isUSD ? 'USD' : 'IQD', isAr)}
                        </td>

                        {/* Customer */}
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <span className="text-slate-800 font-bold text-xs truncate max-w-[140px] block">
                            {vRow.customerNameDisplay || displayMissing(isAr)}
                          </span>
                        </td>

                        {/* Sell Total */}
                        <td className="px-3.5 py-3 whitespace-nowrap font-black tabular-nums text-slate-900 text-[13.5px] text-center">
                          {formatNullableMoney(vRow.totalSell, isUSD ? 'USD' : 'IQD', isAr)}
                        </td>

                        {/* Profit */}
                        <td className="px-3.5 py-3 whitespace-nowrap font-black tabular-nums text-[13.5px] text-center">
                          <span
                            className={`inline-flex items-center gap-1 ${
                              isProfitPositive
                                ? 'text-[#078B61]'
                                : isProfitNegative
                                ? 'text-[#DC2626]'
                                : 'text-slate-800'
                            }`}
                          >
                            {isProfitPositive ? '+' : ''}
                            {formatNullableMoney(vRow.profit, isUSD ? 'USD' : 'IQD', isAr)}
                          </span>
                        </td>

                        {/* Payment */}
                        <td className="px-3.5 py-3 whitespace-nowrap text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {!vRow.paymentType
                              ? displayMissing(isAr)
                              : vRow.paymentType === 'CREDIT' || vRow.paymentType === 'آجل'
                              ? (isAr ? 'آجل' : 'Credit')
                              : vRow.paymentType === 'DEBIT' || vRow.paymentType === 'CASH' || vRow.paymentType === 'نقدي'
                              ? (isAr ? 'نقدي' : 'Cash')
                              : vRow.paymentType}
                          </span>
                        </td>

                        {/* Date & Staff */}
                        <td className="px-3.5 py-3 whitespace-nowrap text-xs text-slate-500">
                          <div className="font-mono font-bold text-slate-900 text-[12.5px]" dir="ltr">{vRow.dateFormatted}</div>
                          <div className="text-[11px] text-slate-400 font-medium truncate max-w-[100px] mt-0.5">
                            {vRow.employeeName || displayMissing(isAr)}
                          </div>
                        </td>

                        {/* Audit Status (Master: Fully Audited / Partial / Pending) */}
                        <td className="px-3.5 py-3 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const pList = vRow.passengers && Array.isArray(vRow.passengers) && vRow.passengers.length > 0
                              ? vRow.passengers
                              : [{ isAudited: vRow.isAudited }];
                            const tot = pList.length;
                            const aud = pList.filter((p: any) => p.isAudited !== undefined ? Boolean(p.isAudited) : Boolean(vRow.isAudited)).length;
                            const unAud = tot - aud;

                            if (aud === tot && tot > 0) {
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleAudit(vRow, e)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                                  title={isAr ? 'مدققة بالكامل — اضغط لإلغاء التدقيق' : 'Fully audited — click to un-audit'}
                                >
                                  <BadgeCheck size={13} className="text-emerald-600" />
                                  <span>{isAr ? 'مدققة' : 'Audited'}</span>
                                </button>
                              );
                            }

                            if (aud > 0 && aud < tot) {
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleAudit(vRow, e)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                                  title={isAr ? `تم تدقيق ${aud} من أصل ${tot} مسافرين. اضغط لتدقيق الكل.` : `${aud} of ${tot} passengers audited. Click to audit all.`}
                                >
                                  <ShieldAlert size={13} className="text-amber-600" />
                                  <span>{isAr ? (unAud === 1 ? 'مدققة ما عدا 1' : `مدققة (${aud}/${tot})`) : `Audited (${aud}/${tot})`}</span>
                                </button>
                              );
                            }

                            return (
                              <button
                                type="button"
                                onClick={(e) => handleToggleAudit(vRow, e)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border bg-orange-50 text-[#C2410C] border-orange-200 hover:bg-orange-100 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                                title={isAr ? 'غير مدققة — اضغط لتدقيق كافة المسافرين' : 'Pending — click to audit all'}
                              >
                                <ShieldAlert size={13} className="text-orange-500" />
                                <span>{isAr ? 'غير مدققة' : 'Pending'}</span>
                              </button>
                            );
                          })()}
                        </td>

                        {/* Direct Open Visa Button */}
                        <td className="px-2.5 py-3 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(vRow)}
                            disabled={openingVisaId === vRow.id}
                            className="w-8 h-8 rounded-lg bg-orange-50 hover:bg-[#F45A0A] text-[#F45A0A] hover:text-white border border-orange-200 transition-all flex items-center justify-center cursor-pointer shadow-2xs group/btn mx-auto"
                            title={isAr ? 'دخول وتعديل الفيزا' : 'Open Visa'}
                          >
                            {openingVisaId === vRow.id ? (
                              <RefreshCw size={15} className="animate-spin" />
                            ) : direction === 'rtl' ? (
                              <ArrowLeft size={16} className="group-hover/btn:-translate-x-0.5 transition-transform" />
                            ) : (
                              <ArrowRight size={16} className="group-hover/btn:translate-x-0.5 transition-transform" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : (
                /* ══════════════════════════════════════════════════════════
                   DETAILED VIEW: 1 Row Per Individual Passenger Breakdown
                   ══════════════════════════════════════════════════════════ */
                paginatedDetailedVisas.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-14 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        {loading ? (
                          <>
                            <div className="w-12 h-12 rounded-full bg-orange-50 text-[#F45A0A] flex items-center justify-center">
                              <RefreshCw size={22} className="animate-spin" />
                            </div>
                            <div className="font-bold text-slate-800 text-sm">
                              {isAr ? 'جارٍ جلب سجلات المسافرين...' : 'Loading passenger records...'}
                            </div>
                          </>
                        ) : loadError ? (
                          <>
                            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                              <ServerOff size={23} />
                            </div>
                            <div className="font-bold text-red-700 text-sm">
                              {isAr ? 'تعذر الاتصال بالبيانات' : 'Could not connect to data service'}
                            </div>
                            <Button size="xs" color="red" variant="light" radius="md" leftSection={<RefreshCw size={14} />} onClick={fetchVisas}>
                              {isAr ? 'إعادة المحاولة' : 'Retry'}
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-full bg-orange-50 text-[#F45A0A] flex items-center justify-center">
                              <FileCheck2 size={24} />
                            </div>
                            <div className="font-bold text-slate-800 text-sm">
                              {isAr ? 'لا توجد سجلات مسافرين مطابقة' : 'No passenger records found'}
                            </div>
                            <div className="text-xs text-slate-400 max-w-sm">
                              {isAr ? 'جرّب تعديل خيارات البحث أو قم بإصدار معاملة تأشيرة جديدة.' : 'Try adjusting your search filters or create a new visa transaction.'}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedDetailedVisas.map((dRow, idx) => {
                    const isUSD = dRow.currency === 'USD';
                    const detailProfitValue = toNullableNumber(dRow.profit);
                    const isProfitPos = detailProfitValue !== null && detailProfitValue > 0;
                    const isProfitNeg = detailProfitValue !== null && detailProfitValue < 0;

                    return (
                      <tr
                        key={dRow.rowId || idx}
                        className={`h-[56px] transition-colors group cursor-pointer whitespace-nowrap ${
                          dRow.totalPassengersInInvoice > 1
                            ? direction === 'rtl'
                              ? 'border-r-[3.5px] border-r-orange-400 bg-orange-50/15 hover:bg-orange-100/35'
                              : 'border-l-[3.5px] border-l-orange-400 bg-orange-50/15 hover:bg-orange-100/35'
                            : 'hover:bg-orange-50/30'
                        } ${dRow.isLastInGroup && dRow.totalPassengersInInvoice > 1 ? 'border-b-2 border-slate-200' : ''}`}
                        onClick={() => handleOpenEditModal(dRow.parentVisa)}
                      >
                        {/* Index */}
                        <td className="px-2.5 py-2 text-center text-slate-400 text-xs font-mono font-bold whitespace-nowrap">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </td>

                        {/* Invoice Number + Professional Connected Tree Hierarchy */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {dRow.totalPassengersInInvoice > 1 ? (
                              <div className="flex items-center gap-2">
                                {/* Continuous Connected Tree Spine */}
                                <div className="relative w-5 h-10 flex items-center justify-center shrink-0">
                                  {/* Continuous Vertical Trunk across cell boundaries */}
                                  <div
                                    className={`absolute w-[2px] bg-orange-400 ${
                                      dRow.isFirstInGroup
                                        ? 'top-1/2 -bottom-2 rounded-t-full'
                                        : dRow.isLastInGroup
                                        ? '-top-2 bottom-1/2 rounded-b-full'
                                        : '-top-2 -bottom-2'
                                    } ${direction === 'rtl' ? 'right-2' : 'left-2'}`}
                                  />
                                  {/* Horizontal Branch Connector Arm */}
                                  <div
                                    className={`absolute top-1/2 h-[2px] bg-orange-400 w-2.5 ${
                                      direction === 'rtl' ? 'right-2' : 'left-2'
                                    } -translate-y-1/2`}
                                  />
                                  {/* Tree Joint Node */}
                                  <div
                                    className={`relative z-10 w-2.5 h-2.5 rounded-full border-2 border-white shadow-2xs ${
                                      dRow.isFirstInGroup
                                        ? 'bg-[#F45A0A] ring-2 ring-orange-200'
                                        : dRow.isLastInGroup
                                        ? 'bg-[#EA580C]'
                                        : 'bg-orange-400'
                                    }`}
                                  />
                                </div>

                                {/* Master Transaction Header vs Linked Child Passenger */}
                                {dRow.isFirstInGroup ? (
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-[#FFF3E8] border border-orange-300 text-[#F45A0A] shadow-2xs group-hover:border-[#F45A0A] transition-colors"
                                      title={`${isAr ? 'فاتورة مجمعة رئيسية: ' : 'Master Group Invoice: '}${dRow.invoiceNumber}`}
                                    >
                                      {dRow.shortInvoiceNumber}
                                    </span>
                                    <span
                                      className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-200"
                                      title={isAr ? `المسافر 1 من أصل ${dRow.totalPassengersInInvoice}` : `1 of ${dRow.totalPassengersInInvoice}`}
                                    >
                                      1/{dRow.totalPassengersInInvoice}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10.5px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 group-hover:bg-[#FFF3E8] group-hover:text-[#F45A0A] group-hover:border-orange-200 transition-colors">
                                      {dRow.passengerIndex}/{dRow.totalPassengersInInvoice}
                                    </span>
                                    <span
                                      className="text-[10px] font-mono font-bold text-slate-400 group-hover:text-slate-600 tracking-tight"
                                      title={dRow.invoiceNumber}
                                    >
                                      ↳ {dRow.shortInvoiceNumber}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-slate-300 mx-0.5 shrink-0" />
                                <span
                                  className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 group-hover:border-orange-300 group-hover:text-[#F45A0A] transition-colors"
                                  title={`${isAr ? 'رقم الفاتورة: ' : 'Invoice #: '}${dRow.invoiceNumber}`}
                                >
                                  {dRow.shortInvoiceNumber}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Passenger Name (Compact Width with 1-Click Copy) */}
                        <td className="px-2.5 py-2 whitespace-nowrap">
                          <div className="flex items-center justify-between gap-1 w-[130px] max-w-[130px]">
                            <span className="font-bold text-slate-950 text-xs truncate" title={dRow.passengerName}>
                              {dRow.passengerName || displayMissing(isAr)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(dRow.passengerName);
                                showSuccessNotification(isAr ? 'تم النسخ' : 'Copied', dRow.passengerName);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-[#F45A0A] hover:bg-orange-50 transition-colors cursor-pointer shrink-0"
                              title={isAr ? 'نسخ الاسم' : 'Copy'}
                            >
                              <Copy size={11} />
                            </button>
                          </div>
                        </td>

                        {/* Passport Number */}
                        <td className="px-2.5 py-2 text-center whitespace-nowrap">
                          {dRow.passportNumber ? (
                            <div className="inline-flex items-center gap-1">
                              <span className="font-mono font-black text-xs text-[#F45A0A] tracking-wider">
                                #{dRow.passportNumber}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(dRow.passportNumber);
                                  showSuccessNotification(isAr ? 'تم النسخ' : 'Copied', dRow.passportNumber);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-[#F45A0A] transition-opacity cursor-pointer shrink-0"
                                title={isAr ? 'نسخ الجواز' : 'Copy'}
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono text-xs">—</span>
                          )}
                        </td>

                        {/* Visa Type & Flag */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <CountryFlagImage
                              name={dRow.visaType || ''}
                              size="sm"
                              className="w-6 h-6 rounded-md object-cover shrink-0 border border-slate-200"
                            />
                            <div className="min-w-0">
                              <span className="font-extrabold text-slate-900 text-xs truncate max-w-[120px] block">
                                {dRow.visaType || displayMissing(isAr)}
                              </span>
                              {dRow.orderNumber && (
                                <span className="font-mono text-[10.5px] text-slate-500 block">
                                  #{dRow.orderNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Supplier */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-slate-700 font-bold text-xs truncate max-w-[120px] block">
                            {dRow.supplierName || displayMissing(isAr)}
                          </span>
                        </td>

                        {/* Individual Buy Price */}
                        <td className="px-3 py-2 whitespace-nowrap font-black font-mono tabular-nums text-rose-700 text-xs text-center">
                          {formatNullableMoney(dRow.buyPrice, isUSD ? 'USD' : 'IQD', isAr)}
                        </td>

                        {/* Customer */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-slate-800 font-bold text-xs truncate max-w-[120px] block">
                            {dRow.customerName || displayMissing(isAr)}
                          </span>
                        </td>

                        {/* Individual Sale Price */}
                        <td className="px-3 py-2 whitespace-nowrap font-black font-mono tabular-nums text-emerald-700 text-xs text-center">
                          {formatNullableMoney(dRow.salePrice, isUSD ? 'USD' : 'IQD', isAr)}
                        </td>

                        {/* Individual Net Profit */}
                        <td className="px-3 py-2 whitespace-nowrap font-black font-mono tabular-nums text-xs text-center">
                          <span
                            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md ${
                              isProfitPos
                                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/80'
                                : isProfitNeg
                                ? 'text-rose-700 bg-rose-50 border border-rose-200/80'
                                : 'text-slate-700 bg-slate-50 border border-slate-200/80'
                            }`}
                          >
                            {isProfitPos ? '+' : ''}
                            {formatNullableMoney(dRow.profit, isUSD ? 'USD' : 'IQD', isAr)}
                          </span>
                        </td>

                        {/* Individual Visa Status (Interactive Toggle: صادر / غير صادر) */}
                        <td className="px-3 py-2 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handleTogglePassengerStatus(dRow, e)}
                            className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black border transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95 ${
                              dRow.status === 'Issued'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-[#FFF3E8] text-[#F45A0A] border-[#FFD8B2] hover:bg-orange-100'
                            }`}
                            title={isAr ? 'اضغط لتغيير الحالة (صادر / غير صادر)' : 'Click to toggle status (Issued / Not Issued)'}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${dRow.status === 'Issued' ? 'bg-emerald-600' : 'bg-[#F45A0A]'}`} />
                            <span>{dRow.status === 'Issued' ? (isAr ? 'صادر' : 'Issued') : (isAr ? 'غير صادر' : 'Not Issued')}</span>
                          </button>
                        </td>

                        {/* Date & Staff */}
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500">
                          <div className="font-mono font-bold text-slate-900 text-xs" dir="ltr">{dRow.dateFormatted}</div>
                          <div className="text-[10.5px] text-slate-400 font-medium truncate max-w-[85px] mt-0.5">
                            {dRow.employeeName || displayMissing(isAr)}
                          </div>
                        </td>

                        {/* Individual Passenger Audit (Interactive per person) */}
                        <td className="px-3 py-2 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handleTogglePassengerAudit(dRow, e)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95 ${
                              dRow.isAudited
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-orange-50 text-[#C2410C] border-orange-200 hover:bg-orange-100'
                            }`}
                            title={isAr ? (dRow.isAudited ? 'مدققة — اضغط لإلغاء التدقيق عن هذا المسافر' : 'غير مدققة — اضغط لتدقيق هذا المسافر') : 'Click to toggle audit for this passenger'}
                          >
                            {dRow.isAudited ? (
                              <>
                                <BadgeCheck size={13} className="text-emerald-600" />
                                <span>{isAr ? 'مدققة' : 'Audited'}</span>
                              </>
                            ) : (
                              <>
                                <ShieldAlert size={13} className="text-orange-500" />
                                <span>{isAr ? 'غير مدققة' : 'Pending'}</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Direct Open Visa Button */}
                        <td className="px-2.5 py-2 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(dRow.parentVisa)}
                            className="w-8 h-8 rounded-lg bg-orange-50 hover:bg-[#F45A0A] text-[#F45A0A] hover:text-white border border-orange-200 transition-all flex items-center justify-center cursor-pointer shadow-2xs group/btn mx-auto"
                            title={isAr ? 'دخول وتعديل الفيزا' : 'Open Visa'}
                          >
                            {direction === 'rtl' ? (
                              <ArrowLeft size={16} className="group-hover/btn:-translate-x-0.5 transition-transform" />
                            ) : (
                              <ArrowRight size={16} className="group-hover/btn:translate-x-0.5 transition-transform" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer: Summary Stats & Pagination */}
        <div className="h-[56px] px-5 bg-[#F8FAFC] border-t border-[#E5E7EB] flex items-center justify-between flex-wrap gap-3 text-xs text-slate-600 font-sans">
          {/* Leading: Page size & Range */}
          <div className="flex items-center gap-3">
            <span className="text-slate-500 font-medium">
              {isAr ? 'عرض' : 'Show'}
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-8 px-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800 outline-none cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-slate-500 font-medium">
              {!financialDataReady
                ? (isAr ? 'جارٍ جلب السجلات...' : 'Loading records...')
                : isAr
                ? `من إجمالي ${viewMode === 'aggregated' ? filteredVisas.length : detailedVisaItems.length} ${viewMode === 'aggregated' ? 'معاملة' : 'مسافر ومعاملة'}`
                : `of ${viewMode === 'aggregated' ? filteredVisas.length : detailedVisaItems.length} records`}
            </span>
          </div>

          {/* Trailing: Page Navigation */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center gap-1 cursor-pointer transition-colors"
            >
              {direction === 'rtl' ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
              <span>{isAr ? 'السابق' : 'Prev'}</span>
            </button>

            <span className="px-3 py-1 text-slate-700 font-mono font-bold text-xs bg-slate-100 rounded-md">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>{isAr ? 'التالي' : 'Next'}</span>
              {direction === 'rtl' ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          5. DEDICATED FULL-SCREEN VISA WORKSPACE & AUDIT LOG
         ══════════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <React.Suspense
          fallback={(
            <div className="fixed inset-0 z-[9998] bg-white/95 backdrop-blur-sm flex items-center justify-center">
              <div className="flex items-center gap-3 text-sm font-bold text-slate-700">
                <RefreshCw size={20} className="animate-spin text-[#F45A0A]" />
                <span>{isAr ? 'جارٍ فتح مساحة معاملة الفيزا...' : 'Opening visa workspace...'}</span>
              </div>
            </div>
          )}
        >
          <VisaInvoiceEditorWorkspace
            opened={modalOpen}
            onClose={() => {
              setModalOpen(false);
              setSelectedVisa(null);
            }}
            initialData={selectedVisa}
            onSuccess={handleVisaSaved}
          />
        </React.Suspense>
      )}

      {/* Context Menu Backdrop & Floating Panel */}
      {contextMenu && (
        <>
          {/* Full-screen invisible backdrop to capture outside clicks / right clicks */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />

          {/* Floating Context Menu */}
          <div
            style={{
              position: 'fixed',
              zIndex: 99999,
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
            }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl py-1.5 min-w-[230px] text-xs font-medium divide-y divide-slate-100 select-none animate-in fade-in zoom-in-95 duration-100"
            dir={direction}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Header Info */}
            <div className="px-3.5 py-2 flex items-center justify-between text-slate-400 font-mono text-[11px]">
              <span className="font-bold text-slate-800 font-sans truncate max-w-[130px]">
                {contextMenu.visa.customerNameDisplay || contextMenu.visa.customerName || contextMenu.visa.invoiceNumber}
              </span>
              <span className="font-bold text-[#F45A0A] font-sans truncate max-w-[80px]">
                {contextMenu.visa.primaryVisaType || contextMenu.visa.visaType || ''}
              </span>
            </div>

            {/* Primary Actions */}
            <div className="py-1">
              {/* Full Refund */}
              <button
                type="button"
                onClick={() => {
                  const vItem = contextMenu.visa;
                  if (vItem.status === 'REFUNDED' || vItem.statusDisplay === 'REFUNDED' || vItem.refundStatus === 'FULL') {
                    showInfoNotification(
                      isAr ? 'الفيزا مسترجعة بالكامل' : 'Already Refunded',
                      isAr ? 'تم استرجاع هذه الفيزا بالكامل مسبقاً.' : 'This visa invoice has already been fully refunded.'
                    );
                    setContextMenu(null);
                    return;
                  }

                  const allPax = vItem.detailedPassengers || vItem.passengers || vItem.rawInvoice?.passengers || [];
                  const unrefundedPax = allPax.filter((p: any) => !p.isRefunded && p.status !== 'REFUNDED' && p.status !== 'مسترجع');
                  const finalPaxToRefund = unrefundedPax.length > 0 ? unrefundedPax : allPax;

                  const targetVisa = {
                    ...(vItem.rawInvoice || vItem),
                    id: undefined,
                    invoiceNumber: undefined,
                    originalInvoiceNumber: vItem.invoiceNumber,
                    reference: vItem.invoiceNumber,
                    customerName: vItem.customerNameDisplay || vItem.customerName,
                    supplierAccount: vItem.supplierAccount || vItem.rawInvoice?.supplierAccount,
                    supplierAccountName: vItem.supplierNameDisplay || vItem.supplierAccountName,
                    primaryVisaType: vItem.primaryVisaType || vItem.visaType,
                    visaOrderNumber: vItem.visaOrderNumber || vItem.orderNumber,
                    currency: vItem.currency,
                    detailedPassengers: finalPaxToRefund,
                    passengers: finalPaxToRefund.map((p: any) => ({
                      name: p.name || p.displayName || '',
                      passportNumber: p.passportNumber || p.documentNumber || '',
                      visaType: p.visaType || vItem.primaryVisaType || '',
                      orderNumber: p.orderNumber || vItem.visaOrderNumber || '',
                      fareBuy: Math.abs(p.fareBuy || p.buyPrice || 0),
                      fareSell: Math.abs(p.fareSell || p.salePrice || 0),
                      tax1: p.tax1 || 0,
                      charge: p.charge || 0,
                      isRefunded: false,
                      status: 'Active',
                    })),
                  };

                  setVisaForRefund(targetVisa);
                  setRefundWorkspaceOpen(true);
                  setContextMenu(null);
                }}
                className="w-full px-3.5 py-2 text-slate-700 hover:bg-amber-50 hover:text-amber-800 flex items-center gap-2.5 transition-colors cursor-pointer text-start font-medium"
              >
                <RotateCcw size={15} className="text-amber-600" />
                <span>{isAr ? 'عمل استرجاع' : 'Refund Visa'}</span>
              </button>

              {(contextMenu.visa.transferImage || contextMenu.visa.rawInvoice?.transferImage) && (
              <button
                type="button"
                onClick={() => {
                  const transferImg = contextMenu.visa.transferImage || contextMenu.visa.rawInvoice?.transferImage;
                  setSelectedReceiptVisa({
                    ...contextMenu.visa,
                    transferImage: transferImg,
                  });
                  setReceiptModalOpen(true);
                  setContextMenu(null);
                }}
                className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer text-start"
              >
                <ImageIcon size={15} className="text-emerald-600" />
                <span className="flex-1">{isAr ? 'عرض إيصال التحويل' : 'View Transfer Receipt'}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </button>
              )}

              {/* Audit History */}
              <button
                type="button"
                onClick={() => {
                  setAuditLogVisa(contextMenu.visa.rawInvoice || contextMenu.visa);
                  setAuditLogOpen(true);
                  setContextMenu(null);
                }}
                className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer text-start"
              >
                <History size={15} className="text-slate-500" />
                <span>{isAr ? 'سجل التدقيق والتعديلات' : 'Audit History'}</span>
              </button>

              {/* Copy Invoice Number */}
              <button
                type="button"
                onClick={() => {
                  handleCopyInvoiceNumber(contextMenu.visa.invoiceNumber);
                  setContextMenu(null);
                }}
                className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer text-start font-mono"
              >
                <Copy size={15} className="text-slate-500" />
                <span>{isAr ? 'نسخ رقم الفاتورة' : 'Copy Invoice No'}</span>
              </button>
            </div>

            {/* Destructive Action */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  handleRequestDelete(contextMenu.visa.rawInvoice || contextMenu.visa);
                  setContextMenu(null);
                }}
                className="w-full px-3.5 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors cursor-pointer text-start font-bold"
              >
                <Trash2 size={15} className="text-red-500" />
                <span>{isAr ? 'حذف الفيزا' : 'Delete Visa'}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Payment Receipt Modal */}
      <Modal
        opened={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <ImageIcon size={18} className="text-[#F45A0A]" />
            <span>{isAr ? 'إيصال التحويل المالي' : 'Payment Transfer Receipt'}</span>
          </div>
        }
        size="md"
        centered
        radius="lg"
        dir={direction}
      >
        {selectedReceiptVisa && (
          <div className={`flex flex-col items-center gap-3 p-1 text-${direction === 'rtl' ? 'right' : 'left'}`}>
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10.5px]">{isAr ? 'رقم الفاتورة:' : 'Invoice No:'}</span>
                <span className="text-slate-900 font-bold font-mono">{selectedReceiptVisa.invoiceNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10.5px]">{isAr ? 'العميل:' : 'Customer:'}</span>
                <span className="text-slate-900 font-bold truncate block">
                  {selectedReceiptVisa.customerNameDisplay || selectedReceiptVisa.customerName || '-'}
                </span>
              </div>
            </div>

            {selectedReceiptVisa.transferImage ? (
              <div className="relative flex items-center justify-center min-h-[200px] w-full bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                <img
                  src={selectedReceiptVisa.transferImage}
                  alt="Receipt"
                  className="max-h-[60vh] max-w-full rounded-lg object-contain"
                />
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                {isAr ? 'لم يتم إرفاق صورة إيصال' : 'No receipt image attached'}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Refund Workspace Modal */}
      {refundWorkspaceOpen && (
        <VisaRefundEditorWorkspace
          opened={refundWorkspaceOpen}
          initialData={visaForRefund}
          onClose={() => {
            setRefundWorkspaceOpen(false);
            setVisaForRefund(null);
          }}
          onSuccess={() => {
            setRefundWorkspaceOpen(false);
            setVisaForRefund(null);
            fetchVisas();
          }}
        />
      )}

      <InvoiceAuditLogModal
        opened={auditLogOpen}
        onClose={() => setAuditLogOpen(false)}
        ticketNumber={auditLogVisa?.invoiceNumber || auditLogVisa?.number}
        pnr={auditLogVisa?.pnr}
        customerName={auditLogVisa?.customerName}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title={
          <div className="flex items-center gap-2 text-red-600 font-bold">
            <AlertTriangle size={18} />
            <span>{isAr ? 'حذف معاملة التأشيرة' : 'Delete Visa Record'}</span>
          </div>
        }
        size="md"
        radius="lg"
        dir={direction}
        centered
      >
        <div className="space-y-4 text-xs font-sans">
          <p className="text-slate-700 leading-relaxed">
            {isAr
              ? `هل أنت متأكد من رغبتك في حذف معاملة التأشيرة (${visaToDelete?.invoiceNumber})؟ سيتم إلغاء قيد المعاملة وحذفها من السجلات المالية.`
              : `Are you sure you want to delete visa record (${visaToDelete?.invoiceNumber})? This will remove its entries from financial reports.`}
          </p>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              size="xs"
              variant="default"
              radius="md"
              onClick={() => setDeleteConfirmOpen(false)}
              className="cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              size="xs"
              color="red"
              variant="filled"
              radius="md"
              onClick={handleConfirmDeleteVisa}
              loading={deleting}
              className="bg-red-600 hover:bg-red-700 font-semibold cursor-pointer text-white"
            >
              {isAr ? 'تأكيد الحذف' : 'Confirm Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default VisasPage;
