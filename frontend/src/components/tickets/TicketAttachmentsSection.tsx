import React, { useState } from 'react';
import {
  Button,
  ActionIcon,
  Tooltip,
  FileButton,
  Modal,
} from '@mantine/core';
import {
  IconPaperclip,
  IconPlus,
  IconTrash,
  IconPhoto,
  IconFileTypePdf,
  IconEye,
  IconDownload,
} from '@tabler/icons-react';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';

/**
 * Attachments are stored as data URLs INSIDE the record, so every one of them travels
 * in the same JSON body as the ticket and sits in the same database row. The server
 * accepts a 50MB body (see main.ts) and base64 inflates a file by a third, so the real
 * constraint is on the TOTAL, not on any one file: 35MB of files becomes ~47MB on the
 * wire, which is as close to that ceiling as is safe to go.
 *
 * These numbers are stated rather than hidden because they are the honest limit of
 * storing files inside records. Lifting them further is not a matter of raising a
 * constant — it needs the files to live somewhere of their own, with the record keeping
 * only a link.
 *
 * In practice nobody meets these limits: what people attach is a camera photo of a
 * transfer receipt, and those are downscaled below to well under a megabyte before
 * anything is stored.
 */
const MAX_ATTACHMENT_MB = 30;
const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024;
/** Across every attachment on the record, new and already present. */
const MAX_TOTAL_MB = 35;
const MAX_TOTAL_BYTES = MAX_TOTAL_MB * 1024 * 1024;

/** Long edge kept after downscaling. Plenty to read an account number off a slip. */
const MAX_IMAGE_EDGE = 2200;
const JPEG_QUALITY = 0.85;

/** Base64 of a data URL is ~4 bytes per 3, so this is the real stored size. */
const dataUrlBytes = (dataUrl: string): number => {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
};

const readAsDataUrl = (file: File): Promise<{ dataUrl: string; bytes: number }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      resolve({ dataUrl, bytes: dataUrlBytes(dataUrl) });
    };
    reader.readAsDataURL(file);
  });

/**
 * Downscales a photograph before it is stored.
 *
 * This is what makes «any size» true in practice: the files people actually attach
 * are camera photos of receipts, and a modern phone produces 8–15MB of them. Storing
 * that verbatim would bloat the record, slow every list that loads it, and eventually
 * hit the server's body limit. Two thousand pixels on the long edge keeps every digit
 * legible while cutting the size by an order of magnitude.
 *
 * If the compressed result is not actually smaller — a small screenshot, a scan that
 * was already optimised — the original is kept, so the file is never made worse.
 */
async function compressImage(file: File): Promise<{ dataUrl: string; bytes: number }> {
  const original = await readAsDataUrl(file);
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    // Receipts are photographed against dark desks; a white base keeps any
    // transparency from turning black when it becomes a JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const bytes = dataUrlBytes(dataUrl);
    return bytes < original.bytes ? { dataUrl, bytes } : original;
  } catch {
    // Any format the browser cannot decode is stored untouched rather than lost.
    return original;
  }
}

export interface AttachmentItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'pdf';
  size?: number;
}

/**
 * Cash across the counter leaves no document — there is nothing to attach and asking
 * for one only clutters the form. Every other method (تحويل، زين كاش، FIB، كي كارد،
 * آجل) produces a screenshot, a slip or a receipt, and that image is the only proof
 * the agency keeps that the money arrived.
 *
 * The rule lives here, next to the section it governs, so the tickets, visas, hotels
 * and refunds workspaces cannot drift apart on what counts as cash in hand.
 */
export function paymentNeedsAttachment(methodKey: string, method?: any): boolean {
  const key = String(methodKey || '').trim().toUpperCase();
  if (!key) return false;
  if (key === 'CASH_HAND' || key === 'CASH') return false;
  // A method that lands in the employee's own cashbox IS cash in hand, whatever it
  // was named in system settings.
  if (String(method?.targetAccountId || '').trim().toUpperCase() === 'EMPLOYEE_ASSIGNED') {
    return false;
  }
  return true;
}

interface TicketAttachmentsSectionProps {
  attachments: AttachmentItem[];
  onChange: (updated: AttachmentItem[]) => void;
  disabled?: boolean;
}

