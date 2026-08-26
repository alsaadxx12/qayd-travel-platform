import React, { useRef } from 'react';
import { ActionIcon, Loader, Tooltip } from '@mantine/core';
import { IconPaperclip, IconPlayerStop, IconSend, IconX } from '@tabler/icons-react';

export function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1024;
        let width = img.width;
        let height = img.height;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  loading: boolean;
  isArabic: boolean;
  attachedName?: string | null;
  attachedPreview?: string | null;
  onAttach: (file: File) => void;
  onClearAttach: () => void;
}

export const Composer: React.FC<Props> = ({
  value,
  onChange,
  onSend,
  onStop,
  loading,
  isArabic,
  attachedName,
  attachedPreview,
  onAttach,
  onClearAttach,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          onAttach(file);
          break;
        }
      }
    }
  };

  return (
    <div className="border-t border-slate-100 p-2">
      {(attachedName || attachedPreview) && (
        <div className="flex items-center gap-2 text-[11px] text-slate-600 px-2 pb-1.5">
          {attachedPreview?.startsWith('data:image/') && (
            <img src={attachedPreview} alt="" className="w-10 h-10 rounded-md object-cover border border-slate-200" />
          )}
          <span className="truncate">{attachedName || (isArabic ? 'صورة ملصوقة' : 'Pasted image')}</span>
          <button type="button" onClick={onClearAttach}>
            <IconX size={12} />
          </button>
        </div>
      )}
      <div className="flex items-end gap-1 bg-slate-50 rounded-2xl px-2 py-1.5 border border-slate-200 focus-within:border-[#F45A0A]">
        <Tooltip label={isArabic ? 'إرفاق' : 'Attach'}>
          <ActionIcon variant="subtle" color="gray" onClick={() => fileRef.current?.click()}>
            <IconPaperclip size={16} />
          </ActionIcon>
        </Tooltip>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!loading) onSend();
            }
          }}
          rows={1}
          onPaste={handlePaste}
          placeholder={isArabic ? '...اكتب سؤالك هنا أو الصق صورة' : 'Ask anything, or paste an image...'}
          className="flex-1 bg-transparent resize-none outline-none text-[13px] max-h-28 py-1"
        />
        {loading ? (
          <ActionIcon color="orange" variant="filled" onClick={onStop} radius="xl">
            <IconPlayerStop size={14} />
          </ActionIcon>
        ) : (
          <ActionIcon color="orange" variant="filled" onClick={onSend} radius="xl" disabled={!value.trim() && !attachedName && !attachedPreview}>
            {false ? <Loader size={12} color="white" /> : <IconSend size={14} />}
          </ActionIcon>
        )}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.csv,.txt"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAttach(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
};
