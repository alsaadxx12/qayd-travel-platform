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

export interface AttachmentItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'pdf';
  size?: number;
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
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const handleUpload = (files: File[]) => {
    if (!files || files.length === 0) return;

    const newItems: AttachmentItem[] = [];

    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) {
        showErrorNotification(
          isAr ? 'حجم الملف كبير' : 'File too large',
          isAr ? `الملف ${file.name} يتجاوز الحد الأقصى (15MB)` : `File ${file.name} exceeds maximum limit (15MB)`
        );
        continue;
      }

      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const reader = new FileReader();
      reader.onload = () => {
        newItems.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          url: reader.result as string,
          type: isPdf ? 'pdf' : 'image',
          size: file.size,
        });

        if (newItems.length === files.length) {
          onChange([...attachments, ...newItems]);
          showSuccessNotification(
            isAr ? 'تم إرفاق الملفات' : 'Files attached',
            isAr ? `تم إرفاق ${newItems.length} ملف بنجاح` : `${newItems.length} file(s) attached successfully`
          );
        }
      };
      reader.readAsDataURL(file);
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
              accept="image/*,application/pdf"
              onChange={handleUpload}
            >
              {(props) => (
                <Button
                  {...props}
                  size="xs"
                  variant="default"
                  radius="md"
                  leftSection={<IconPlus size={13} />}
                  className="font-semibold text-xs border-slate-200 text-slate-700 cursor-pointer"
                >
                  {isAr ? 'إرفاق ملف' : 'Attach File'}
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
