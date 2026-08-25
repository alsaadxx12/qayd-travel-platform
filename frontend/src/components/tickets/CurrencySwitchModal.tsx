import React, { useState } from 'react';
import { Modal, Button } from '@mantine/core';
import { RefreshCw, Trash2, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { formatCurrency, getCurrencySymbol } from '../../utils/currencyUtils';

interface CurrencySwitchModalProps {
  opened: boolean;
  onClose: () => void;
  currentCurrency: string;
  targetCurrency: string;
  exchangeRate: number;
  totalSell: number;
  onConfirmConvert: (appliedRate: number) => void;
  onConfirmReset: () => void;
}

export const CurrencySwitchModal: React.FC<CurrencySwitchModalProps> = ({
  opened,
  onClose,
  currentCurrency,
  targetCurrency,
  exchangeRate = 1320,
  totalSell = 0,
  onConfirmConvert,
  onConfirmReset,
}) => {
  const [rate, setRate] = useState<number>(exchangeRate || 1320);

  // Calculate preview converted amount
  const isToUSD = targetCurrency === 'USD';
  const convertedTotal = isToUSD
    ? rate > 0
      ? totalSell / rate
      : 0
    : totalSell * rate;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-900 font-bold text-base" dir="rtl">
          <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center">
            <ArrowRightLeft size={18} />
          </div>
          <span>تغيير عملة الفاتورة</span>
        </div>
      }
      centered
      size="md"
      radius="lg"
      padding="lg"
      dir="rtl"
      styles={{
        header: {
          borderBottom: '1px solid #E5E7EB',
          paddingBottom: '12px',
        },
        body: {
          paddingTop: '16px',
        },
      }}
    >
      <div className="space-y-4 font-sans text-xs" dir="rtl">
        {/* Warning Banner */}
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2.5 text-amber-900">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-[13px] block">توجد مبالغ وأسعار مدخلة بالعملة الحالية ({currentCurrency})</span>
            <p className="text-[12px] text-amber-800 leading-relaxed">
              لتجنب الأخطاء المالية، كيف ترغب في تطبيق التغيير إلى عملة ({targetCurrency})؟
            </p>
          </div>
        </div>

        {/* Exchange Rate & Conversion Preview */}
        <div className="p-3.5 bg-[#FAFAFA] rounded-xl border border-[#E5E7EB] space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-700">سعر الصرف المعتمد:</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-mono" dir="ltr">1 USD =</span>
              <input
                type="number"
                dir="ltr"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value) || 1)}
                className="w-24 h-8 px-2 rounded-lg border border-slate-300 bg-white font-mono font-bold text-xs text-slate-900 text-center outline-none focus:border-[#F45A0A]"
              />
              <span className="text-xs text-slate-500">IQD</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">معاينة الإجمالي بعد التحويل:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-400 line-through">
                {formatCurrency(totalSell, currentCurrency)}
              </span>
              <span className="text-slate-400">←</span>
              <span className="font-mono font-bold text-slate-900 text-[13px]">
                {formatCurrency(convertedTotal, targetCurrency)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Options */}
        <div className="space-y-2 pt-2">
          {/* Option 1: Convert with Exchange Rate */}
          <button
            type="button"
            onClick={() => {
              onConfirmConvert(rate);
              onClose();
            }}
            className="w-full p-3 rounded-xl border border-orange-200 bg-orange-50/70 hover:bg-orange-100 text-right flex items-center justify-between transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-100 text-[#F45A0A] flex items-center justify-center shrink-0">
                <RefreshCw size={16} />
              </div>
              <div>
                <span className="font-bold text-[12.5px] text-slate-900 block group-hover:text-[#F45A0A]">
                  1. تحويل المبالغ بسعر الصرف (موصى به)
                </span>
                <span className="text-[11px] text-slate-500 block">
                  تحويل جميع أسعار الشراء والبيع والضرائب آلياً بحسب سعر الصرف.
                </span>
              </div>
            </div>
          </button>

          {/* Option 2: Reset / Clear Amounts */}
          <button
            type="button"
            onClick={() => {
              onConfirmReset();
              onClose();
            }}
            className="w-full p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-right flex items-center justify-between transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <Trash2 size={16} />
              </div>
              <div>
                <span className="font-bold text-[12.5px] text-slate-800 block">
                  2. تغيير العملة ومسح المبالغ المالية
                </span>
                <span className="text-[11px] text-slate-500 block">
                  الحفاظ على أسماء المسافرين وتصفير الأسعار لإعادة تسعيرها بالعملة الجديدة.
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Cancel footer */}
        <div className="pt-3 flex justify-end">
          <Button
            variant="subtle"
            color="gray"
            size="xs"
            onClick={onClose}
            className="text-slate-600 text-xs font-medium"
          >
            إلغاء
          </Button>
        </div>
      </div>
    </Modal>
  );
};
