import React, { useState, useMemo, useRef } from 'react';
import { Modal, Button, TextInput, Textarea, Badge, Radio, Group } from '@mantine/core';
import {
  IconMail,
  IconSend,
  IconPhoto,
  IconX,
  IconUsers,
  IconCheck,
  IconAlertCircle,
  IconUpload,
  IconSparkles,
} from '@tabler/icons-react';
import { apiRequest } from '../../api/client';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';

interface PartnerItem {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  partnerType: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface EmailBroadcastModalProps {
  opened: boolean;
  onClose: () => void;
  partners: PartnerItem[];
  selectedPartnerIds?: string[];
}

export const EmailBroadcastModal: React.FC<EmailBroadcastModalProps> = ({
  opened,
  onClose,
  partners,
  selectedPartnerIds = [],
}) => {
  const [recipientFilter, setRecipientFilter] = useState<'ALL' | 'CUSTOMERS' | 'SUPPLIERS' | 'SELECTED'>('ALL');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter partners based on choice
  const targetPartners = useMemo(() => {
    switch (recipientFilter) {
      case 'CUSTOMERS':
        return partners.filter((p) => p.partnerType === 'CUSTOMER');
      case 'SUPPLIERS':
        return partners.filter((p) => p.partnerType === 'SUPPLIER');
      case 'SELECTED':
        return partners.filter((p) => selectedPartnerIds.includes(p.id));
      case 'ALL':
      default:
        return partners.filter((p) => p.partnerType === 'CUSTOMER' || p.partnerType === 'SUPPLIER');
    }
  }, [partners, recipientFilter, selectedPartnerIds]);

  // Count valid emails
  const validEmailPartners = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return targetPartners.filter((p) => p.email && emailRegex.test(p.email.trim()));
  }, [targetPartners]);

  // Handle Image Selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('حجم الصورة يجب ألا يتجاوز 5 ميغابايت');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Convert image to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const res = reader.result as string;
        // remove data URL prefix if any for API attachment
        const base64Content = res.split(',')[1] || res;
        resolve(base64Content);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Send Broadcast
  const handleSendBroadcast = async () => {
    if (!subject.trim()) {
      showErrorNotification('حقل مطلوب', 'يرجى كتابة عنوان الإعلان أولاً');
      return;
    }
    if (!message.trim()) {
      showErrorNotification('حقل مطلوب', 'يرجى كتابة نص الإعلان أو الرسالة');
      return;
    }
    if (validEmailPartners.length === 0) {
      showErrorNotification('لا يوجد مستلمون', 'لا توجد حسابات تمتلك بريداً إلكترونياً صالحاً ضمن الفئة المحددة');
      return;
    }

    setSending(true);
    try {
      let attachmentPayload: Array<{ name: string; content: string }> | undefined;
      if (imageFile) {
        const base64Data = await fileToBase64(imageFile);
        attachmentPayload = [
          {
            name: imageFile.name,
            content: base64Data,
          },
        ];
      }

      // Build HTML template
      const formattedHtml = `
        <div dir="rtl" style="font-family: 'IBM Plex Sans Arabic', Arial, sans-serif; max-width: 620px; margin: 0 auto; background-color: #ffffff; border: 1px solid #E5E7EB; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <div style="background-color: #F45A0A; padding: 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 20px; font-weight: bold;">قيد للسياحة والسفر</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">منصة إدارة السندات المحاسبية وخدمات السفر</p>
          </div>

          <!-- Content -->
          <div style="padding: 28px 24px; color: #1e293b; line-height: 1.7;">
            <h2 style="color: #0f172a; font-size: 18px; margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid #FFF3E8; padding-bottom: 8px;">
              ${subject}
            </h2>
            <div style="white-space: pre-line; font-size: 14px; color: #334155; margin-bottom: 20px;">
              ${message}
            </div>

            ${
              imagePreview
                ? `<div style="text-align: center; margin: 24px 0;">
                    <img src="${imagePreview}" alt="Announcement Attachment" style="max-width: 100%; border-radius: 12px; border: 1px solid #E2E8F0;" />
                  </div>`
                : ''
            }
          </div>

          <!-- Footer -->
          <div style="background-color: #F8FAFC; padding: 18px 24px; border-top: 1px solid #E2E8F0; text-align: center; font-size: 12px; color: #64748B;">
            <p style="margin: 0;">تم إرسال هذا الإعلان رسمياً من قيد للسياحة والسفر</p>
          </div>
        </div>
      `;

      // Recipients
      const recipients = validEmailPartners.map((p) => ({
        email: p.email!.trim(),
        name: p.nameAr,
      }));

      await apiRequest('/api/email/send', {
        method: 'POST',
        body: JSON.stringify({
          to: recipients,
          subject: subject.trim(),
          htmlContent: formattedHtml,
          textContent: message.trim(),
          attachment: attachmentPayload,
        }),
      });

      showSuccessNotification(
        'تم إرسال الإعلان بنجاح ✉️',
        `تم إرسال الإعلان إلى (${validEmailPartners.length}) حساب بنجاح`
      );

      // Reset
      setSubject('');
      setMessage('');
      setImageFile(null);
      setImagePreview(null);
      onClose();
    } catch (err: any) {
      console.error('Error sending announcement:', err);
      showErrorNotification('تعذر الإرسال', err?.message || 'حدث خطأ أثناء إرسال البريد الإلكتروني');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F45A0A] border border-orange-200/80 flex items-center justify-center shrink-0">
            <IconMail size={17} />
          </div>
          <div>
            <div className="font-black text-sm text-slate-900">إرسال إعلان عبر البريد الإلكتروني</div>
            <div className="text-[11px] text-slate-500 font-medium">مراسلة العملاء والموردين بشكل جماعي أو مخصص</div>
          </div>
        </div>
      }
      size="lg"
      radius="lg"
      centered
      dir="rtl"
      styles={{
        header: { borderBottom: '1px solid #E5E7EB', paddingBottom: '12px' },
        body: { padding: '20px' },
      }}
    >
      <div className="space-y-4 text-xs font-sans">
        
        {/* 1. Recipient Target Selection */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/90 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
              <IconUsers size={14} className="text-[#F45A0A]" />
              تحديد فئة المستلمين:
            </span>
            <Badge color="orange" variant="light" size="sm" className="font-bold">
              {validEmailPartners.length} يمتلكون بريداً
            </Badge>
          </div>

          <Radio.Group
            value={recipientFilter}
            onChange={(val: any) => setRecipientFilter(val)}
          >
            <Group gap="md">
              <Radio value="ALL" label={`جميع الأطراف (${partners.length})`} color="orange" size="xs" />
              <Radio value="CUSTOMERS" label="العملاء فقط" color="orange" size="xs" />
              <Radio value="SUPPLIERS" label="الموردون فقط" color="orange" size="xs" />
              {selectedPartnerIds.length > 0 && (
                <Radio value="SELECTED" label={`المحدد (${selectedPartnerIds.length})`} color="orange" size="xs" />
              )}
            </Group>
          </Radio.Group>

          {/* Smart Calculator Hint */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200/80">
            <IconSparkles size={14} className="text-amber-500 shrink-0" />
            <span>
              سيتم الإرسال إلى <strong className="font-mono font-black text-[#F45A0A]">{validEmailPartners.length}</strong> حساب يمتلك بريداً إلكترونياً صالحاً من أصل <strong className="font-mono text-slate-800">{targetPartners.length}</strong> طرف مستهدف.
            </span>
          </div>
        </div>

        {/* 2. Announcement Subject */}
        <div>
          <label className="block font-bold text-slate-700 mb-1.5 text-xs">
            عنوان الإعلان / الموضوع <span className="text-rose-500">*</span>
          </label>
          <TextInput
            placeholder="مثال: عروض وتخفيضات خاصة على تذاكر الطيران لموسم الصيف..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            size="sm"
            radius="md"
            className="font-medium"
          />
        </div>

        {/* 3. Message Body */}
        <div>
          <label className="block font-bold text-slate-700 mb-1.5 text-xs">
            نص الإعلان أو الرسالة <span className="text-rose-500">*</span>
          </label>
          <Textarea
            placeholder="اكتب تفاصيل الإعلان هنا..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            minRows={4}
            maxRows={8}
            autosize
            radius="md"
            size="sm"
            className="font-medium"
          />
        </div>

        {/* 4. Image Attachment & Preview */}
        <div>
          <label className="block font-bold text-slate-700 mb-1.5 text-xs">
            إرفاق صورة الإعلان (بوستر / بروشور اختياري):
          </label>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />

          {!imagePreview ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-20 rounded-xl border-2 border-dashed border-slate-200 hover:border-[#F45A0A] bg-slate-50/50 hover:bg-orange-50/30 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-[#F45A0A] transition-all cursor-pointer"
            >
              <IconUpload size={20} />
              <span className="text-xs font-bold">انقر لاختيار صورة الإعلان (JPG, PNG)</span>
            </button>
          ) : (
            <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0 text-right">
                  <div className="font-bold text-xs text-slate-800 truncate">{imageFile?.name}</div>
                  <div className="text-[10.5px] text-slate-400 font-mono">
                    {imageFile ? `${(imageFile.size / 1024).toFixed(1)} KB` : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="إزالة الصورة"
              >
                <IconX size={15} />
              </button>
            </div>
          )}
        </div>

        {/* 5. Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-3">
          <Button
            variant="default"
            size="sm"
            radius="xl"
            onClick={onClose}
            className="font-medium"
          >
            إلغاء
          </Button>

          <Button
            color="orange"
            size="sm"
            radius="xl"
            loading={sending}
            disabled={validEmailPartners.length === 0}
            onClick={handleSendBroadcast}
            leftSection={<IconSend size={15} />}
            className="font-bold shadow-xs"
          >
            إرسال الإعلان إلى ({validEmailPartners.length}) بريد إلكتروني
          </Button>
        </div>
      </div>
    </Modal>
  );
};
