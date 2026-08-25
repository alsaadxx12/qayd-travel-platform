import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Modal,
  Button,
  Badge,
  TextInput,
  Tabs,
  Alert,
  FileInput,
  ActionIcon,
} from '@mantine/core';
import {
  IconCheck,
  IconAlertCircle,
  IconReceipt,
  IconSparkles,
  IconUpload,
  IconTrash,
  IconPhoto,
  IconCopy,
} from '@tabler/icons-react';
import { subscriptionsApi, PublicPlan } from '../../api/subscriptions';
import { MastercardPreviewCard } from './MastercardPreviewCard';

interface SubscriptionCheckoutModalProps {
  opened: boolean;
  onClose: () => void;
  selectedPlan: PublicPlan | null;
}

export const SubscriptionCheckoutModal: React.FC<SubscriptionCheckoutModalProps> = ({
  opened,
  onClose,
  selectedPlan,
}) => {
  const queryClient = useQueryClient();
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptFiles, setReceiptFiles] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch configured payment methods from backend
  const { data: paymentMethods = {} } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: subscriptionsApi.getPaymentMethods,
  });

  const master = paymentMethods.mastercard || {};
  const qi = paymentMethods.qiCard || {};
  const zain = paymentMethods.zainCash || {};
  const fib = paymentMethods.fib || {};

  // Build active tabs list
  const activeTabs = useMemo(() => {
    const list: Array<{ id: string; label: string; enabled: boolean }> = [];
    if (master.enabled !== false) list.push({ id: 'mastercard', label: 'ماستركارد (Qi Card)', enabled: true });
    if (qi.enabled !== false) list.push({ id: 'qiCard', label: 'كي كارد', enabled: true });
    if (zain.enabled !== false) list.push({ id: 'zainCash', label: 'زين كاش', enabled: true });
    if (fib.enabled !== false) list.push({ id: 'fib', label: 'مصرف FIB', enabled: true });
    return list;
  }, [master, qi, zain, fib]);

  const [selectedMethod, setSelectedMethod] = useState<string>('mastercard');

  // Submit checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: (payload: any) => subscriptionsApi.submitCheckout(payload),
    onSuccess: () => {
      setIsSuccess(true);
      setValidationError('');
      queryClient.invalidateQueries({ queryKey: ['current-tenant'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions-history'] });
      queryClient.invalidateQueries({ queryKey: ['pending-renewals'] });
      setTimeout(() => {
        setIsSuccess(false);
        setReceiptFiles([]);
        setTransactionRef('');
        setNotes('');
        onClose();
      }, 3000);
    },
    onError: (err: any) => {
      setValidationError(err?.message || 'حدث خطأ أثناء إرسال طلب التحويل. يرجى المحاولة مجدداً.');
    },
  });

  if (!selectedPlan) return null;

  const isTrial = selectedPlan.code === 'FREE_TRIAL';
  const price = isTrial ? 0 : selectedPlan.priceMonthly;
  const cycleText = isTrial
    ? '14 يوماً مجاناً'
    : selectedPlan.code === 'PRO' || selectedPlan.code === 'ENTERPRISE'
    ? 'كل 3 أشهر'
    : 'شهرياً';

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle Multi-file Upload to Base64 data URLs
  const handleFileUpload = (files: File[] | null) => {
    if (!files || files.length === 0) return;
    setValidationError('');

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setReceiptFiles((prev) => [...prev, e.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveReceipt = (index: number) => {
    setReceiptFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmPayment = () => {
    if (!isTrial) {
      if (receiptFiles.length === 0 && !transactionRef.trim()) {
        setValidationError('يرجى إرفاق صورة واحدة على الأقل من وصل التحويل أو كتابة رقم المعاملة.');
        return;
      }
    }

    setValidationError('');
    checkoutMutation.mutate({
      planCode: selectedPlan.code,
      amountCents: price * 100,
      paymentMethod: selectedMethod.toUpperCase(),
      transactionRef: transactionRef.trim() || 'MANUAL_RECEIPT',
      notes: notes.trim(),
      receiptUrls: receiptFiles,
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      radius="xl"
      size="lg"
      withCloseButton={false}
      padding={0}
      overlayProps={{
        backgroundOpacity: 0.55,
        blur: 6,
      }}
    >
      <div className="font-sans" dir="rtl">
        {/* ── Premium Header with Orange Accent Strip ── */}
        <div className="relative overflow-hidden rounded-t-xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#F45A0A]" />
          <div className="px-6 pt-5 pb-4 bg-white border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/80 flex items-center justify-center shrink-0">
                  <IconReceipt size={20} className="text-[#F45A0A]" />
                </div>
                <div>
                  <h2 className="font-black text-[15px] text-slate-900 leading-tight">
                    {isTrial ? 'تفعيل الفترة التجريبية المجانية' : `إتمام الاشتراك في ${selectedPlan.nameAr}`}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-bold mt-0.5">بوابة الدفع والتحويل المصرفي المعتمدة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{ outline: 'none', border: 'none' }}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors cursor-pointer outline-none focus:outline-none"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5 text-xs max-h-[70vh] overflow-y-auto">
          {/* Success Alert */}
          {isSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                <IconCheck size={16} className="text-emerald-600" stroke={3} />
              </div>
              <div>
                <span className="font-black text-emerald-900 text-xs block">تم إرسال إشعار الدفع بنجاح!</span>
                <span className="text-[11px] text-emerald-700 font-medium leading-relaxed block mt-0.5">
                  {isTrial
                    ? 'تم تفعيل فترتك التجريبية فورياً! يمكنك استخدام كافة الوظائف الآن.'
                    : 'تم استلام طلب التجديد ووصل التحويل. سيقوم فريق الإدارة بمطابقة الإشعار وتفعيل باقتك فورياً.'}
                </span>
              </div>
            </div>
          )}

          {/* Validation Error */}
          {validationError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5">
              <IconAlertCircle size={16} className="text-red-500 shrink-0" />
              <span className="text-red-700 font-bold text-xs">{validationError}</span>
            </div>
          )}

          {/* ── Plan Summary Card ── */}
          <div className="rounded-xl bg-white border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                  <IconSparkles size={18} className="text-[#F45A0A]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900">{selectedPlan.nameAr}</span>
                    <Badge size="xs" color="orange" variant="light" className="font-bold text-[10px]">
                      {selectedPlan.code}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium block mt-0.5">{cycleText}</span>
                </div>
              </div>

              <div className="text-left" dir="ltr">
                <span className="font-mono font-black text-[26px] text-slate-900 tabular-nums lining-nums leading-none block">
                  ${price}
                </span>
                <span className="text-[10px] text-slate-400 font-bold block text-center">USD</span>
              </div>
            </div>
          </div>

          {/* If Free Trial */}
          {isTrial ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-center justify-center mx-auto">
                <IconSparkles size={28} className="text-[#F45A0A]" />
              </div>
              <h4 className="font-black text-slate-900 text-sm">الفترة التجريبية مجانية 100%!</h4>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                لا تتطلب أي بطاقة دفع أو تحويل مسبق. يمكنك تجربة كافة الوظائف الأساسية مباشرة لمدة 14 يوماً.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* ── Payment Method Selector ── */}
              <div>
                <span className="font-black text-slate-800 text-xs block mb-2">
                  اختر وسيلة الدفع المتاحة:
                </span>

                {activeTabs.length > 0 ? (
                  <>
                    {/* Method Selector Pills */}
                    <div className="bg-slate-50 p-1 rounded-xl border border-slate-200/80 flex items-center gap-1 select-none mb-3">
                      {activeTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setSelectedMethod(tab.id)}
                          style={{ outline: 'none', border: 'none' }}
                          className={`flex-1 h-[34px] rounded-lg font-bold text-[11px] whitespace-nowrap transition-colors duration-150 cursor-pointer outline-none focus:outline-none ${
                            selectedMethod === tab.id
                              ? 'bg-[#F45A0A] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Method Content */}
                    <div className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
                      {selectedMethod === 'mastercard' && master.enabled !== false && (
                        <div className="p-3">
                          <MastercardPreviewCard
                            cardHolder={master.cardHolder || 'AZIZ KHAMEES SEDEQ'}
                            cardNumber={master.cardNumber || master.fullCardNumber || '5826553934'}
                            bankName={master.bankName || 'مصرف الرافدين'}
                            instructions={master.instructions}
                          />
                        </div>
                      )}

                      {selectedMethod === 'qiCard' && qi.enabled !== false && (
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-slate-800 text-xs">{qi.accountName || 'حساب كي كارد'}</span>
                            <Badge color="orange" variant="light" size="xs" className="font-bold">QiCard</Badge>
                          </div>
                          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                            <span className="font-mono font-bold text-sm text-slate-900 tabular-nums">{qi.accountNumber || '5826553934'}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(qi.accountNumber || '5826553934', 'qi')}
                              className="px-3 py-1.5 text-[11px] bg-[#F45A0A] hover:bg-orange-600 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <IconCopy size={12} />
                              <span>{copiedId === 'qi' ? '✓ تم!' : 'نسخ'}</span>
                            </button>
                          </div>
                          {qi.instructions && (
                            <p className="text-[11px] text-slate-500 leading-relaxed bg-orange-50/50 p-2.5 rounded-lg border border-orange-100">{qi.instructions}</p>
                          )}
                        </div>
                      )}

                      {selectedMethod === 'zainCash' && zain.enabled !== false && (
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-slate-800 text-xs">{zain.walletName || 'محفظة زين كاش التجارية'}</span>
                            <Badge color="orange" variant="light" size="xs" className="font-bold">ZainCash</Badge>
                          </div>
                          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                            <span className="font-mono font-bold text-sm text-slate-900 tabular-nums">{zain.phoneNumber || '07800003901'}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(zain.phoneNumber || '07800003901', 'zain')}
                              className="px-3 py-1.5 text-[11px] bg-[#F45A0A] hover:bg-orange-600 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <IconCopy size={12} />
                              <span>{copiedId === 'zain' ? '✓ تم!' : 'نسخ'}</span>
                            </button>
                          </div>
                          {zain.instructions && (
                            <p className="text-[11px] text-slate-500 leading-relaxed bg-orange-50/50 p-2.5 rounded-lg border border-orange-100">{zain.instructions}</p>
                          )}
                        </div>
                      )}

                      {selectedMethod === 'fib' && fib.enabled !== false && (
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-slate-800 text-xs">{fib.accountName || 'First Iraqi Bank (FIB)'}</span>
                            <Badge color="orange" variant="light" size="xs" className="font-bold">FIB</Badge>
                          </div>
                          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                            <span className="font-mono font-bold text-[11px] text-slate-900 tabular-nums">{fib.iban || 'IQ88FIBB0000998877665544'}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(fib.iban || 'IQ88FIBB0000998877665544', 'fib')}
                              className="px-3 py-1.5 text-[11px] bg-[#F45A0A] hover:bg-orange-600 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <IconCopy size={12} />
                              <span>{copiedId === 'fib' ? '✓ تم!' : 'نسخ'}</span>
                            </button>
                          </div>
                          {fib.instructions && (
                            <p className="text-[11px] text-slate-500 leading-relaxed bg-orange-50/50 p-2.5 rounded-lg border border-orange-100">{fib.instructions}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-5 text-center text-slate-400 bg-white border border-slate-200 rounded-xl font-bold">
                    لا توجد طرق دفع مفعلة حالياً.
                  </div>
                )}
              </div>

              {/* ── Receipt Upload Zone ── */}
              <div className="rounded-xl border border-dashed border-[#F45A0A]/40 bg-orange-50/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                    <IconPhoto size={15} className="text-[#F45A0A]" />
                    <span>إرفاق وصل التحويل</span>
                  </span>
                  <Badge color="orange" size="xs" variant="light" className="font-bold">إجباري</Badge>
                </div>

                <FileInput
                  multiple
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  placeholder="اختر صورة الوصل أو اسحبها هنا..."
                  leftSection={<IconUpload size={15} className="text-[#F45A0A]" />}
                  onChange={handleFileUpload}
                  radius="lg"
                  size="xs"
                  className="bg-white rounded-lg"
                  styles={{
                    input: {
                      borderColor: 'rgb(226 232 240 / 0.9)',
                      fontSize: '11px',
                      height: '38px',
                    },
                  }}
                />

                {receiptFiles.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {receiptFiles.map((url, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white p-1 shadow-2xs">
                        <img src={url} alt={`Receipt ${idx + 1}`} className="w-full h-20 object-cover rounded-lg" />
                        <ActionIcon
                          color="red"
                          size="xs"
                          variant="filled"
                          className="absolute top-2 left-2 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveReceipt(idx)}
                        >
                          <IconTrash size={12} />
                        </ActionIcon>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Reference & Notes (Clean Cards) ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextInput
                  label="رقم إشعار التحويل / Transaction ID"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  radius="xl"
                  size="sm"
                  styles={{
                    label: { fontSize: '12px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' },
                    input: { borderColor: 'rgb(226 232 240 / 0.9)', height: '42px', fontSize: '13px', fontWeight: 500 },
                  }}
                />
                <TextInput
                  label="ملاحظات إضافية (اختياري)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  radius="xl"
                  size="sm"
                  styles={{
                    label: { fontSize: '12px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' },
                    input: { borderColor: 'rgb(226 232 240 / 0.9)', height: '42px', fontSize: '13px', fontWeight: 500 },
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer Actions ── */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200/80 rounded-b-xl flex items-center justify-end gap-2.5">
          <Button
            size="xs"
            variant="default"
            onClick={onClose}
            className="font-bold text-xs text-slate-600 rounded-xl h-9 px-5 border-slate-200 hover:bg-slate-100"
          >
            إلغاء
          </Button>
          <Button
            size="xs"
            color="orange"
            loading={checkoutMutation.isPending}
            onClick={handleConfirmPayment}
            className="bg-[#F45A0A] hover:bg-orange-600 font-black text-xs rounded-xl h-9 px-5 shadow-xs text-white"
          >
            {isTrial ? 'بدء التجربة المجانية فوراً ✨' : 'تأكيد إرسال التحويل والدفع'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SubscriptionCheckoutModal;
