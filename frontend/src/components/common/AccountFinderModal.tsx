import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Loader } from '@mantine/core';
import { IconSearch, IconUser, IconTruck, IconX, IconArrowLeft } from '@tabler/icons-react';
import { matchesSearchTokens } from '../ui/SearchableCombobox';
import { accountsApi } from '../../api/accounts';
import { useLanguageStore } from '../../store/useLanguageStore';

export interface AccountFinderResult {
  /** معرّف الحساب في شجرة الحسابات. */
  id: string;
  code: string;
  name: string;
  category?: string;
  /** مورد أم عميل، كما استُنتج من تصنيف الحساب. */
  role: 'SUPPLIER' | 'CUSTOMER' | 'OTHER';
}

interface AccountFinderModalProps {
  opened: boolean;
  onClose: () => void;
  onSelect: (account: AccountFinderResult) => void;
  /** ما يُفتح عليه البحث، عادةً ما كتبه المستخدم في الحقل ولم يجده. */
  initialQuery?: string;
  /** التبويب المفتوح أولاً — حقل المورد يفتح على الموردين وحقل العميل على العملاء. */
  initialScope?: 'SUPPLIER' | 'CUSTOMER';
  title?: string;
}

const roleOf = (account: any): AccountFinderResult['role'] => {
  const category = String(account?.category || '').toUpperCase();
  const role = String(account?.accountRole || '').toUpperCase();
  const code = String(account?.code || '');
  if (category === 'SUPPLIER' || role === 'SUPPLIER' || code.startsWith('261') || code.startsWith('21')) {
    return 'SUPPLIER';
  }
  if (category === 'CUSTOMER' || role === 'CUSTOMER' || code.startsWith('161') || code.startsWith('14')) {
    return 'CUSTOMER';
  }
  return 'OTHER';
};

/**
 * البحث المتقدّم: حين لا تُسعف القائمةُ المنسدلة.
 *
 * حقل المورد يعرض الموردين وحدهم، وحقل العميل يعرض العملاء — وهذا صحيح في
 * الأغلب. لكن الحساب قد يكون مسجّلاً في الجهة الأخرى، أو باسمٍ لا يتذكّره
 * المستخدم كما كُتب. فهذه النافذة تفتح على **كل** حسابات الموردين والعملاء معاً،
 * وتبحث فيها بالكلمات لا بالسلسلة المتّصلة، ثم تُعيد ما يختاره.
 */
