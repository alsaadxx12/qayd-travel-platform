import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader, Menu, Modal } from '@mantine/core';
import {
  IconX,
  IconUsersGroup,
  IconPlus,
  IconTrash,
  IconLockOpen,
  IconLock,
  IconTicket,
  IconBuildingSkyscraper,
  IconId,
  IconShieldCheck,
  IconBus,
  IconUserStar,
  IconPackage,
  IconCoins,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconClock,
  IconBan,
} from '@tabler/icons-react';
import { SearchableCombobox } from '../ui/SearchableCombobox';
import { partnersApi } from '../../api/partners';
import {
  tourGroupsApi,
  type TourGroup,
  type GroupPassenger,
  type GroupPassengerService,
  type GroupPriceSystem,
} from '../../api/tourGroups';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';

/**
 * النافذة الواحدة لملف الكروب.
 *
 * تُفتح على الملخّص أولاً — كما اشترط المالك — ثم أقسامه: معلومات الكروب،
 * أنظمة الأسعار ببنودها، المشتريات والمصاريف العامة، والمسافرون وخدماتهم.
 * كل كتابةٍ تذهب إلى الخادم وتعود بالملف محدَّثاً بملخّصه، فلا رقم هنا يُحسب
 * في المتصفّح ولا شيء يُحفظ فيه.
 */

const KIND_META: Record<string, { ar: string; icon: any }> = {
  TICKET: { ar: 'تذكرة', icon: IconTicket },
  HOTEL: { ar: 'فندق', icon: IconBuildingSkyscraper },
  VISA: { ar: 'فيزا', icon: IconId },
  INSURANCE: { ar: 'تأمين', icon: IconShieldCheck },
  TRANSPORT: { ar: 'نقل', icon: IconBus },
  GUIDE: { ar: 'مرشد', icon: IconUserStar },
  PACKAGE: { ar: 'باكج', icon: IconPackage },
};

const money = (v: number, c = 'USD') =>
  `${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${c === 'USD' ? '$' : 'IQD'}`;
const num = (raw: any) => Number(String(raw ?? '').replace(/,/g, '')) || 0;

const input =
  'w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-[12.5px] font-bold text-slate-900 outline-none hover:border-slate-400 focus:border-[#F45A0A] focus:ring-2 focus:ring-orange-100 transition-all';

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <div className={className}>
    <label className="text-[11px] font-bold text-slate-600 block mb-1">{label}</label>
    {children}
  </div>
);

