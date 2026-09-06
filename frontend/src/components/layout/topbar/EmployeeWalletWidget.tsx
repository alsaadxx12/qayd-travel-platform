import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '@mantine/core';
import { Wallet } from 'lucide-react';
import { getMyProfitShare, type MyProfitShare } from '../../../api/reports';
import { useLanguageStore } from '../../../store/useLanguageStore';

/*
 * محفظة الموظف في الشريط العلوي: تُظهر حصّة الموظف الحالي المتراكمة من الأرباح
 * (ربح مستنداته × هامش ربحه). تُحدَّث كل بضع دقائق، والنقر يفتح تقرير الأرباح.
 */
const fmt = (n: number) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

export const EmployeeWalletWidget: React.FC = () => {
  const { language } = useLanguageStore();
  const isAr = language === 'ar';
  const navigate = useNavigate();
  const [data, setData] = useState<MyProfitShare | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getMyProfitShare()
        .then((d) => {
          if (!cancelled) setData(d);
        })
        .catch(() => undefined);
    };
    load();
    const iv = window.setInterval(load, 3 * 60 * 1000); // كل ٣ دقائق
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, []);

  // لا تُعرض المحفظة لمن لا هامش له ولا حصّة — كي لا تزحم الشريط بلا فائدة.
  if (!data || (data.share <= 0 && data.margin <= 0)) return null;

  return (
    <Tooltip
      label={
        isAr
          ? `حصّتك ${data.margin}% من ربحٍ إجماليّه ${fmt(data.profit)} — عبر ${data.docCount} مستنداً. انقر لتقرير الأرباح.`
          : `Your ${data.margin}% share of ${fmt(data.profit)} profit across ${data.docCount} docs. Click for the report.`
      }
      withArrow
      position="bottom"
    >
      <button
        type="button"
        onClick={() => navigate('/employee-profits')}
        className="h-[34px] px-2.5 rounded-[10px] bg-white border border-[#FED7AA] hover:bg-[#FFF3E8] text-[#F45A0A] flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
        title={isAr ? 'محفظة أرباحي' : 'My profit wallet'}
      >
        <Wallet size={15} strokeWidth={2.3} />
        <span className="font-mono font-black text-[12.5px] tabular-nums" dir="ltr">
          {fmt(data.share)}
        </span>
        <span className="text-[10px] font-bold text-[#F45A0A]/60 hidden sm:inline">{isAr ? 'محفظتي' : 'wallet'}</span>
      </button>
    </Tooltip>
  );
};

export default EmployeeWalletWidget;
