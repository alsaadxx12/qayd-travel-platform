import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Loader, Modal, ScrollArea, TextInput, Tooltip } from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconBook2,
  IconCash,
  IconExternalLink,
  IconFileInvoice,
  IconInfoCircle,
  IconLink,
  IconPlane,
  IconRefresh,
  IconRoute,
  IconSearch,
  IconWallet,
} from '@tabler/icons-react';
import {
  DebtAmountTraceResponse,
  DebtTraceKind,
  DebtTraceMovement,
  getDebtAmountTrace,
} from '../../api/reports';

export interface DebtTraceAccountRow {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  debtType: 'receivable' | 'payable' | 'zero';
  endingBalanceIQD: number;
  endingBalanceUSD: number;
}

interface DebtAmountTraceModalProps {
  opened: boolean;
  account: DebtTraceAccountRow | null;
  onClose: () => void;
  onOpenStatement: (account: DebtTraceAccountRow) => void;
}

type CategoryFilter = 'ALL' | 'SERVICES' | 'VOUCHERS' | 'JOURNALS';

const KIND_META: Record<DebtTraceKind, { label: string; color: string; icon: React.ReactNode }> = {
  SERVICE: { label: 'خدمة', color: 'blue', icon: <IconPlane size={15} /> },
  RECEIPT_VOUCHER: { label: 'سند قبض', color: 'teal', icon: <IconCash size={15} /> },
  PAYMENT_VOUCHER: { label: 'سند صرف', color: 'orange', icon: <IconWallet size={15} /> },
  MANUAL_JOURNAL: { label: 'قيد يدوي', color: 'gray', icon: <IconBook2 size={15} /> },
  OPENING: { label: 'رصيد افتتاحي', color: 'indigo', icon: <IconFileInvoice size={15} /> },
  REVERSAL: { label: 'قيد عكسي', color: 'red', icon: <IconRefresh size={15} /> },
};