/* ── الملخّص: الأرقام أولاً، بالشكل الذي رسمه المالك ── */
const SummaryBlock: React.FC<{ g: TourGroup }> = ({ g }) => {
  const s = g.summary;
  const C = g.currency;
  const groups: Array<Array<[string, string, string?]>> = [
    [
      ['Seats', String(s.seats)],
      ['Sold', String(s.sold)],
      ['Remaining', String(s.remaining)],
    ],
    [
      ['Passengers', String(s.passengers)],
      ['Complete', String(s.complete), 'text-emerald-700'],
      ['Not Complete', String(s.notComplete), s.notComplete > 0 ? 'text-amber-700' : undefined],
    ],
    [
      ['Sales', money(s.sales, C)],
      ['Collected', money(s.collected, C), 'text-emerald-700'],
      ['Outstanding', money(s.outstanding, C), s.outstanding > 0 ? 'text-rose-700' : undefined],
    ],
    [
      ['Planned Cost', money(s.plannedCost, C)],
      ['Actual Cost', money(s.actualCost, C)],
      ['Expenses', money(s.expenses, C)],
    ],
    [
      ['Planned Profit', money(s.plannedProfit, C), s.plannedProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'],
      ['Actual Profit', money(s.actualProfit, C), s.actualProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'],
    ],
  ];
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-3 font-mono" dir="ltr">
        {groups.map((grp, i) => (
          <div key={i} className={`space-y-1.5 ${i > 0 ? 'md:border-s md:border-slate-100 md:ps-5' : ''}`}>
            {grp.map(([label, value, tone]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="text-slate-500 font-bold">{label}</span>
                <span className={`font-black ${tone || 'text-slate-900'}`}>{value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

interface Props {
  opened: boolean;
  groupId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

export const GroupFileWorkspace: React.FC<Props> = ({ opened, groupId, onClose, onChanged }) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [g, setG] = useState<TourGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [openPax, setOpenPax] = useState<string | null>(null);
  const [paxModal, setPaxModal] = useState(false);
  const [psModal, setPsModal] = useState<Partial<GroupPriceSystem> | null>(null);
  const [chargeModal, setChargeModal] = useState<'GLOBAL_PURCHASE' | 'EXPENSE' | null>(null);

  const run = useCallback(
    async (op: () => Promise<TourGroup>, okMsg?: string) => {
      setBusy(true);
      try {
        const next = await op();
        setG(next);
        onChanged?.();
        if (okMsg) showSuccessNotification(isAr ? 'تم' : 'Done', okMsg);
        return next;
      } catch (err: any) {
        showErrorNotification(isAr ? 'تعذّر التنفيذ' : 'Failed', err?.message || '');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [isAr, onChanged],
  );

  useEffect(() => {
    if (!opened) return;
    setOpenPax(null);
    partnersApi.getCustomers().then((d: any) => setCustomers(Array.isArray(d) ? d : d?.data || [])).catch(() => undefined);
    if (groupId) {
      setLoading(true);
      tourGroupsApi
        .getOne(groupId)
        .then(setG)
        .catch((e) => showErrorNotification(isAr ? 'تعذّر فتح الملف' : 'Open failed', e?.message || ''))
        .finally(() => setLoading(false));
    } else {
      setG(null);
    }
  }, [opened, groupId, isAr]);

  const customerOptions = useMemo(
    () => customers.map((c: any) => ({ value: c.nameAr || c.name || c.id, label: c.nameAr || c.name || '', code: c.code })),
    [customers],
  );

  if (!opened) return null;

  /* ── إنشاء كروب جديد: نموذج مصغّر قبل أن يوجد الملف ── */
  if (!g && !loading) {
    return (
      <NewGroupForm
        direction={direction}
        isAr={isAr}
        onClose={onClose}
        onCreated={(created) => {
          setG(created);
          onChanged?.();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[9998] bg-[#F7F8FA] flex flex-col font-sans" dir={direction}>
      {/* ── الترويسة ── */}
      <div className="bg-white border-b border-slate-200 shadow-2xs shrink-0">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#F45A0A] to-[#f59e0b] text-white flex items-center justify-center shrink-0">
              <IconUsersGroup size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-sm text-slate-900 truncate">{g?.groupName || '…'}</h2>
              <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                {g?.country || '—'} · {g?.travelDate ? new Date(g.travelDate).toLocaleDateString('en-GB') : isAr ? 'بلا تاريخ سفر' : 'no date'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {g && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(() => tourGroupsApi.update(g.id, { openSale: !g.openSale }), g.openSale ? (isAr ? 'أُغلق البيع' : 'Sale closed') : isAr ? 'فُتح البيع' : 'Sale opened')
                }
                className={`h-9 px-3 rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5 border transition-colors ${
                  g.openSale
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                }`}
              >
                {g.openSale ? <IconLockOpen size={14} /> : <IconLock size={14} />}
                {g.openSale ? (isAr ? 'البيع مفتوح' : 'Open Sale') : isAr ? 'البيع مقفل' : 'Sale closed'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center cursor-pointer"
            >
              <IconX size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-4 pb-16 space-y-4">
          {loading || !g ? (
            <div className="py-24 flex items-center justify-center gap-3 text-sm font-bold text-slate-500">
              <Loader size="sm" color="orange" />
              {isAr ? 'جارٍ فتح ملف الكروب…' : 'Opening…'}
            </div>
          ) : (
            <>
              {/* ١) الملخّص أولاً */}
              <SummaryBlock g={g} />

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                {/* ٢) أنظمة الأسعار */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-slate-900">{isAr ? 'أنظمة الأسعار' : 'Price Systems'}</span>
                    <button
                      type="button"
                      onClick={() => setPsModal({ name: '', seats: 0, currency: g.currency, salePrice: 0, items: [] })}
                      className="h-8 px-3 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white text-[11.5px] font-black cursor-pointer flex items-center gap-1"
                    >
                      <IconPlus size={13} /> {isAr ? 'نظام جديد' : 'New system'}
                    </button>
                  </div>

                  {g.priceSystems.length === 0 ? (
                    <p className="text-xs font-bold text-slate-400 py-6 text-center">
                      {isAr ? 'لا نظام أسعار بعد — وهو شرط بيع المقاعد' : 'No price systems yet'}
                    </p>
                  ) : (
                    g.priceSystems.map((ps) => (
                      <div key={ps.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-[12.5px] text-slate-900">{ps.name}</span>
                            <span className="text-[10.5px] font-black bg-indigo-50 text-indigo-800 border border-indigo-200 rounded px-1.5 py-0.5">
                              {ps.seats} {isAr ? 'مقعداً' : 'seats'}
                            </span>
                            <span className="text-[10.5px] font-mono font-black bg-slate-100 rounded px-1.5 py-0.5" dir="ltr">
                              {money(ps.salePrice, ps.currency)}
                            </span>
                            {!ps.active && (
                              <span className="text-[10px] font-black bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">
                                {isAr ? 'معطَّل' : 'inactive'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPsModal({ ...ps, items: ps.items.map((i) => ({ ...i })) })}
                              className="text-[11px] font-bold text-[#F45A0A] hover:underline cursor-pointer"
                            >
                              {isAr ? 'تعديل' : 'Edit'}
                            </button>
                            <button
                              type="button"
                              onClick={() => run(() => tourGroupsApi.removePriceSystem(g.id, ps.id))}
                              className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
                            >
                              <IconTrash size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {ps.items.map((it, i) => {
                            const meta = KIND_META[it.kind] || KIND_META.PACKAGE;
                            const Icon = meta.icon;
                            return (
                              <span key={i} className="inline-flex items-center gap-1 text-[10.5px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5">
                                <Icon size={11} className="text-slate-500" />
                                {isAr ? meta.ar : it.kind}
                                <span className="font-mono text-slate-600" dir="ltr">{money(it.expectedBuy, it.currency || ps.currency)}</span>
                                {it.supplierName && <span className="text-slate-400">· {it.supplierName}</span>}
                              </span>
                            );
                          })}
                          {ps.items.length === 0 && (
                            <span className="text-[10.5px] font-bold text-amber-700">{isAr ? 'بلا بنود — لن تُنشأ خدمات للمسافر' : 'no items'}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* ٣) المشتريات والمصاريف العامة */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-black text-xs text-slate-900">{isAr ? 'المشتريات والمصاريف العامة' : 'Global purchases & expenses'}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setChargeModal('GLOBAL_PURCHASE')}
                        className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-[11px] font-black text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        + {isAr ? 'شراء عام' : 'Purchase'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setChargeModal('EXPENSE')}
                        className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-[11px] font-black text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        + {isAr ? 'مصروف' : 'Expense'}
                      </button>
                    </div>
                  </div>

                  {g.charges.length === 0 ? (
                    <p className="text-xs font-bold text-slate-400 py-6 text-center">{isAr ? 'لا مشتريات ولا مصاريف عامة بعد' : 'Nothing yet'}</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {g.charges.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-[10px] font-black rounded px-1.5 py-0.5 border shrink-0 ${
                                c.chargeType === 'EXPENSE'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-sky-50 text-sky-800 border-sky-200'
                              }`}
                            >
                              {c.chargeType === 'EXPENSE' ? (isAr ? 'مصروف' : 'EXP') : isAr ? 'شراء عام' : 'BUY'}
                            </span>
                            <span className="font-bold text-slate-800 truncate">{c.category}</span>
                            {c.supplierName && <span className="text-slate-400 truncate">· {c.supplierName}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-black text-slate-900" dir="ltr">{money(c.amount, c.currency)}</span>
                            <button
                              type="button"
                              onClick={() => run(() => tourGroupsApi.removeCharge(g.id, c.id))}
                              className="w-6 h-6 rounded text-slate-300 hover:text-rose-600 flex items-center justify-center cursor-pointer"
                            >
                              <IconTrash size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ٤) المسافرون وخدماتهم */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs text-slate-900">{isAr ? 'المسافرون وخدماتهم' : 'Passengers & services'}</span>
                    <span className="text-[11px] font-black bg-slate-100 rounded px-1.5 py-0.5">
                      {g.summary.sold}/{g.summary.seats}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!g.openSale || g.summary.remaining <= 0}
                    onClick={() => setPaxModal(true)}
                    title={!g.openSale ? (isAr ? 'افتح البيع أولاً' : 'Open sale first') : ''}
                    className="h-8 px-3 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-[11.5px] font-black cursor-pointer flex items-center gap-1"
                  >
                    <IconPlus size={13} /> {isAr ? 'بيع مقعد' : 'Sell seat'}
                  </button>
                </div>

                {g.passengers.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 py-6 text-center">{isAr ? 'لم يُبَع مقعد بعد' : 'No passengers yet'}</p>
                ) : (
                  <div className="space-y-2">
                    {g.passengers.map((p) => (
                      <PassengerRow
                        key={p.id}
                        g={g}
                        p={p}
                        isAr={isAr}
                        open={openPax === p.id}
                        toggle={() => setOpenPax(openPax === p.id ? null : p.id)}
                        run={run}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── النوافذ الفرعية ── */}
      {g && psModal && (
        <PriceSystemModal
          isAr={isAr}
          direction={direction}
          draft={psModal}
          groupCurrency={g.currency}
          onClose={() => setPsModal(null)}
          onSave={async (dto) => {
            const ok = await run(() => tourGroupsApi.savePriceSystem(g.id, dto), isAr ? 'حُفظ نظام الأسعار' : 'Saved');
            if (ok) setPsModal(null);
          }}
        />
      )}

      {g && chargeModal && (
        <ChargeModal
          isAr={isAr}
          direction={direction}
          chargeType={chargeModal}
          currency={g.currency}
          onClose={() => setChargeModal(null)}
          onSave={async (dto) => {
            const ok = await run(() => tourGroupsApi.addCharge(g.id, dto));
            if (ok) setChargeModal(null);
          }}
        />
      )}

      {g && paxModal && (
        <PassengerModal
          isAr={isAr}
          direction={direction}
          g={g}
          customerOptions={customerOptions}
          onClose={() => setPaxModal(false)}
          onSave={async (dto) => {
            const ok = await run(() => tourGroupsApi.addPassenger(g.id, dto), isAr ? 'بيع المقعد وأُنشئت خدماته' : 'Seat sold');
            if (ok) setPaxModal(false);
          }}
        />
      )}
    </div>
  );
};

/* ── صف المسافر: البيع فوق، وخدماته شجرةً تحته ── */
const PassengerRow: React.FC<{
  g: TourGroup;
  p: GroupPassenger;
  isAr: boolean;
  open: boolean;
  toggle: () => void;
  run: (op: () => Promise<TourGroup>, ok?: string) => Promise<TourGroup | null>;
}> = ({ g, p, isAr, open, toggle, run }) => {
  const done = p.services.length > 0 && p.services.every((s) => s.status === 'COMPLETE');
  const cancelled = p.state === 'CANCELLED';
  const outstanding = Number(p.salePrice) - Number(p.collectedAmount);

  return (
    <div className={`rounded-xl border ${cancelled ? 'border-slate-200 opacity-50' : done ? 'border-emerald-200' : 'border-slate-200'}`}>
      <button type="button" onClick={toggle} className="w-full flex items-center justify-between gap-2 p-2.5 cursor-pointer text-start">
        <div className="flex items-center gap-2 min-w-0">
          {cancelled ? (
            <IconBan size={15} className="text-slate-400 shrink-0" />
          ) : done ? (
            <IconCircleCheck size={15} className="text-emerald-600 shrink-0" />
          ) : (
            <IconClock size={15} className="text-amber-600 shrink-0" />
          )}
          <span className="font-black text-[12.5px] text-slate-900 truncate">{p.passengerName}</span>
          {p.customerName && p.customerName !== p.passengerName && (
            <span className="text-[11px] font-bold text-slate-500 truncate">({p.customerName})</span>
          )}
          <span
            className={`text-[10px] font-black rounded px-1.5 py-0.5 border shrink-0 ${
              cancelled
                ? 'bg-slate-100 text-slate-500 border-slate-200'
                : done
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {cancelled ? (isAr ? 'ملغى' : 'Cancelled') : done ? 'Complete' : 'Not Complete'}
          </span>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 text-[11.5px] font-mono font-black" dir="ltr">
          <span className="text-slate-900">{money(p.salePrice, p.currency)}</span>
          {outstanding > 0 && !cancelled && <span className="text-rose-600">-{money(outstanding, p.currency)}</span>}
          {open ? <IconChevronUp size={14} className="text-slate-400" /> : <IconChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-2.5 space-y-1.5">
          {p.services.map((sv) => (
            <ServiceLine key={sv.id} g={g} sv={sv} isAr={isAr} run={run} disabled={cancelled} />
          ))}
          {p.services.length === 0 && (
            <p className="text-[11px] font-bold text-slate-400">{isAr ? 'لا خدمات — نظامه بلا بنود' : 'No services'}</p>
          )}
          {!cancelled && (
            <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-100">
              <CollectBox g={g} p={p} isAr={isAr} run={run} />
              <button
                type="button"
                onClick={() => run(() => tourGroupsApi.updatePassenger(g.id, p.id, { state: 'CANCELLED' }), isAr ? 'أُلغي المسافر' : 'Cancelled')}
                className="h-7 px-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-[11px] font-black hover:bg-rose-100 cursor-pointer"
              >
                {isAr ? 'إلغاء المسافر' : 'Cancel'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── سطر خدمة: المورد + Final Buy يقلبانها Complete ── */
const ServiceLine: React.FC<{
  g: TourGroup;
  sv: GroupPassengerService;
  isAr: boolean;
  disabled?: boolean;
  run: (op: () => Promise<TourGroup>, ok?: string) => Promise<TourGroup | null>;
}> = ({ g, sv, isAr, disabled, run }) => {
  const meta = KIND_META[sv.kind] || KIND_META.PACKAGE;
  const Icon = meta.icon;
  const [supplier, setSupplier] = useState(sv.supplierName || '');
  const [finalBuy, setFinalBuy] = useState(sv.finalBuy === null ? '' : String(sv.finalBuy));
  useEffect(() => {
    setSupplier(sv.supplierName || '');
    setFinalBuy(sv.finalBuy === null ? '' : String(sv.finalBuy));
  }, [sv.supplierName, sv.finalBuy]);

  const dirty = supplier !== (sv.supplierName || '') || finalBuy !== (sv.finalBuy === null ? '' : String(sv.finalBuy));
  const complete = sv.status === 'COMPLETE';

  return (
    <div className={`grid grid-cols-[minmax(90px,auto)_1fr_auto_auto_auto] items-center gap-2 rounded-lg px-2 py-1.5 ${complete ? 'bg-emerald-50/50' : 'bg-slate-50/70'}`}>
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-black text-slate-800">
        <Icon size={13} className={complete ? 'text-emerald-600' : 'text-slate-500'} />
        {isAr ? meta.ar : sv.kind}
      </span>
      <input
        value={supplier}
        onChange={(e) => setSupplier(e.target.value)}
        disabled={disabled}
        placeholder={isAr ? 'المورد' : 'Supplier'}
        className="h-8 px-2 rounded-lg border border-transparent bg-white/70 text-[11.5px] font-bold outline-none focus:border-[#F45A0A] disabled:opacity-50"
      />
      <span className="text-[10.5px] font-mono font-bold text-slate-500 whitespace-nowrap" dir="ltr" title="Expected Buy">
        exp {money(sv.expectedBuy, sv.currency)}
      </span>
      <input
        value={finalBuy}
        onChange={(e) => setFinalBuy(e.target.value)}
        disabled={disabled}
        placeholder="Final"
        dir="ltr"
        className="h-8 w-24 px-2 rounded-lg border border-transparent bg-white/70 text-[11.5px] font-mono font-black text-end outline-none focus:border-[#F45A0A] disabled:opacity-50"
      />
      {dirty ? (
        <button
          type="button"
          onClick={() =>
            run(
              () =>
                tourGroupsApi.updateService(g.id, sv.id, {
                  supplierName: supplier,
                  finalBuy: finalBuy.trim() === '' ? null : num(finalBuy),
                  ...(finalBuy.trim() === '' ? { status: 'NOT_COMPLETE' } : {}),
                }),
              undefined,
            )
          }
          className="h-7 px-2.5 rounded-lg bg-[#F45A0A] text-white text-[10.5px] font-black cursor-pointer"
        >
          {isAr ? 'حفظ' : 'Save'}
        </button>
      ) : (
        <span className={`text-[10px] font-black rounded px-1.5 py-0.5 ${complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {complete ? 'Complete' : 'Not Complete'}
        </span>
      )}
    </div>
  );
};

/* ── تحصيل دفعة من مسافر آجل ── */
const CollectBox: React.FC<{
  g: TourGroup;
  p: GroupPassenger;
  isAr: boolean;
  run: (op: () => Promise<TourGroup>, ok?: string) => Promise<TourGroup | null>;
}> = ({ g, p, isAr, run }) => {
  const [val, setVal] = useState('');
  const outstanding = Number(p.salePrice) - Number(p.collectedAmount);
  if (outstanding <= 0) return <span className="text-[10.5px] font-black text-emerald-700">{isAr ? 'محصَّل بالكامل' : 'Collected'}</span>;
  return (
    <div className="flex items-center gap-1.5">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        dir="ltr"
        placeholder={String(outstanding)}
        className="h-7 w-24 px-2 rounded-lg border border-slate-200 text-[11px] font-mono font-black text-end outline-none focus:border-[#F45A0A]"
      />
      <button
        type="button"
        onClick={() => {
          const add = num(val) || outstanding;
          run(
            () => tourGroupsApi.updatePassenger(g.id, p.id, { collectedAmount: Number(p.collectedAmount) + add }),
            isAr ? 'سُجّل التحصيل' : 'Collected',
          );
          setVal('');
        }}
        className="h-7 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-[11px] font-black hover:bg-emerald-100 cursor-pointer"
      >
        {isAr ? 'تحصيل' : 'Collect'}
      </button>
    </div>
  );
};

/* ── نافذة نظام الأسعار وبنوده ── */
const PriceSystemModal: React.FC<{
  isAr: boolean;
  direction: string;
  draft: Partial<GroupPriceSystem>;
  groupCurrency: string;
  onClose: () => void;
  onSave: (dto: any) => void;
}> = ({ isAr, direction, draft, groupCurrency, onClose, onSave }) => {
  const [d, setD] = useState<any>({ currency: groupCurrency, items: [], ...draft });
  const patchItem = (i: number, ch: any) =>
    setD((prev: any) => ({ ...prev, items: prev.items.map((it: any, j: number) => (j === i ? { ...it, ...ch } : it)) }));
  return (
    <Modal opened onClose={onClose} centered radius="lg" size="lg" withCloseButton={false} zIndex={10050}>
      <div className="space-y-3 font-sans" dir={direction as any}>
        <div className="font-black text-sm text-slate-900">{d.id ? (isAr ? 'تعديل نظام الأسعار' : 'Edit price system') : isAr ? 'نظام أسعار جديد' : 'New price system'}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Field label={isAr ? 'الاسم *' : 'Name *'} className="col-span-2">
            <input value={d.name || ''} onChange={(e) => setD({ ...d, name: e.target.value })} className={input} />
          </Field>
          <Field label={isAr ? 'المقاعد *' : 'Seats *'}>
            <input value={d.seats ?? ''} onChange={(e) => setD({ ...d, seats: Math.max(0, Math.round(num(e.target.value))) })} dir="ltr" className={`${input} font-mono text-center`} />
          </Field>
          <Field label={isAr ? 'سعر البيع *' : 'Sale price *'}>
            <input value={d.salePrice ?? ''} onChange={(e) => setD({ ...d, salePrice: num(e.target.value) })} dir="ltr" className={`${input} font-mono text-end`} />
          </Field>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-black text-slate-800">{isAr ? 'بنود القالب (Auto Purchases)' : 'Auto purchases'}</span>
          <Menu position="bottom-end" shadow="lg" radius="lg" withinPortal zIndex={10060}>
            <Menu.Target>
              <button type="button" className="h-7 px-2.5 rounded-lg border border-orange-200 bg-orange-50 text-[#F45A0A] text-[11px] font-black cursor-pointer">
                + {isAr ? 'بند' : 'Item'}
              </button>
            </Menu.Target>
            <Menu.Dropdown className="p-1" style={{ direction } as any}>
              {Object.entries(KIND_META).map(([kind, meta]) => (
                <Menu.Item key={kind} onClick={() => setD({ ...d, items: [...d.items, { kind, expectedBuy: 0, currency: d.currency }] })}>
                  <span className="text-[12px] font-bold">{isAr ? meta.ar : kind}</span>
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </div>

        <div className="space-y-1.5 max-h-[36vh] overflow-y-auto">
          {(d.items || []).map((it: any, i: number) => {
            const meta = KIND_META[it.kind] || KIND_META.PACKAGE;
            return (
              <div key={i} className="grid grid-cols-[90px_1fr_110px_auto] items-center gap-2">
                <span className="text-[11.5px] font-black text-slate-700">{isAr ? meta.ar : it.kind}</span>
                <input
                  value={it.supplierName || ''}
                  onChange={(e) => patchItem(i, { supplierName: e.target.value })}
                  placeholder={isAr ? 'المورد المتوقع' : 'Supplier'}
                  className={`${input} h-8 text-[11.5px]`}
                />
                <input
                  value={it.expectedBuy ?? ''}
                  onChange={(e) => patchItem(i, { expectedBuy: num(e.target.value) })}
                  placeholder="Expected"
                  dir="ltr"
                  className={`${input} h-8 font-mono text-end text-[11.5px]`}
                />
                <button
                  type="button"
                  onClick={() => setD({ ...d, items: d.items.filter((_: any, j: number) => j !== i) })}
                  className="w-7 h-7 rounded text-slate-300 hover:text-rose-600 flex items-center justify-center cursor-pointer"
                >
                  <IconTrash size={13} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer">
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => onSave(d)}
            className="h-9 px-4 rounded-xl bg-[#F45A0A] text-white text-xs font-black cursor-pointer"
          >
            {isAr ? 'حفظ النظام' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/* ── نافذة شراء عام / مصروف ── */
const ChargeModal: React.FC<{
  isAr: boolean;
  direction: string;
  chargeType: 'GLOBAL_PURCHASE' | 'EXPENSE';
  currency: string;
  onClose: () => void;
  onSave: (dto: any) => void;
}> = ({ isAr, direction, chargeType, currency, onClose, onSave }) => {
  const [d, setD] = useState<any>({ chargeType, currency, category: '', amount: 0, supplierName: '' });
  const isExp = chargeType === 'EXPENSE';
  const presets = isExp
    ? ['Advertising', 'Commission', 'Administrative', 'Other']
    : ['Bus', 'Group Hotel', 'Group Transport', 'Other'];
  return (
    <Modal opened onClose={onClose} centered radius="lg" withCloseButton={false} zIndex={10050}>
      <div className="space-y-3 font-sans" dir={direction as any}>
        <div className="font-black text-sm text-slate-900">{isExp ? (isAr ? 'مصروف عام' : 'Expense') : isAr ? 'شراء عام' : 'Global purchase'}</div>
        <Field label={isAr ? 'التصنيف *' : 'Category *'}>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {presets.map((c) => (
              <button key={c} type="button" onClick={() => setD({ ...d, category: c })} className={`text-[10.5px] font-bold rounded px-1.5 py-0.5 border cursor-pointer ${d.category === c ? 'bg-[#F45A0A] text-white border-[#F45A0A]' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                {c}
              </button>
            ))}
          </div>
          <input value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} className={input} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={isAr ? 'المبلغ *' : 'Amount *'}>
            <input value={d.amount || ''} onChange={(e) => setD({ ...d, amount: num(e.target.value) })} dir="ltr" className={`${input} font-mono text-end`} />
          </Field>
          <Field label={isAr ? 'المورد' : 'Supplier'}>
            <input value={d.supplierName} onChange={(e) => setD({ ...d, supplierName: e.target.value })} className={input} />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer">{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button type="button" onClick={() => onSave(d)} className="h-9 px-4 rounded-xl bg-[#F45A0A] text-white text-xs font-black cursor-pointer">{isAr ? 'إضافة' : 'Add'}</button>
        </div>
      </div>
    </Modal>
  );
};

/* ── نافذة بيع مقعد ── */
const PassengerModal: React.FC<{
  isAr: boolean;
  direction: string;
  g: TourGroup;
  customerOptions: any[];
  onClose: () => void;
  onSave: (dto: any) => void;
}> = ({ isAr, direction, g, customerOptions, onClose, onSave }) => {
  const activeSystems = g.priceSystems.filter((s) => s.active);
  const [d, setD] = useState<any>({
    priceSystemId: activeSystems[0]?.id || '',
    passengerName: '',
    customerName: '',
    passport: '',
    agent: '',
    payType: 'CASH',
    salePrice: activeSystems[0] ? Number(activeSystems[0].salePrice) : 0,
  });
  const ps = g.priceSystems.find((s) => s.id === d.priceSystemId);
  return (
    <Modal opened onClose={onClose} centered radius="lg" size="md" withCloseButton={false} zIndex={10050}>
      <div className="space-y-3 font-sans" dir={direction as any}>
        <div className="font-black text-sm text-slate-900">{isAr ? 'بيع مقعد — مسافر جديد' : 'Sell a seat'}</div>

        <Field label={isAr ? 'نظام الأسعار *' : 'Price system *'}>
          <select
            value={d.priceSystemId}
            onChange={(e) => {
              const sel = g.priceSystems.find((s) => s.id === e.target.value);
              setD({ ...d, priceSystemId: e.target.value, salePrice: sel ? Number(sel.salePrice) : d.salePrice });
            }}
            className={`${input} cursor-pointer`}
          >
            {activeSystems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {money(s.salePrice, s.currency)}
              </option>
            ))}
          </select>
          {ps && (
            <p className="text-[10.5px] font-bold text-slate-500 mt-1">
              {isAr ? `ستُنشأ له ${ps.items.length} خدمات تلقائياً (Not Complete)` : `${ps.items.length} services auto-created`}
            </p>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label={isAr ? 'اسم المسافر *' : 'Passenger *'}>
            <input value={d.passengerName} onChange={(e) => setD({ ...d, passengerName: e.target.value })} className={input} />
          </Field>
          <Field label={isAr ? 'العميل / الدافع' : 'Customer'}>
            <SearchableCombobox
              value={d.customerName}
              onChange={(v) => setD({ ...d, customerName: v || '' })}
              options={customerOptions}
              placeholder=""
              allowCustomValue
            />
          </Field>
          <Field label={isAr ? 'الجواز' : 'Passport'}>
            <input value={d.passport} onChange={(e) => setD({ ...d, passport: e.target.value })} dir="ltr" className={`${input} font-mono`} />
          </Field>
          <Field label={isAr ? 'الوكيل' : 'Agent'}>
            <input value={d.agent} onChange={(e) => setD({ ...d, agent: e.target.value })} className={input} />
          </Field>
          <Field label={isAr ? 'سعر البيع *' : 'Sale price *'}>
            <input value={d.salePrice || ''} onChange={(e) => setD({ ...d, salePrice: num(e.target.value) })} dir="ltr" className={`${input} font-mono text-end`} />
          </Field>
          <Field label={isAr ? 'الدفع' : 'Pay'}>
            <select value={d.payType} onChange={(e) => setD({ ...d, payType: e.target.value })} className={`${input} cursor-pointer`}>
              <option value="CASH">{isAr ? 'نقدي (يُحصَّل فوراً)' : 'Cash'}</option>
              <option value="CREDIT">{isAr ? 'آجل (ذمة)' : 'Credit'}</option>
            </select>
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer">{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button
            type="button"
            disabled={!d.passengerName.trim() || !d.priceSystemId}
            onClick={() => onSave(d)}
            className="h-9 px-4 rounded-xl bg-[#F45A0A] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black cursor-pointer"
          >
            {isAr ? 'بيع وإنشاء الخدمات' : 'Sell'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/* ── إنشاء كروب جديد ── */
const NewGroupForm: React.FC<{
  direction: string;
  isAr: boolean;
  onClose: () => void;
  onCreated: (g: TourGroup) => void;
}> = ({ direction, isAr, onClose, onCreated }) => {
  const [d, setD] = useState<any>({
    groupName: '',
    groupType: 'FULL',
    country: '',
    travelDate: '',
    buyDate: new Date().toISOString().slice(0, 10),
    currency: 'USD',
  });
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-[9998] bg-slate-900/30 backdrop-blur-[2px] flex items-center justify-center font-sans" dir={direction as any}>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-[min(560px,92vw)] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-black text-sm text-slate-900">{isAr ? 'كروب جديد' : 'New group'}</span>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 flex items-center justify-center cursor-pointer">
            <IconX size={15} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={isAr ? 'اسم الكروب *' : 'Group name *'} className="col-span-2">
            <input value={d.groupName} onChange={(e) => setD({ ...d, groupName: e.target.value })} className={input} />
          </Field>
          <Field label={isAr ? 'النوع' : 'Type'}>
            <select value={d.groupType} onChange={(e) => setD({ ...d, groupType: e.target.value })} className={`${input} cursor-pointer`}>
              <option value="FULL">Full</option>
              <option value="LAND">{isAr ? 'بري' : 'Land'}</option>
              <option value="AIR">{isAr ? 'جوي' : 'Air'}</option>
            </select>
          </Field>
          <Field label={isAr ? 'الوجهة' : 'Country'}>
            <input value={d.country} onChange={(e) => setD({ ...d, country: e.target.value })} className={input} />
          </Field>
          <Field label={isAr ? 'تاريخ الشراء' : 'Buy date'}>
            <input type="date" value={d.buyDate} onChange={(e) => setD({ ...d, buyDate: e.target.value })} className={`${input} font-mono`} />
          </Field>
          <Field label={isAr ? 'تاريخ السفر' : 'Travel date'}>
            <input type="date" value={d.travelDate} onChange={(e) => setD({ ...d, travelDate: e.target.value })} className={`${input} font-mono`} />
          </Field>
          <Field label={isAr ? 'العملة' : 'Currency'}>
            <select value={d.currency} onChange={(e) => setD({ ...d, currency: e.target.value })} className={`${input} cursor-pointer`}>
              <option value="USD">USD</option>
              <option value="IQD">IQD</option>
            </select>
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer">{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button
            type="button"
            disabled={saving || !d.groupName.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                const created = await tourGroupsApi.create(d);
                showSuccessNotification(isAr ? 'أُنشئ الكروب' : 'Created', created.groupName);
                onCreated(created);
              } catch (e: any) {
                showErrorNotification(isAr ? 'تعذّر الإنشاء' : 'Failed', e?.message || '');
              } finally {
                setSaving(false);
              }
            }}
            className="h-9 px-4 rounded-xl bg-[#F45A0A] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black cursor-pointer flex items-center gap-1.5"
          >
            {saving ? <Loader size={14} color="white" /> : <IconCoins size={14} />}
            {isAr ? 'إنشاء والانتقال للملف' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupFileWorkspace;