export const AccountFinderModal: React.FC<AccountFinderModalProps> = ({
  opened,
  onClose,
  onSelect,
  initialQuery = '',
  initialScope = 'SUPPLIER',
  title,
}) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<'ALL' | 'SUPPLIER' | 'CUSTOMER'>(initialScope);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!opened) return;
    setQuery(initialQuery);
    setScope(initialScope);
    window.setTimeout(() => inputRef.current?.focus(), 60);
  }, [opened, initialQuery, initialScope]);

  // الشجرة كاملة تُجلب مرة واحدة عند أول فتح، ثم تبقى في الذاكرة لبقية الجلسة.
  useEffect(() => {
    if (!opened || accounts.length > 0) return;
    let cancelled = false;
    setLoading(true);
    accountsApi
      .getFlat(undefined, undefined, true)
      .then((data: any) => {
        if (cancelled) return;
        setAccounts(Array.isArray(data) ? data : (data?.data || []));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [opened, accounts.length]);

  const pool = useMemo(() => {
    return accounts
      .filter((a: any) => !a.isGroup && !a.isParent)
      .map((a: any) => ({
        id: a.id,
        code: String(a.code || ''),
        name: (isAr ? a.nameAr || a.name : a.nameEn || a.nameAr || a.name) || '',
        category: a.category,
        role: roleOf(a),
      }))
      .filter((a) => a.role !== 'OTHER' && a.name);
  }, [accounts, isAr]);

  const results = useMemo(() => {
    const scoped = scope === 'ALL' ? pool : pool.filter((a) => a.role === scope);
    const q = query.trim();
    const matched = q ? scoped.filter((a) => matchesSearchTokens(`${a.name} ${a.code}`, q)) : scoped;
    return matched.slice(0, 300);
  }, [pool, scope, query]);

  const counts = useMemo(
    () => ({
      ALL: pool.length,
      SUPPLIER: pool.filter((a) => a.role === 'SUPPLIER').length,
      CUSTOMER: pool.filter((a) => a.role === 'CUSTOMER').length,
    }),
    [pool]
  );

  const scopes: Array<{ key: 'SUPPLIER' | 'CUSTOMER' | 'ALL'; label: string; icon: any }> = [
    { key: 'SUPPLIER', label: isAr ? 'الموردون' : 'Suppliers', icon: IconTruck },
    { key: 'CUSTOMER', label: isAr ? 'العملاء' : 'Customers', icon: IconUser },
    { key: 'ALL', label: isAr ? 'الكل' : 'All', icon: IconSearch },
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      radius="lg"
      size="lg"
      withCloseButton={false}
      overlayProps={{ backgroundOpacity: 0.4, blur: 2 }}
      zIndex={10050}
      padding={0}
    >
      <div className="font-sans" dir={direction}>
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center shrink-0">
              <IconSearch size={18} />
            </div>
            <div>
              <div className="text-sm font-black text-slate-900">
                {title || (isAr ? 'البحث المتقدّم في الحسابات' : 'Advanced account search')}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                {isAr
                  ? 'يبحث في حسابات الموردين والعملاء كافّة — بأي كلمة من الاسم أو برقم الحساب'
                  : 'Searches every supplier and customer account — by any word of the name, or by code'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <IconX size={15} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative">
            <IconSearch
              size={16}
              className="absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              style={{ insetInlineStart: 12 }}
            />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAr ? 'اكتب أي كلمة من اسم الحساب أو رقمه…' : 'Type any word of the name, or the code…'}
              className="w-full h-10 rounded-xl border border-slate-200 bg-white text-[12.5px] font-bold text-slate-900 outline-none focus:border-[#F45A0A] focus:ring-2 focus:ring-orange-100 transition-all"
              style={{ paddingInlineStart: 36, paddingInlineEnd: 12 }}
            />
          </div>

          <div className="flex items-center gap-1.5">
            {scopes.map((s) => {
              const Icon = s.icon;
              const active = scope === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setScope(s.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-black border transition-all cursor-pointer ${
                    active
                      ? 'bg-[#F45A0A] text-white border-[#F45A0A] shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={13} />
                  <span>{s.label}</span>
                  <span
                    className={`font-mono text-[10px] px-1 rounded ${
                      active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {counts[s.key]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            {loading ? (
              <div className="h-64 flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
                <Loader size="sm" color="orange" />
                <span>{isAr ? 'جارٍ تحميل شجرة الحسابات…' : 'Loading the chart of accounts…'}</span>
              </div>
            ) : results.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center gap-1 text-slate-400">
                <IconSearch size={24} />
                <span className="text-xs font-bold">
                  {isAr ? 'لا حساب يطابق ما كتبت' : 'No account matches your search'}
                </span>
                {scope !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setScope('ALL')}
                    className="text-[11px] font-black text-[#F45A0A] hover:underline cursor-pointer mt-1"
                  >
                    {isAr ? 'ابحث في كل الحسابات' : 'Search all accounts'}
                  </button>
                )}
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {results.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      onSelect(a);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-orange-50/60 text-start cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${
                          a.role === 'SUPPLIER'
                            ? 'bg-violet-50 border-violet-200 text-violet-700'
                            : 'bg-sky-50 border-sky-200 text-sky-700'
                        }`}
                      >
                        {a.role === 'SUPPLIER' ? <IconTruck size={13} /> : <IconUser size={13} />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[12px] font-black text-slate-900 truncate">{a.name}</div>
                        <div className="text-[10px] font-mono font-bold text-slate-500" dir="ltr">
                          {a.code}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-[#F45A0A] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                      {isAr ? 'اختيار' : 'Select'}
                      <IconArrowLeft size={12} className={direction === 'rtl' ? '' : 'rotate-180'} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!loading && results.length > 0 && (
            <div className="text-[10.5px] text-slate-500 font-bold text-center">
              {isAr
                ? `${results.length.toLocaleString('en-US')} نتيجة${results.length === 300 ? ' (اكتب أكثر لتضييق البحث)' : ''}`
                : `${results.length.toLocaleString('en-US')} result(s)${results.length === 300 ? ' — type more to narrow' : ''}`}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AccountFinderModal;