const formatAmount = (value: number, currency: string) => {
  const formatted = Math.abs(Number(value || 0)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === 'USD' ? `$ ${formatted}` : `${formatted} د.ع`;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-IQ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

const balanceNature = (value: number) => {
  if (value > 0.001) return 'مدين';
  if (value < -0.001) return 'دائن';
  return 'متعادل';
};

const matchesCategory = (movement: DebtTraceMovement, filter: CategoryFilter) => {
  if (filter === 'ALL') return true;
  if (filter === 'SERVICES') return movement.kind === 'SERVICE';
  if (filter === 'VOUCHERS') {
    return movement.kind === 'RECEIPT_VOUCHER' || movement.kind === 'PAYMENT_VOUCHER';
  }
  return !['SERVICE', 'RECEIPT_VOUCHER', 'PAYMENT_VOUCHER'].includes(movement.kind);
};

const MovementPath: React.FC<{ movement: DebtTraceMovement }> = ({ movement }) => (
  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold text-slate-500">
      <IconLink size={13} />
      <span>المسار الموثّق للحركة</span>
    </div>
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
      {movement.path.map((node, index) => (
        <React.Fragment key={`${movement.traceId}-${node.role}-${node.id}-${index}`}>
          {index > 0 && <IconArrowLeft size={14} className="shrink-0 text-slate-400" />}
          <div
            className={`min-w-0 shrink-0 rounded-md border px-2.5 py-1.5 ${
              node.role === 'SOURCE'
                ? 'border-blue-200 bg-blue-50 text-blue-900'
                : node.role === 'JOURNAL'
                  ? 'border-violet-200 bg-violet-50 text-violet-900'
                  : node.role === 'ACCOUNT'
                    ? 'border-orange-200 bg-orange-50 text-orange-900'
                    : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            <span className="block max-w-44 truncate text-[10px] font-black">{node.label}</span>
            {node.number && (
              <span className="block max-w-44 truncate font-mono text-[9px] opacity-70">{node.number}</span>
            )}
          </div>
        </React.Fragment>
      ))}
    </div>
  </div>
);

const TraceMovementCard: React.FC<{
  movement: DebtTraceMovement;
  debtType: DebtTraceAccountRow['debtType'];
}> = ({ movement, debtType }) => {
  const meta = KIND_META[movement.kind] || KIND_META.MANUAL_JOURNAL;
  const movementReducesDebt =
    debtType === 'receivable'
      ? movement.direction === 'CREDIT'
      : debtType === 'payable'
        ? movement.direction === 'DEBIT'
        : false;
  const impactLabel = movementReducesDebt ? 'خفّض المديونية' : 'زاد/أنشأ الرصيد';

  return (
    <article className="relative pr-11">
      <div className="absolute right-[13px] top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-sm">
        {meta.icon}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Badge color={meta.color} variant="light" size="sm" className="font-extrabold">
                {movement.source.label || meta.label}
              </Badge>
              <span className="font-mono text-[11px] font-black text-slate-800">
                {movement.source.number || movement.journal?.entryNumber || 'بدون رقم'}
              </span>
              {movement.sourceConfidence === 'LEGACY_RECORD' && (
                <Tooltip label="الخدمة محفوظة ولكن قيدها المحاسبي لم يُرحّل بعد" withArrow>
                  <Badge color="yellow" variant="light" size="xs">بانتظار الترحيل</Badge>
                </Tooltip>
              )}
              {movement.sourceConfidence === 'REFERENCE_FALLBACK' && (
                <Tooltip label="تم التعرف على المصدر من رقم المرجع في قيد قديم" withArrow>
                  <Badge color="gray" variant="outline" size="xs">ربط بالمرجع</Badge>
                </Tooltip>
              )}
            </div>
            <p className="line-clamp-2 text-[12px] font-bold leading-5 text-slate-700">
              {movement.description || movement.journal?.description || 'حركة على الحساب'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-semibold text-slate-500">
              <span>{formatDate(movement.date)}</span>
              {movement.journal?.entryNumber && (
                <span>القيد: <b className="font-mono text-slate-700">{movement.journal.entryNumber}</b></span>
              )}
              {movement.source.pnr && (
                <span>PNR: <b className="font-mono text-slate-700">{movement.source.pnr}</b></span>
              )}
              {movement.source.route && <span>المسار: <b className="text-slate-700">{movement.source.route}</b></span>}
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-center">
            <div className="min-w-28 border-l border-slate-200 px-2.5 py-2">
              <span className="block text-[9px] font-bold text-slate-500">الحركة</span>
              <strong className={movement.direction === 'DEBIT' ? 'font-mono text-xs text-emerald-700' : 'font-mono text-xs text-rose-700'}>
                {formatAmount(movement.amount, movement.currency)}
              </strong>
              <span className={`mt-0.5 block text-[9px] font-bold ${movementReducesDebt ? 'text-teal-700' : 'text-slate-500'}`}>
                {movement.direction === 'DEBIT' ? 'حركة مدينة' : 'حركة دائنة'} · {impactLabel}
              </span>
            </div>
            <div className="min-w-28 border-l border-slate-200 px-2.5 py-2">
              <span className="block text-[9px] font-bold text-slate-500">قبل الحركة</span>
              <strong className="font-mono text-xs text-slate-700">
                {formatAmount(movement.balanceBefore, movement.currency)}
              </strong>
              <span className="mt-0.5 block text-[9px] font-bold text-slate-500">{balanceNature(movement.balanceBefore)}</span>
            </div>
            <div className="min-w-28 px-2.5 py-2">
              <span className="block text-[9px] font-bold text-slate-500">الرصيد بعدها</span>
              <strong className={`font-mono text-xs ${movement.runningBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatAmount(movement.runningBalance, movement.currency)}
              </strong>
              <span className="mt-0.5 block text-[9px] font-bold text-slate-500">{balanceNature(movement.runningBalance)}</span>
            </div>
          </div>
        </div>

        <MovementPath movement={movement} />
      </div>
    </article>
  );
};

export const DebtAmountTraceModal: React.FC<DebtAmountTraceModalProps> = ({
  opened,
  account,
  onClose,
  onOpenStatement,
}) => {
  const [data, setData] = useState<DebtAmountTraceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!opened || !account?.id) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    setCategoryFilter('ALL');
    setCurrencyFilter('ALL');
    setSearch('');

    getDebtAmountTrace(account.id, controller.signal)
      .then((response) => setData(response))
      .catch((requestError: Error) => {
        if (!controller.signal.aborted) {
          setError(requestError.message || 'تعذر تحميل مسار المبلغ.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [opened, account?.id, reloadKey]);

  const filteredMovements = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.movements || []).filter((movement) => {
      if (!matchesCategory(movement, categoryFilter)) return false;
      if (currencyFilter !== 'ALL' && movement.currency !== currencyFilter) return false;
      if (!query) return true;
      const haystack = [
        movement.description,
        movement.source.label,
        movement.source.number,
        movement.source.pnr,
        movement.source.route,
        movement.journal?.entryNumber,
        movement.journal?.reference,
        ...movement.counterpartAccounts.map((counterpart) => counterpart.nameAr),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [data?.movements, categoryFilter, currencyFilter, search]);

  const categoryOptions: Array<{ value: CategoryFilter; label: string; count: number }> = [
    { value: 'ALL', label: 'كل الحركات', count: data?.counts.total || 0 },
    { value: 'SERVICES', label: 'الخدمات', count: data?.counts.services || 0 },
    { value: 'VOUCHERS', label: 'السندات', count: data?.counts.vouchers || 0 },
    { value: 'JOURNALS', label: 'القيود والأرصدة', count: data?.counts.journals || 0 },
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="min(1180px, calc(100vw - 32px))"
      centered
      radius="lg"
      padding={0}
      closeButtonProps={{ 'aria-label': 'إغلاق نافذة مسار المبلغ' }}
      title={
        <div dir="rtl" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-orange-600">
            <IconRoute size={21} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-950">مسار مبلغ المديونية</h2>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-500">تتبع المصدر والقيد والحسابات المقابلة خطوة بخطوة</p>
          </div>
        </div>
      }
      styles={{
        content: {
          height: 'min(790px, 92dvh)',
          maxHeight: '92dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
        header: {
          minHeight: 72,
          paddingInline: 20,
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
        },
        body: {
          minHeight: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
        },
      }}
    >
      <div dir="rtl" className="flex min-h-0 flex-1 flex-col bg-slate-50/70">
        <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                <span className="font-mono text-[11px] font-black">{account?.code?.slice(-3) || '—'}</span>
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-black text-slate-950">{account?.nameAr || 'الحساب'}</h3>
                <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                  <span className="font-mono">{account?.code}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span>{account?.debtType === 'receivable' ? 'مديونية لنا' : account?.debtType === 'payable' ? 'مديونية علينا' : 'رصيد متعادل'}</span>
                </div>
              </div>
            </div>
            {account && (
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                rightSection={<IconExternalLink size={14} />}
                onClick={() => onOpenStatement(account)}
                className="font-bold"
              >
                كشف الحساب الكامل
              </Button>
            )}
          </div>

          {data && data.summaries.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {data.summaries.map((summary) => (
                <div key={summary.currency} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${summary.currency === 'USD' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'}`}>
                      <IconWallet size={17} />
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-500">الرصيد المتتبع — {summary.currency}</span>
                      <strong className={`font-mono text-sm ${summary.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatAmount(summary.balance, summary.currency)}
                      </strong>
                      <span className="mr-1 text-[9px] font-bold text-slate-500">({balanceNature(summary.balance)})</span>
                    </div>
                  </div>
                  <div className="flex gap-4 text-left text-[9px] font-semibold text-slate-500" dir="ltr">
                    <span>Debit <b className="block font-mono text-[11px] text-emerald-700">{formatAmount(summary.debit, summary.currency)}</b></span>
                    <span>Credit <b className="block font-mono text-[11px] text-rose-700">{formatAmount(summary.credit, summary.currency)}</b></span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {data && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
                {categoryOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCategoryFilter(option.value)}
                    className={`rounded-md px-2.5 py-1.5 text-[10px] font-extrabold ${
                      categoryFilter === option.value
                        ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-600 hover:bg-white/60'
                    } focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300`}
                  >
                    {option.label} <span className="font-mono opacity-60">({option.count})</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {data.summaries.length > 1 && (
                  <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
                    {['ALL', ...data.summaries.map((summary) => summary.currency)].map((currency) => (
                      <button
                        key={currency}
                        type="button"
                        onClick={() => setCurrencyFilter(currency)}
                        className={`rounded-md px-2 py-1 text-[10px] font-black focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${currencyFilter === currency ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                      >
                        {currency === 'ALL' ? 'العملتان' : currency}
                      </button>
                    ))}
                  </div>
                )}
                <TextInput
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  placeholder="بحث في المرجع أو البيان..."
                  size="xs"
                  leftSection={<IconSearch size={14} />}
                  className="w-56"
                  styles={{ input: { borderRadius: 8 } }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-600">
              <Loader color="orange" size="md" />
              <div className="text-center">
                <p className="text-xs font-black text-slate-800">جارٍ بناء مسار المبلغ...</p>
                <p className="mt-1 text-[10px] font-semibold text-slate-500">نربط الخدمات والسندات بالقيود والحسابات المقابلة</p>
              </div>
            </div>
          ) : error ? (
            <div className="mx-auto flex h-full max-w-xl items-center px-5">
              <Alert icon={<IconAlertCircle size={18} />} color="red" title="تعذر تحميل مسار المبلغ" className="w-full">
                <p className="mb-3 text-xs">{error}</p>
                <Button size="xs" color="red" variant="light" leftSection={<IconRefresh size={14} />} onClick={() => setReloadKey((value) => value + 1)}>
                  إعادة المحاولة
                </Button>
              </Alert>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-5 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <IconRoute size={26} />
              </div>
              <h4 className="text-sm font-black text-slate-800">لا توجد حركات مطابقة</h4>
              <p className="mt-1 max-w-md text-[11px] font-semibold leading-5 text-slate-500">
                {data?.movements.length ? 'غيّر نوع الحركة أو العملة أو عبارة البحث.' : 'لا توجد قيود مرحّلة أو خدمات معلّقة مرتبطة بهذا الحساب.'}
              </p>
            </div>
          ) : (
            <ScrollArea h="100%" type="auto" offsetScrollbars>
              <div className="relative space-y-3 px-5 py-4">
                <div className="absolute bottom-5 right-[38px] top-5 w-px bg-slate-300" />
                {filteredMovements.map((movement) => (
                  <TraceMovementCard key={movement.traceId} movement={movement} debtType={account?.debtType || 'zero'} />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3">
          {data?.integrity.warnings?.length ? (
            <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-semibold leading-5 text-amber-900">
              <IconInfoCircle size={15} className="mt-0.5 shrink-0" />
              <span>{data.integrity.warnings.join(' ')}</span>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex max-w-3xl items-start gap-2 text-[10px] font-semibold leading-5 text-slate-500">
              <IconInfoCircle size={14} className="mt-0.5 shrink-0" />
              <span>{data?.integrity.allocationNotice || 'المسار مبني على القيود المحاسبية المرحلة والمستندات المرتبطة بها.'}</span>
            </div>
            <Button variant="outline" color="gray" size="xs" onClick={onClose} className="font-bold">
              إغلاق
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
