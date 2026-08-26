import React, { useState } from 'react';
import { CopilotCardShell, formatMoney } from './blockUtils.tsx';

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export const EmailConfirmBlock: React.FC<{
  payload: any;
  onPrompt?: (text: string) => void;
}> = ({ payload, onPrompt }) => {
  const [email, setEmail] = useState(String(payload.recipientEmail || ''));
  const valid = EMAIL_RE.test(email.trim());

  return (
    <CopilotCardShell>
      <div className="px-3 py-2 text-[12px] font-bold text-slate-700 border-b border-slate-100">
        إرسال كشف «{payload.accountName}» بالإيميل
      </div>
      <div className="p-3 space-y-2.5">
        <div className="text-[12px] text-slate-600">
          الفترة: <span className="font-mono tabular-nums">{payload.period}</span>
          {payload.closingBalance != null ? (
            <>
              {' '}
              · الرصيد: <span className="font-bold font-mono tabular-nums">{formatMoney(payload.closingBalance)}</span>
            </>
          ) : null}
        </div>
        {payload.needsRecipientEmail ? (
          <p className="text-[12px] text-amber-800 bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-2">
            لا يوجد بريد محفوظ لهذا الحساب. أدخل الإيميل ثم أكّد الإرسال.
          </p>
        ) : null}
        <label className="block">
          <span className="text-[11px] font-bold text-slate-500">البريد الإلكتروني</span>
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="mt-1 w-full h-[38px] rounded-lg border border-slate-200 px-3 text-[13px] font-mono text-slate-800 outline-none focus:border-[#F45A0A]"
          />
        </label>
        <button
          type="button"
          disabled={!valid}
          onClick={() => {
            const token = payload.accountId
              ? `[[entity:account:${payload.accountId}:${payload.accountId}]]`
              : '';
            onPrompt?.(`نعم أرسل الكشف إلى ${email.trim()}${token ? `\n${token}` : ''}`);
          }}
          className="w-full h-[38px] rounded-lg bg-[#F45A0A] text-white text-[12px] font-bold hover:bg-[#DD4F05] disabled:opacity-50"
        >
          نعم، أرسل الكشف
        </button>
      </div>
    </CopilotCardShell>
  );
};
