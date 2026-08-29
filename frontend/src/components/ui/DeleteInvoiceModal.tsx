import React, { useEffect, useState } from 'react';
import { Modal } from '@mantine/core';
import { IconAlertTriangle, IconTrash } from '@tabler/icons-react';

interface Props {
  opened: boolean;
  onClose: () => void;
  /** Number the user must retype. Nothing is deleted until it matches exactly. */
  invoiceNumber: string;
  /** What is being deleted, in the user's words: «فاتورة تذكرة»، «حجز فندقي»… */
  docLabel: string;
  isArabic?: boolean;
  posted?: boolean;
  onConfirm: () => Promise<void> | void;
}

/**
 * Hard deletion of a financial document.
 *
 * This is irreversible and takes the linked journal entry with it, so the dialog
 * deliberately refuses to be dismissed by a stray click: the exact invoice number
 * must be retyped. That friction is the point — it is the only thing standing
 * between a mis-click and a hole in the ledger.
 */
export const DeleteInvoiceModal: React.FC<Props> = ({
  opened,
  onClose,
  invoiceNumber,
  docLabel,
  isArabic = true,
  posted = false,
  onConfirm,
}) => {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (opened) {
      setTyped('');
      setBusy(false);
    }
  }, [opened]);

  const matches = typed.trim() === String(invoiceNumber || '').trim() && !!invoiceNumber;

  const run = async () => {
    if (!matches || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={busy ? () => undefined : onClose}
      centered
      radius="lg"
      size="md"
      withCloseButton={false}
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
    >
      <div dir={isArabic ? 'rtl' : 'ltr'} className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-10 h-10 rounded-xl bg-red-50 border border-red-100 grid place-items-center text-red-600">
            <IconAlertTriangle size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-[#111827] leading-tight">
              {isArabic ? `حذف ${docLabel} نهائياً` : `Permanently delete this ${docLabel}`}
            </h3>
            <p className="text-[12px] text-[#6B7280] mt-1 leading-relaxed">
              {isArabic
                ? 'الحذف نهائي ولا يمكن التراجع عنه. سيُحذف السجل وقيده المحاسبي من قاعدة البيانات، وسينكسر تسلسل أرقام الفواتير عند هذا الرقم.'
                : 'This cannot be undone. The record and its journal entry are removed from the database, and the invoice numbering will skip this number.'}
            </p>
          </div>
        </div>

        {posted && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900 leading-relaxed">
            {isArabic
              ? 'تنبيه: هذه الفاتورة مُرحّلة ولها أثر في الحسابات. الأسلم محاسبياً إلغاؤها بقيد عكسي بدل حذفها، حتى يبقى أثر التدقيق سليماً.'
              : 'Warning: this document is posted and affects the accounts. Reversing it is the safer accounting action.'}
          </div>
        )}

        <div>
          <label className="block text-[12px] font-medium text-[#6B7280] mb-1.5">
            {isArabic ? 'للتأكيد، اكتب رقم الفاتورة:' : 'To confirm, type the invoice number:'}{' '}
            <span dir="ltr" className="font-mono tabular-nums font-bold text-[#111827]">
              {invoiceNumber}
            </span>
          </label>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') run();
            }}
            dir="ltr"
            placeholder={invoiceNumber}
            className="w-full h-[42px] px-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] font-mono tabular-nums text-[13.5px] font-bold text-[#111827] outline-none focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100 text-center"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 h-[42px] rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-bold text-[#374151] hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={run}
            disabled={!matches || busy}
            className="flex-1 h-[42px] rounded-xl bg-red-600 text-white text-[13px] font-bold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <IconTrash size={15} />
            {busy
              ? isArabic ? 'جارٍ الحذف…' : 'Deleting…'
              : isArabic ? 'حذف نهائي' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
