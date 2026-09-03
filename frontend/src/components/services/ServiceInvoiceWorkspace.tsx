import React, { useEffect, useMemo, useState } from 'react';
import { Loader } from '@mantine/core';
import {
  IconX,
  IconDeviceFloppy,
  IconSearch,
  IconUser,
  IconTruck,
  IconCoins,
  IconTrendingUp,
  IconFileInvoice,
} from '@tabler/icons-react';
import { SearchableCombobox } from '../ui/SearchableCombobox';
import { AccountFinderModal, type AccountFinderResult } from '../common/AccountFinderModal';
import { ticketsApi, type TicketData } from '../../api/tickets';
import { partnersApi } from '../../api/partners';
import { accountsApi } from '../../api/accounts';
import { allocateDocumentNumber } from '../../utils/sequenceUtils';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import {
  SERVICE_KINDS,
  decodeServiceExtras,
  encodeServiceExtras,
  type ServiceKindId,
} from './serviceKinds';

const numeric = (raw: any) => {
  const n = Number(String(raw ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};

const money = (v: number, currency: string) =>
  `${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency === 'USD' ? '$' : 'IQD'}`;

interface Props {
  kind: ServiceKindId;
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: TicketData | null;
}

/**
 * شاشة إصدار خدمة: تغيير، أو حجز فندق، أو بيع وزن.
 *
 * واحدة تخدم الثلاث لأن ما تسأله عنه واحد — العميل والمورد والكمّية والسعران —
 * ويختلف كلٌّ في حقلين أو ثلاثة تُوصف في serviceKinds. وما يُحفظ تذكرةٌ موسومة
 * بنوعها، فتدخل كشوف الحسابات والتقارير والقيود مع بقية الخدمات بلا مسارٍ ثانٍ.
 */
export const ServiceInvoiceWorkspace: React.FC<Props> = ({ kind, opened, onClose, onSuccess, initialData }) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const def = SERVICE_KINDS[kind];

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState('');
  const [supplierAccount, setSupplierAccount] = useState('');
  const [supplierAccountName, setSupplierAccountName] = useState('');
  const [currency, setCurrency] = useState<'IQD' | 'USD'>('IQD');
  const [paymentType, setPaymentType] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [cashboxAccountId, setCashboxAccountId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitBuy, setUnitBuy] = useState(0);
  const [unitSell, setUnitSell] = useState(0);
  const [extras, setExtras] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState<any[]>([]);
  const [cashboxes, setCashboxes] = useState<any[]>([]);
  const [finderOpen, setFinderOpen] = useState(false);

  useEffect(() => {
    if (!opened) return;

    if (initialData) {
      const { userNotes, extras: saved } = decodeServiceExtras(initialData.notes);
      setInvoiceNumber(initialData.invoiceNumber || '');
      setIssueDate(String(initialData.issueDate || new Date().toISOString()).slice(0, 10));
      setCustomerName(initialData.customerName || '');
      setSupplierAccount(initialData.supplierAccount || '');
      setSupplierAccountName(initialData.supplierAccountName || '');
      setCurrency(String(initialData.currency || 'IQD').toUpperCase() === 'USD' ? 'USD' : 'IQD');
      setPaymentType(String(initialData.paymentType || 'DEBIT') === 'CREDIT' ? 'CREDIT' : 'DEBIT');
      setCashboxAccountId((initialData as any).cashboxAccountId || '');
      const qty = (initialData.passengers || []).length || numeric(saved.quantity) || 1;
      setQuantity(qty);
      setUnitBuy(numeric(initialData.totalBuy) / Math.max(1, qty));
      setUnitSell(numeric(initialData.totalSell) / Math.max(1, qty));
      setExtras(saved || {});
      setNotes(userNotes);
    } else {
      setInvoiceNumber('');
      allocateDocumentNumber(def.sequenceKey).then(setInvoiceNumber);
      setIssueDate(new Date().toISOString().slice(0, 10));
      setCustomerName('');
      setSupplierAccount('');
      setSupplierAccountName('');
      setPaymentType('DEBIT');
      setQuantity(1);
      setUnitBuy(0);
      setUnitSell(0);
      setExtras({});
      setNotes('');
    }

    partnersApi.getCustomers().then((d: any) => setCustomers(Array.isArray(d) ? d : d?.data || [])).catch(() => undefined);
    accountsApi
      .getFlat(undefined, undefined, true)
      .then((d: any) => {
        const list = Array.isArray(d) ? d : d?.data || [];
        setCashboxes(list.filter((a: any) => a.category === 'CASH' && !a.isParent));
      })
      .catch(() => undefined);
  }, [opened, initialData, def.sequenceKey]);

  const totals = useMemo(() => {
    const qty = Math.max(1, quantity);
    const buy = unitBuy * qty;
    const sell = unitSell * qty;
    return { qty, buy, sell, profit: sell - buy };
  }, [quantity, unitBuy, unitSell]);

  const customerOptions = useMemo(
    () => customers.map((c: any) => ({ value: c.nameAr || c.name || c.id, label: c.nameAr || c.name || '', code: c.code })),
    [customers],
  );
  const cashboxOptions = useMemo(
    () => cashboxes.map((c: any) => ({ value: c.id, label: c.nameAr || c.name || '', code: c.code })),
    [cashboxes],
  );

  const handleSave = async () => {
    if (!customerName.trim()) {
      showErrorNotification(isAr ? 'العميل مطلوب' : 'Customer required', isAr ? 'حدّد العميل قبل الحفظ.' : 'Pick the customer.');
      return;
    }
    if (totals.sell <= 0) {
      showErrorNotification(isAr ? 'سعر البيع مطلوب' : 'Sale price required', isAr ? 'أدخل سعر البيع.' : 'Enter the sale price.');
      return;
    }

    setSaving(true);
    try {
      const number = invoiceNumber || (await allocateDocumentNumber(def.sequenceKey));
      const payload: any = {
        invoiceNumber: number,
        issueDate,
        tripType: def.tripType,
        customerName: customerName.trim(),
        supplierAccount: supplierAccount || null,
        supplierAccountName: supplierAccountName || null,
        currency,
        paymentType,
        cashboxAccountId: paymentType === 'DEBIT' ? cashboxAccountId || null : null,
        notes: encodeServiceExtras(notes, { ...extras, quantity: totals.qty }),
        status: 'POSTED',
        totalBuy: totals.buy,
        netBuy: totals.buy,
        totalSell: totals.sell,
        netSell: totals.sell,
        profit: totals.profit,
        pnr: extras.pnr || null,
        // كل وحدة سطرٌ في التذكرة — مقعد أو ليلة أو كيلو — فتُقرأ الكمّية والسعر
        // في الكشف والتقارير كما تُقرأ التذاكر تماماً.
        passengers: Array.from({ length: totals.qty }, (_, i) => ({
          name: `${customerName.trim()} — ${isAr ? def.quantityAr : def.quantityEn} ${i + 1}`,
          ticketType: 'ADULT',
          ticketNumber: extras.ticketNumber || '',
          fareBuy: unitBuy,
          fareSell: unitSell,
        })),
      };

      if ((initialData as any)?.id) await ticketsApi.update((initialData as any).id, payload);
      else await ticketsApi.create(payload);

      showSuccessNotification(
        isAr ? 'تم الحفظ' : 'Saved',
        `${isAr ? def.titleAr : def.titleEn} — ${number}`,
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      showErrorNotification(isAr ? 'تعذّر الحفظ' : 'Save failed', err?.message || '');
    } finally {
      setSaving(false);
    }
  };

  if (!opened) return null;

  const input =
    'w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-[12.5px] font-bold text-slate-900 outline-none hover:border-slate-400 focus:border-[#F45A0A] focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-slate-300 placeholder:font-normal';

  const Field: React.FC<{ label: string; children: React.ReactNode; span?: boolean }> = ({ label, children, span }) => (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="text-[11.5px] font-bold text-slate-700 block mb-1">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9998] bg-[#F7F8FA] flex flex-col font-sans" dir={direction}>
      <div className="bg-white border-b border-slate-200 shadow-2xs shrink-0">
        <div className="max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#F45A0A] to-[#f59e0b] text-white flex items-center justify-center shrink-0">
              <IconFileInvoice size={20} />
            </div>
            <div>
              <h2 className="font-black text-sm text-slate-900 leading-tight">
                {(initialData as any)?.id ? (isAr ? 'تعديل' : 'Edit') : isAr ? 'إصدار' : 'New'}{' '}
                {isAr ? def.titleAr : def.titleEn}
              </h2>
              <p className="text-[11px] font-mono font-bold text-slate-500 mt-0.5" dir="ltr">
                {invoiceNumber || '…'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center cursor-pointer"
          >
            <IconX size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-4 pb-28 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* ── الطرفان ── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <IconUser size={16} className="text-[#F45A0A]" />
              <span className="font-black text-xs text-slate-900">{isAr ? 'العميل والمورد' : 'Customer & supplier'}</span>
            </div>

            <Field label={isAr ? 'العميل *' : 'Customer *'}>
              <SearchableCombobox
                value={customerName}
                onChange={(v) => setCustomerName(v || '')}
                options={customerOptions}
                placeholder={isAr ? 'اختر العميل…' : 'Customer…'}
                allowCustomValue
              />
            </Field>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="text-[11.5px] font-bold text-slate-700">{isAr ? 'المورد' : 'Supplier'}</label>
                <button
                  type="button"
                  onClick={() => setFinderOpen(true)}
                  className="h-[18px] text-[10.5px] font-bold text-[#F45A0A] hover:text-[#dd4f05] flex items-center gap-1 cursor-pointer bg-orange-50/70 hover:bg-orange-100/80 px-1.5 rounded-md border border-orange-200/60 leading-none"
                >
                  <IconSearch size={11} />
                  {isAr ? 'بحث متقدّم' : 'Advanced'}
                </button>
              </div>
              <input
                value={supplierAccountName}
                onChange={(e) => setSupplierAccountName(e.target.value)}
                placeholder={isAr ? 'اسم المورد…' : 'Supplier…'}
                className={input}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label={isAr ? 'تاريخ الإصدار' : 'Issue date'}>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={`${input} font-mono`} />
              </Field>
              <Field label={isAr ? 'العملة' : 'Currency'}>
                <select value={currency} onChange={(e) => setCurrency(e.target.value as any)} className={`${input} cursor-pointer`}>
                  <option value="IQD">IQD</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label={isAr ? 'نوع البيع' : 'Sale type'}>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value as any)}
                  className={`${input} cursor-pointer`}
                >
                  <option value="DEBIT">{isAr ? 'نقدي (تحصيل فوري)' : 'Cash'}</option>
                  <option value="CREDIT">{isAr ? 'آجل (ذمة العميل)' : 'Credit'}</option>
                </select>
              </Field>
              {paymentType === 'DEBIT' && (
                <Field label={isAr ? 'صندوق الاستلام' : 'Receiving cashbox'}>
                  <SearchableCombobox
                    value={cashboxAccountId}
                    onChange={(v) => setCashboxAccountId(v || '')}
                    options={cashboxOptions}
                    placeholder={isAr ? 'اختر الصندوق…' : 'Cashbox…'}
                  />
                </Field>
              )}
            </div>

            <Field label={isAr ? 'ملاحظات' : 'Notes'}>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-[12px] font-medium outline-none focus:border-[#F45A0A]"
              />
            </Field>
          </div>

          {/* ── تفاصيل الخدمة وتسعيرها ── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <IconTruck size={16} className="text-[#F45A0A]" />
              <span className="font-black text-xs text-slate-900">
                {isAr ? `تفاصيل ${def.titleAr}` : `${def.titleEn} details`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {def.extraFields.map((f) => (
                <Field key={f.key} label={isAr ? f.ar : f.en} span={f.wide}>
                  <input
                    type={f.type === 'date' ? 'date' : 'text'}
                    dir={f.type === 'text' && !f.wide ? 'ltr' : undefined}
                    value={extras[f.key] ?? ''}
                    onChange={(e) =>
                      setExtras((prev) => ({
                        ...prev,
                        [f.key]: f.type === 'number' ? numeric(e.target.value) : e.target.value,
                      }))
                    }
                    placeholder={f.placeholder || ''}
                    className={`${input} ${f.type !== 'text' || f.placeholder ? 'font-mono' : ''}`}
                  />
                </Field>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              <Field label={isAr ? def.quantityAr : def.quantityEn}>
                <input
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.round(numeric(e.target.value))))}
                  dir="ltr"
                  className={`${input} font-mono text-center`}
                />
              </Field>
              <Field label={isAr ? 'سعر الشراء للوحدة' : 'Unit buy'}>
                <input
                  value={unitBuy ? unitBuy.toLocaleString('en-US') : ''}
                  onChange={(e) => setUnitBuy(numeric(e.target.value))}
                  dir="ltr"
                  placeholder="0"
                  className={`${input} font-mono text-end`}
                />
              </Field>
              <Field label={isAr ? 'سعر البيع للوحدة *' : 'Unit sell *'}>
                <input
                  value={unitSell ? unitSell.toLocaleString('en-US') : ''}
                  onChange={(e) => setUnitSell(numeric(e.target.value))}
                  dir="ltr"
                  placeholder="0"
                  className={`${input} font-mono text-end`}
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: isAr ? 'إجمالي الشراء' : 'Total buy', value: money(totals.buy, currency), tone: 'bg-slate-50 border-slate-200 text-slate-900' },
                { label: isAr ? 'إجمالي البيع' : 'Total sell', value: money(totals.sell, currency), tone: 'bg-sky-50 border-sky-200 text-sky-900' },
                {
                  label: isAr ? 'الربح' : 'Profit',
                  value: `${totals.profit >= 0 ? '+' : ''}${money(totals.profit, currency)}`,
                  tone: totals.profit >= 0 ? 'bg-emerald-50 border-emerald-200 text-[#078B61]' : 'bg-rose-50 border-rose-200 text-rose-700',
                },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border p-2.5 ${s.tone}`}>
                  <span className="text-[10.5px] font-black text-slate-500 block">{s.label}</span>
                  <span className="font-mono font-black text-sm" dir="ltr">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-t border-slate-200 shadow-lg shrink-0">
        <div className="max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-[11px]">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
              <span className="text-[10px] font-bold text-slate-500 block flex items-center gap-1">
                <IconCoins size={11} />
                {isAr ? def.quantityAr : def.quantityEn}
              </span>
              <span className="font-mono font-black text-slate-900 text-[12px]">{totals.qty}</span>
            </div>
            <div
              className={`rounded-xl px-2.5 py-1 border ${
                totals.profit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-500 block flex items-center gap-1">
                <IconTrendingUp size={11} />
                {isAr ? 'الربح' : 'Profit'}
              </span>
              <span
                className={`font-mono font-black text-[12px] ${totals.profit >= 0 ? 'text-[#078B61]' : 'text-rose-700'}`}
                dir="ltr"
              >
                {totals.profit >= 0 ? '+' : ''}
                {money(totals.profit, currency)}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="h-9 px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:opacity-60 text-white text-xs font-black cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            {saving ? <Loader size={14} color="white" /> : <IconDeviceFloppy size={15} />}
            {isAr ? 'حفظ وترحيل' : 'Save & post'}
          </button>
        </div>
      </div>

      <AccountFinderModal
        opened={finderOpen}
        initialScope="SUPPLIER"
        initialQuery={supplierAccountName}
        onClose={() => setFinderOpen(false)}
        onSelect={(a: AccountFinderResult) => {
          setSupplierAccount(a.id);
          setSupplierAccountName(a.name);
        }}
      />
    </div>
  );
};

export default ServiceInvoiceWorkspace;
