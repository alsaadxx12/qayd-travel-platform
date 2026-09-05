import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@mantine/core';
import { Search } from 'lucide-react';
import { accountsApi } from '../../api/accounts';

/**
 * حقلُ حسابٍ يبحث في الخادم لا في قائمةٍ محمَّلة مسبقاً.
 *
 * كان منتقي العميل يُحمّل آلاف الحسابات عند فتح النافذة (٣ث ونصف ميغابايت)
 * ثم يبني قائمةً بآلاف الخيارات — فيبطؤ فتحُ «إضافة مسافر». هنا لا يُطلب شيء
 * حتى يكتب المستخدم، ثم يُطلب المطابقون فقط بإمهالٍ قصير. يُعيد اسمَ الحساب
 * ومعرّفه معاً، ويسمح باسمٍ حرٍّ لمن ليس له حساب.
 */
export interface AccountPick {
  id: string | null;
  name: string;
}

interface Props {
  value: string;
  onPick: (pick: AccountPick) => void;
  scope?: 'ALL' | 'CUSTOMER' | 'SUPPLIER';
  placeholder?: string;
  inputClass?: string;
  disabled?: boolean;
  allowCustomValue?: boolean;
  direction?: string;
}

export const AccountSearchField: React.FC<Props> = ({
  value,
  onPick,
  scope = 'ALL',
  placeholder = '',
  inputClass = '',
  disabled,
  allowCustomValue = true,
  direction = 'rtl',
}) => {
  const [text, setText] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; nameAr: string; nameEn?: string; category?: string }>>([]);
  const seq = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const skipNext = useRef(false);

  useEffect(() => {
    setText(value || '');
  }, [value]);

  // إغلاق القائمة عند النقر خارجها.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // بحثٌ مُمهَل؛ يُعتمد آخر طلبٍ فقط فلا يسبق ردٌّ بطيء ردّاً أحدث.
  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const q = text.trim();
    if (!open) return;
    const mySeq = ++seq.current;
    setLoading(true);
    const h = window.setTimeout(() => {
      accountsApi
        .search(q, scope, 40)
        .then((rows) => {
          if (mySeq !== seq.current) return;
          setResults(rows);
        })
        .catch(() => {
          if (mySeq === seq.current) setResults([]);
        })
        .finally(() => {
          if (mySeq === seq.current) setLoading(false);
        });
    }, 220);
    return () => window.clearTimeout(h);
  }, [text, scope, open]);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={13} className="absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" style={{ insetInlineStart: 10 }} />
        <input
          value={text}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            if (allowCustomValue) onPick({ id: null, name: e.target.value });
          }}
          placeholder={placeholder}
          className={inputClass}
          style={{ paddingInlineStart: 30 }}
        />
      </div>

      {open && (
        <div
          className="absolute z-[50] mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          dir={direction}
        >
          {loading ? (
            <div className="h-16 flex items-center justify-center gap-2 text-[11.5px] font-bold text-slate-500">
              <Loader size="xs" color="orange" /> بحث…
            </div>
          ) : results.length === 0 ? (
            <div className="h-14 flex items-center justify-center text-[11.5px] font-bold text-slate-400">
              {text.trim() ? 'لا حساب يطابق' : 'اكتب للبحث عن حساب'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {results.map((r) => {
                const name = r.nameAr || r.nameEn || '';
                return (
                  <button
                    key={r.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      skipNext.current = true;
                      setText(name);
                      onPick({ id: r.id, name });
                      setOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-orange-50/70 text-start cursor-pointer transition-colors"
                  >
                    <span className="text-[12px] font-bold text-slate-800 truncate">{name}</span>
                    <span
                      className={`text-[9.5px] font-black rounded px-1.5 py-0.5 shrink-0 ${
                        r.category === 'SUPPLIER' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'
                      }`}
                    >
                      {r.category === 'SUPPLIER' ? 'مورد' : 'عميل'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AccountSearchField;
