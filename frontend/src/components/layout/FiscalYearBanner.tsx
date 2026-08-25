import React, { useState, useEffect } from 'react';
import { Button, Badge } from '@mantine/core';
import { IconAlertTriangle, IconLock, IconArrowBackUp, IconHistory, IconCalendar } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { fiscalYearsApi, FiscalYear } from '../../api/fiscalYears';
import { showSuccessNotification } from '../../utils/notifications';

export const FiscalYearBanner: React.FC = () => {
  const navigate = useNavigate();
  const [activeYear, setActiveYear] = useState<FiscalYear | null>(null);
  const [currentYear, setCurrentYear] = useState<FiscalYear | null>(null);

  const loadYears = async () => {
    try {
      const [allYears, active] = await Promise.all([
        fiscalYearsApi.getAll(),
        fiscalYearsApi.getActive(),
      ]);
      if (active) setActiveYear(active);
      if (Array.isArray(allYears)) {
        const cur = allYears.find((y) => y.isCurrent) || allYears[0];
        if (cur) setCurrentYear(cur);
      }
    } catch (e) {
      console.error('Failed to load fiscal year for banner', e);
    }
  };

  useEffect(() => {
    loadYears();

    const handleUpdate = () => {
      loadYears();
    };

    window.addEventListener('fiscal-year-updated', handleUpdate);
    return () => {
      window.removeEventListener('fiscal-year-updated', handleUpdate);
    };
  }, []);

  if (!activeYear || (!activeYear.isCurrent && activeYear.status === 'OPEN' && activeYear.id === currentYear?.id)) {
    return null;
  }

  const isReopened = activeYear.status === 'REOPENED';
  const isClosed = activeYear.status === 'CLOSED';
  const isPrevious = !activeYear.isCurrent && activeYear.id !== currentYear?.id;

  if (!isReopened && !isClosed && !isPrevious) {
    return null;
  }

  const handleReturnToCurrentYear = async () => {
    if (!currentYear) return;
    try {
      await fiscalYearsApi.setActive(currentYear.id);
      setActiveYear(currentYear);
      showSuccessNotification('تم العودة', `تمت العودة بنجاح إلى السنة المالية الحالية (${currentYear.name}).`);
      window.dispatchEvent(new CustomEvent('fiscal-year-updated', { detail: currentYear }));
    } catch (e: any) {
      console.error('Failed to switch back to current year', e);
    }
  };

  return (
    <div
      className={`sticky top-0 z-40 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-['IBM_Plex_Sans_Arabic',sans-serif] shadow-md border-b transition-all ${
        isReopened
          ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white border-amber-800'
          : isClosed
          ? 'bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950 text-slate-200 border-slate-700'
          : 'bg-gradient-to-r from-blue-700 to-indigo-800 text-white border-blue-900'
      }`}
      dir="rtl"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-xs ${
            isReopened ? 'bg-amber-400 text-slate-950 animate-pulse' : isClosed ? 'bg-slate-700 text-amber-400' : 'bg-blue-600 text-white'
          }`}
        >
          {isReopened ? <IconAlertTriangle size={17} /> : isClosed ? <IconLock size={16} /> : <IconCalendar size={16} />}
        </div>

        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="font-black text-xs sm:text-sm">
            {isReopened
              ? `أنت تعمل الآن داخل السنة المالية ${activeYear.name} (معاد فتحها للتعديل والتسويات)`
              : isClosed
              ? `وضع القراءة فقط: أنت تتصفح السنة المالية ${activeYear.name} (مقفلة محاسبياً)`
              : `أنت تعمل داخل السنة المالية السابقة ${activeYear.name}`}
          </span>
          <Badge size="xs" variant="filled" color={isReopened ? 'dark' : isClosed ? 'gray' : 'blue'} className="font-mono font-black">
            {activeYear.status}
          </Badge>
          {isReopened && activeYear.reopenReason && (
            <span className="text-[11px] opacity-90 truncate max-w-xs" title={activeYear.reopenReason}>
              • السبب: {activeYear.reopenReason}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="xs"
          variant="white"
          color="dark"
          leftSection={<IconHistory size={13} />}
          onClick={() => navigate(`/fiscal-years?yearId=${activeYear.id}`)}
          className="font-bold shadow-2xs text-xs h-7"
        >
          سجل وتفاصيل السنة
        </Button>

        {currentYear && currentYear.id !== activeYear.id && (
          <Button
            size="xs"
            color="emerald"
            variant="filled"
            leftSection={<IconArrowBackUp size={14} />}
            onClick={handleReturnToCurrentYear}
            className="font-black shadow-2xs text-xs h-7 bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            العودة للسنة الحالية ({currentYear.name})
          </Button>
        )}
      </div>
    </div>
  );
};
