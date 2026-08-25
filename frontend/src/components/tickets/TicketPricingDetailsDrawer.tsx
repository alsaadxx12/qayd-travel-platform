import React from 'react';
import {
  Modal,
  Button,
  Badge,
} from '@mantine/core';
import {
  IconCalculator,
  IconCoins,
  IconCheck,
  IconSparkles,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';
import { FormattedNumberInput } from '../common/FormattedNumberInput';
import { PassengerLine } from './TicketPassengersTable';

interface TicketPricingDetailsDrawerProps {
  opened: boolean;
  onClose: () => void;
  passenger: PassengerLine | null;
  currency: string;
  onUpdatePassenger: (updated: PassengerLine, applyToAllSameType?: boolean) => void;
}

export const TicketPricingDetailsDrawer: React.FC<TicketPricingDetailsDrawerProps> = ({
  opened,
  onClose,
  passenger,
  currency,
  onUpdatePassenger,
}) => {
  if (!passenger) return null;

  const fareBuy = passenger.fareBuy || 0;
  const fareSell = passenger.fareSell || 0;
  const tax1 = passenger.tax1 || 0;
  const tax2 = passenger.tax2 || 0;
  const charge = passenger.charge || 0;
  const percentage = passenger.percentage || 0;

  const totalBuy = fareBuy + tax1 + tax2 + charge;
  const totalSell = fareSell + tax1 + tax2 + charge;
  const netProfit = totalSell - totalBuy;
  const profitMarginPercent = totalBuy > 0 ? Number(((netProfit / totalBuy) * 100).toFixed(1)) : 0;

  const handleFieldChange = (field: keyof PassengerLine, value: number) => {
    onUpdatePassenger({
      ...passenger,
      [field]: value,
    });
  };

  const handleApplyQuickPreset = (type: 'ADULT' | 'CHILD' | 'INFANT') => {
    let multiplier = 1.0;
    if (type === 'CHILD') multiplier = 0.75;
    if (type === 'INFANT') multiplier = 0.10;

    const baseBuy = Math.round(fareBuy * multiplier);
    const baseSell = Math.round(fareSell * multiplier);

    onUpdatePassenger({
      ...passenger,
      ticketType: type,
      fareBuy: baseBuy,
      fareSell: baseSell,
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 font-black text-sm text-slate-900">
          <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
            <IconCalculator size={18} />
          </div>
          <div>
            <span>التسعير التفصيلي للتذكرة — {passenger.name || 'المسافر'}</span>
            <span className="text-[11px] font-mono text-slate-500 font-bold block">
              نوع المسافر: {passenger.ticketType === 'ADULT' ? 'بالغ (Adult)' : passenger.ticketType === 'CHILD' ? 'طفل (Child)' : 'رضيع (Infant)'}
            </span>
          </div>
        </div>
      }
      size="lg"
      radius="xl"
      dir="rtl"
      centered
    >
      <div className="space-y-4 text-xs font-sans">
        {/* Quick Presets Row */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-black text-slate-700 flex items-center gap-1">
            <IconSparkles size={14} className="text-orange-600" />
            <span>إعداد سريع للتسعير:</span>
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="default"
              radius="md"
              leftSection={<IconUser size={13} />}
              onClick={() => handleApplyQuickPreset('ADULT')}
              className="font-bold text-xs"
            >
              تسعير بالغ (100%)
            </Button>
            <Button
              size="xs"
              variant="default"
              radius="md"
              onClick={() => handleApplyQuickPreset('CHILD')}
              className="font-bold text-xs"
            >
              تسعير طفل (75%)
            </Button>
            <Button
              size="xs"
              variant="default"
              radius="md"
              onClick={() => handleApplyQuickPreset('INFANT')}
              className="font-bold text-xs"
            >
              تسعير رضيع (10%)
            </Button>
          </div>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div>
            <label className="block text-[11px] font-black text-slate-700 mb-1">
              سعر الشراء الأساسي (Fare Buy):
            </label>
            <FormattedNumberInput
              value={fareBuy}
              onChange={(v) => handleFieldChange('fareBuy', Number(v) || 0)}
              size="sm"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-700 mb-1">
              سعر البيع الأساسي (Fare Sell):
            </label>
            <FormattedNumberInput
              value={fareSell}
              onChange={(v) => handleFieldChange('fareSell', Number(v) || 0)}
              size="sm"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-700 mb-1">
              ضريبة الشراء / المورد (Tax 1):
            </label>
            <FormattedNumberInput
              value={tax1}
              onChange={(v) => handleFieldChange('tax1', Number(v) || 0)}
              size="sm"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-700 mb-1">
              ضريبة البيع / العميل (Tax 2):
            </label>
            <FormattedNumberInput
              value={tax2}
              onChange={(v) => handleFieldChange('tax2', Number(v) || 0)}
              size="sm"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-700 mb-1">
              العمولة / الرسوم الإضافية (Charge):
            </label>
            <FormattedNumberInput
              value={charge}
              onChange={(v) => handleFieldChange('charge', Number(v) || 0)}
              size="sm"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-700 mb-1">
              نسبة العمولة أو الخصم (%):
            </label>
            <FormattedNumberInput
              value={percentage}
              onChange={(v) => handleFieldChange('percentage', Number(v) || 0)}
              size="sm"
              placeholder="0"
            />
          </div>
        </div>

        {/* Live Calculation Result Summary */}
        <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-slate-50/90 rounded-xl border border-slate-200">
          <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-center">
            <span className="text-[10.5px] text-slate-500 font-bold block">إجمالي تكلفة الشراء</span>
            <span className="text-sm font-black font-mono text-slate-900 mt-0.5 block">
              {totalBuy.toLocaleString()} {currency}
            </span>
          </div>

          <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-center">
            <span className="text-[10.5px] text-slate-500 font-bold block">إجمالي سعر البيع</span>
            <span className="text-sm font-black font-mono text-orange-600 mt-0.5 block">
              {totalSell.toLocaleString()} {currency}
            </span>
          </div>

          <div className={`p-2.5 rounded-lg border text-center ${
            netProfit >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-red-50 border-red-200 text-red-950'
          }`}>
            <span className="text-[10.5px] font-bold block">صافي الربح المتوقع</span>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <span className="text-sm font-black font-mono">
                {netProfit >= 0 ? `+${netProfit.toLocaleString()}` : netProfit.toLocaleString()} {currency}
              </span>
              <Badge size="xs" color={netProfit >= 0 ? 'emerald' : 'red'} variant="filled" className="font-mono text-[9px]">
                {profitMarginPercent}%
              </Badge>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <Button
            size="xs"
            variant="light"
            color="orange"
            radius="md"
            leftSection={<IconUsers size={14} />}
            onClick={() => {
              onUpdatePassenger(passenger, true);
              onClose();
            }}
            className="font-black text-xs"
          >
            تطبيق هذا التسعير على كافة المسافرين من نفس الفئة
          </Button>

          <Button
            size="xs"
            color="orange"
            variant="filled"
            radius="md"
            leftSection={<IconCheck size={14} />}
            onClick={onClose}
            className="bg-orange-500 hover:bg-orange-600 font-black text-xs text-white"
          >
            حفظ التسعير والتأكيد
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default TicketPricingDetailsDrawer;