export const TicketAttachmentsSection: React.FC<TicketAttachmentsSectionProps> = ({
  attachments,
  onChange,
  disabled = false,
}) => {
  const [previewFile, setPreviewFile] = useState<AttachmentItem | null>(null);
  const [busy, setBusy] = useState(false);
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const handleUpload = async (files: File[]) => {
    if (!files || files.length === 0) return;
    setBusy(true);

    const newItems: AttachmentItem[] = [];
    const rejected: string[] = [];
    const overBudget: string[] = [];
    let shrunk = 0;
    // The budget is what is already on the record plus what is being added, because
    // the server sees them all in one body.
    let running = attachments.reduce((sum, a) => sum + (Number(a.size) || 0), 0);

    try {
      // Sequential and awaited. The previous version pushed from inside a FileReader
      // callback and only committed when `newItems.length === files.length` — so a
      // single skipped file meant that count was never reached and EVERY file the
      // user had just picked was silently thrown away.
      for (const file of files) {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        try {
          const prepared = isPdf ? await readAsDataUrl(file) : await compressImage(file);
          if (prepared.bytes > MAX_ATTACHMENT_BYTES) {
            rejected.push(file.name);
            continue;
          }
          if (running + prepared.bytes > MAX_TOTAL_BYTES) {
            overBudget.push(file.name);
            continue;
          }
          running += prepared.bytes;
          if (!isPdf && prepared.bytes < file.size * 0.9) shrunk++;
          newItems.push({
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: file.name,
            url: prepared.dataUrl,
            type: isPdf ? 'pdf' : 'image',
            size: prepared.bytes,
          });
        } catch {
          rejected.push(file.name);
        }
      }

      // Whatever succeeded is kept, even when part of the batch failed.
      if (newItems.length > 0) {
        onChange([...attachments, ...newItems]);
        showSuccessNotification(
          isAr ? 'تم إرفاق الملفات' : 'Files attached',
          isAr
            ? `تم إرفاق ${newItems.length} ملف${shrunk ? ` (ضُغطت ${shrunk} صورة تلقائياً)` : ''}`
            : `${newItems.length} file(s) attached${shrunk ? ` (${shrunk} image(s) compressed)` : ''}`,
        );
      }
      if (rejected.length > 0) {
        showErrorNotification(
          isAr ? 'تعذّر إرفاق بعض الملفات' : 'Some files could not be attached',
          isAr
            ? `${rejected.join('، ')} — الحد الأقصى للملف الواحد ${MAX_ATTACHMENT_MB}MB لأن المرفق يُحفظ داخل السجل نفسه.`
            : `${rejected.join(', ')} — the per-file ceiling is ${MAX_ATTACHMENT_MB}MB because attachments are stored inside the record.`,
        );
      }
      if (overBudget.length > 0) {
        showErrorNotification(
          isAr ? 'تجاوز مجموع المرفقات' : 'Attachment budget exceeded',
          isAr
            ? `${overBudget.join('، ')} — مجموع مرفقات السجل الواحد لا يتجاوز ${MAX_TOTAL_MB}MB. احذف مرفقاً قديماً أو وزّعها على أكثر من سجل.`
            : `${overBudget.join(', ')} — one record holds at most ${MAX_TOTAL_MB}MB of attachments in total.`,
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = (id: string) => {
    onChange(attachments.filter((a) => a.id !== id));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3 font-sans text-xs h-full flex flex-col justify-between" dir={direction}>
      <div>
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
          <div className="flex items-center gap-2">
            <IconPaperclip size={18} className="text-slate-600" />
            <h4 className="font-bold text-[15px] text-slate-900 leading-tight">
              {isAr ? 'المرفقات والوصولات' : 'Attachments & Receipts'}
            </h4>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-bold">
              {attachments.length}
            </span>
          </div>

          {!disabled && (
            <FileButton
              multiple
              accept="image/*,application/pdf,.pdf"
              onChange={handleUpload}
            >
              {(props) => (
                <Button
                  {...props}
                  size="xs"
                  variant="default"
                  radius="md"
                  loading={busy}
                  leftSection={busy ? undefined : <IconPlus size={13} />}
                  className="font-semibold text-xs border-slate-200 text-slate-700 cursor-pointer"
                >
                  {busy
                    ? (isAr ? 'جارٍ التحضير…' : 'Preparing…')
                    : (isAr ? 'إرفاق ملف' : 'Attach File')}
                </Button>
              )}
            </FileButton>
          )}
        </div>

        {/* Compact Attachments Grid */}
        {attachments.length === 0 ? (
          <div className="py-4 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50 flex items-center justify-center gap-2">
            <IconPaperclip size={18} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-500">
              {isAr ? 'لا توجد ملفات مرفقة' : 'No attached files'}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-2 hover:bg-white transition-all"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {att.type === 'pdf' ? (
                    <IconFileTypePdf size={18} className="text-red-500 shrink-0" />
                  ) : (
                    <IconPhoto size={18} className="text-emerald-600 shrink-0" />
                  )}
                  <span className="font-semibold text-xs text-slate-800 truncate block">{att.name}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Tooltip label={isAr ? 'معاينة' : 'Preview'} position="top" withArrow>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="gray"
                      radius="md"
                      onClick={() => setPreviewFile(att)}
                      className="text-slate-500 hover:text-slate-900"
                    >
                      <IconEye size={14} />
                    </ActionIcon>
                  </Tooltip>

                  {!disabled && (
                    <Tooltip label={isAr ? 'حذف' : 'Delete'} position="top" withArrow>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        radius="md"
                        onClick={() => handleRemove(att.id)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <Modal
        opened={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        title={<span className="font-bold text-sm text-slate-900 truncate">{previewFile?.name}</span>}
        size="lg"
        radius="lg"
        dir={direction}
        centered
      >
        {previewFile && (
          <div className="space-y-3 p-1">
            {previewFile.type === 'pdf' ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <IconFileTypePdf size={48} className="text-red-500 mx-auto" />
                <span className="font-bold text-xs text-slate-900 block">{previewFile.name}</span>
                <a
                  href={previewFile.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                >
                  <IconEye size={15} />
                  <span>{isAr ? 'فتح ملف الـ PDF' : 'Open PDF File'}</span>
                </a>
              </div>
            ) : (
              <div className="max-h-[65vh] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center p-2">
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-xs"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <a
                href={previewFile.url}
                download={previewFile.name}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950 px-3 py-1.5 bg-slate-100 rounded-lg"
              >
                <IconDownload size={14} />
                <span>{isAr ? 'تنزيل' : 'Download'}</span>
              </a>

              <Button size="xs" variant="default" radius="md" onClick={() => setPreviewFile(null)}>
                {isAr ? 'إغلاق' : 'Close'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TicketAttachmentsSection;
