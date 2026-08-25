import React, { useState, useMemo } from 'react';
import {
  TextInput,
  ActionIcon,
  Tooltip,
  Menu,
} from '@mantine/core';
import {
  ArrowLeft,
  ArrowRightLeft,
  Plus,
  Trash2,
  MapPin,
  Search,
  PlaneTakeoff,
  PlaneLanding,
} from 'lucide-react';
import { useLanguageStore } from '../../store/useLanguageStore';

export interface FlightAirport {
  code: string;
  nameAr: string;
  nameEn: string;
  country: string;
}

export const COMMON_AIRPORTS: FlightAirport[] = [
  // العراق
  { code: 'BGW', nameAr: 'مطار بغداد الدولي', nameEn: 'Baghdad Intl', country: 'العراق' },
  { code: 'NJF', nameAr: 'مطار النجف الأشرف', nameEn: 'Najaf Intl', country: 'العراق' },
  { code: 'BSR', nameAr: 'مطار البصرة الدولي', nameEn: 'Basra Intl', country: 'العراق' },
  { code: 'EBL', nameAr: 'مطار أربيل الدولي', nameEn: 'Erbil Intl', country: 'العراق' },
  { code: 'ISU', nameAr: 'مطار السليمانية', nameEn: 'Sulaymaniyah Intl', country: 'العراق' },

  // إيران
  { code: 'MHD', nameAr: 'مطار مشهد الدولي', nameEn: 'Mashhad Intl', country: 'إيران' },
  { code: 'IKA', nameAr: 'مطار طهران (الخميني)', nameEn: 'Tehran IKA', country: 'إيران' },
  { code: 'SYZ', nameAr: 'مطار شيراز الدولي', nameEn: 'Shiraz Intl', country: 'إيران' },
  { code: 'TBZ', nameAr: 'مطار تبريز الدولي', nameEn: 'Tabriz Intl', country: 'إيران' },
  { code: 'IFN', nameAr: 'مطار أصفهان الدولي', nameEn: 'Isfahan Intl', country: 'إيران' },

  // تركيا
  { code: 'IST', nameAr: 'مطار إسطنبول الدولي', nameEn: 'Istanbul Airport', country: 'تركيا' },
  { code: 'SAW', nameAr: 'مطار صبيحة غوكشن', nameEn: 'Sabiha Gokcen', country: 'تركيا' },
  { code: 'AYT', nameAr: 'مطار أنطاليا', nameEn: 'Antalya Airport', country: 'تركيا' },
  { code: 'TZX', nameAr: 'مطار طرابزون', nameEn: 'Trabzon Airport', country: 'تركيا' },

  // الخليج والشرق الأوسط
  { code: 'DXB', nameAr: 'مطار دبي الدولي', nameEn: 'Dubai Intl', country: 'الإمارات' },
  { code: 'SHJ', nameAr: 'مطار الشارقة الدولي', nameEn: 'Sharjah Intl', country: 'الإمارات' },
  { code: 'AUH', nameAr: 'مطار أبوظبي الدولي', nameEn: 'Abu Dhabi Intl', country: 'الإمارات' },
  { code: 'DOH', nameAr: 'مطار حمد الدولي (الدوحة)', nameEn: 'Hamad Intl Doha', country: 'قطر' },
  { code: 'JED', nameAr: 'مطار الملك عبد العزيز (جدة)', nameEn: 'Jeddah Intl', country: 'السعودية' },
  { code: 'MED', nameAr: 'مطار المدينة المنورة', nameEn: 'Medina Intl', country: 'السعودية' },
  { code: 'RUH', nameAr: 'مطار الملك خالد (الرياض)', nameEn: 'Riyadh Intl', country: 'السعودية' },
  { code: 'KWI', nameAr: 'مطار الكويت الدولي', nameEn: 'Kuwait Intl', country: 'الكويت' },
  { code: 'AMM', nameAr: 'مطار الملكة علياء (عمان)', nameEn: 'Amman Intl', country: 'الأردن' },
  { code: 'BEY', nameAr: 'مطار بيروت الدولي', nameEn: 'Beirut Intl', country: 'لبنان' },
  { code: 'CAI', nameAr: 'مطار القاهرة الدولي', nameEn: 'Cairo Intl', country: 'مصر' },

  // أوروبا والعالم
  { code: 'LHR', nameAr: 'مطار لندن هيثرو', nameEn: 'London Heathrow', country: 'بريطانيا' },
  { code: 'CDG', nameAr: 'مطار باريس شارل ديغول', nameEn: 'Paris CDG', country: 'فرنسا' },
  { code: 'FRA', nameAr: 'مطار فرانكفورت', nameEn: 'Frankfurt Airport', country: 'ألمانيا' },
  { code: 'AMS', nameAr: 'مطار أمستردام سخيبول', nameEn: 'Amsterdam Schiphol', country: 'هولندا' },
  { code: 'KUL', nameAr: 'مطار كوالالمبور', nameEn: 'Kuala Lumpur', country: 'ماليزيا' },
  { code: 'CAN', nameAr: 'مطار غوانزو', nameEn: 'Guangzhou Airport', country: 'الصين' },
];

interface FlightRouteSelectorProps {
  fromAirport: string;
  toAirport: string;
  stopovers?: string[];
  onChange: (routeData: { from: string; to: string; stops: string[]; fullRouteText: string }) => void;
  error?: string;
}

export const FlightRouteSelector: React.FC<FlightRouteSelectorProps> = ({
  fromAirport,
  toAirport,
  stopovers = [],
  onChange,
  error,
}) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [fromSearch, setFromSearch] = useState('');
  const [toSearch, setToSearch] = useState('');
  const [stopSearch, setStopSearch] = useState('');
  const [fromMenuOpened, setFromMenuOpened] = useState(false);
  const [toMenuOpened, setToMenuOpened] = useState(false);
  const [stopMenuOpened, setStopMenuOpened] = useState(false);

  const filterAirports = (search: string) => {
    const q = search.trim().toLowerCase();
    if (!q) return COMMON_AIRPORTS.slice(0, 12);
    return COMMON_AIRPORTS.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.nameAr.toLowerCase().includes(q) ||
        a.nameEn.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q),
    ).slice(0, 10);
  };

  const fromMatches = useMemo(() => filterAirports(fromSearch), [fromSearch]);
  const toMatches = useMemo(() => filterAirports(toSearch), [toSearch]);
  const stopMatches = useMemo(() => filterAirports(stopSearch), [stopSearch]);

  const findAirport = (codeOrName: string) => {
    if (!codeOrName) return null;
    const clean = codeOrName.trim().toUpperCase();
    return COMMON_AIRPORTS.find((a) => a.code === clean || a.nameAr === codeOrName || a.nameEn.toLowerCase() === codeOrName.toLowerCase());
  };

  const fromInfo = findAirport(fromAirport);
  const toInfo = findAirport(toAirport);

  const generateRouteText = (from: string, to: string, stops: string[]) => {
    const parts = [from || '???', ...stops.filter(Boolean), to || '???'];
    return parts.join(' - ');
  };

  const handleSelectFrom = (airport: FlightAirport) => {
    const newFrom = airport.code;
    setFromSearch('');
    setFromMenuOpened(false);
    onChange({
      from: newFrom,
      to: toAirport,
      stops: stopovers,
      fullRouteText: generateRouteText(newFrom, toAirport, stopovers),
    });
  };

  const handleSelectTo = (airport: FlightAirport) => {
    const newTo = airport.code;
    setToSearch('');
    setToMenuOpened(false);
    onChange({
      from: fromAirport,
      to: newTo,
      stops: stopovers,
      fullRouteText: generateRouteText(fromAirport, newTo, stopovers),
    });
  };

  const handleSwapAirports = () => {
    const tempFrom = fromAirport;
    const tempTo = toAirport;
    onChange({
      from: tempTo,
      to: tempFrom,
      stops: [...stopovers].reverse(),
      fullRouteText: generateRouteText(tempTo, tempFrom, [...stopovers].reverse()),
    });
  };

  const handleAddStopover = (stopCode: string) => {
    if (!stopCode) return;
    const nextStops = [...stopovers, stopCode];
    setStopSearch('');
    setStopMenuOpened(false);
    onChange({
      from: fromAirport,
      to: toAirport,
      stops: nextStops,
      fullRouteText: generateRouteText(fromAirport, toAirport, nextStops),
    });
  };

  const handleRemoveStopover = (idx: number) => {
    const nextStops = stopovers.filter((_, i) => i !== idx);
    onChange({
      from: fromAirport,
      to: toAirport,
      stops: nextStops,
      fullRouteText: generateRouteText(fromAirport, toAirport, nextStops),
    });
  };

  return (
    <div className="space-y-2 font-sans" dir={direction}>
      {/* Route Header with Add Stopover Link */}
      <div className="flex items-center justify-between">
        <label className="block text-[12.5px] font-medium text-[#6B7280]">
          {isAr ? 'مسار الرحلة الجوية' : 'Flight Route'} <span className="text-red-500">*</span>
        </label>

        {/* Add Stopover Menu */}
        <Menu
          opened={stopMenuOpened}
          onChange={setStopMenuOpened}
          position="bottom-end"
          width={280}
          shadow="sm"
          radius="md"
        >
          <Menu.Target>
            <button
              type="button"
              onClick={() => setStopMenuOpened(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-orange-600 transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>{isAr ? 'إضافة محطة توقف' : 'Add Stopover'}</span>
            </button>
          </Menu.Target>
          <Menu.Dropdown className="p-2 space-y-1" dir={direction}>
            <TextInput
              placeholder={isAr ? 'ابحث عن مطار الترانزيت...' : 'Search transit airport...'}
              leftSection={<Search size={14} className="text-slate-400" />}
              size="xs"
              value={stopSearch}
              onChange={(e) => setStopSearch(e.target.value)}
              autoFocus
              styles={{ input: { fontWeight: 500, fontSize: 12 } }}
            />
            <div className="max-h-48 overflow-y-auto space-y-0.5 pt-1">
              {stopMatches.map((a) => (
                <button
                  key={a.code}
                  type="button"
                  onClick={() => handleAddStopover(a.code)}
                  className="w-full text-right p-1.5 rounded hover:bg-slate-50 flex items-center justify-between text-xs cursor-pointer font-sans"
                >
                  <span className="font-medium text-slate-800">
                    {a.code} — {isAr ? a.nameAr : a.nameEn}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">{a.country}</span>
                </button>
              ))}
            </div>
          </Menu.Dropdown>
        </Menu>
      </div>

      {/* Horizontal / Stacked Flight Route: [من: مطار الإقلاع] ← [زر التبديل ⇄] ← [إلى: مطار الوصول] */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5">
        {/* Departure Airport Picker (من) */}
        <div className="flex-1 relative min-w-0">
          <Menu
            opened={fromMenuOpened}
            onChange={setFromMenuOpened}
            position="bottom-start"
            width="target"
            shadow="sm"
            radius="md"
          >
            <Menu.Target>
              <button
                type="button"
                onClick={() => setFromMenuOpened(true)}
                className={`w-full h-[46px] px-3.5 rounded-[11px] border flex items-center justify-between gap-2 transition-all duration-150 cursor-pointer ${
                  isAr ? 'text-right' : 'text-left'
                } ${
                  error && !fromAirport
                    ? 'bg-[#FAFAFA] border-red-400 hover:border-red-500'
                    : fromMenuOpened
                    ? 'bg-white border-[#F45A0A] ring-4 ring-[#F45A0A]/10'
                    : 'bg-[#FAFAFA] border-[#E5E7EB] hover:bg-white hover:border-[#D1D5DB]'
                }`}
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  <span className="text-xs text-slate-400 font-medium shrink-0">
                    {isAr ? 'من:' : 'From:'}
                  </span>
                  <span className="font-mono font-bold text-xs text-slate-900 bg-slate-200/70 px-1.5 py-0.5 rounded border border-slate-300/60 shrink-0">
                    {fromAirport || 'MHD'}
                  </span>
                  <span className="text-[13px] font-medium text-slate-900 truncate">
                    {fromInfo ? (isAr ? fromInfo.nameAr : fromInfo.nameEn) : (fromAirport || '')}
                  </span>
                </div>
                <PlaneTakeoff size={16} className="text-slate-400 shrink-0" />
              </button>
            </Menu.Target>

            <Menu.Dropdown className="p-2 space-y-1.5 rounded-[12px] shadow-[0_10px_30px_rgba(15,23,42,0.12)] border border-[#E5E7EB] bg-white font-sans min-w-[260px] max-w-[92vw]" dir={direction}>
              <TextInput
                placeholder={isAr ? 'ابحث بالاسم أو الرمز...' : 'Search by name or code...'}
                leftSection={<Search size={14} className="text-slate-400" />}
                size="xs"
                value={fromSearch}
                onChange={(e) => setFromSearch(e.target.value)}
                autoFocus
                styles={{
                  input: {
                    fontWeight: 500,
                    fontSize: 12,
                    borderRadius: 9,
                    borderColor: '#E5E7EB',
                    backgroundColor: '#FAFAFA',
                  },
                }}
              />

              <div className="max-h-56 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden space-y-0.5 pt-1">
                {fromMatches.map((airport) => (
                  <button
                    key={airport.code}
                    type="button"
                    onClick={() => handleSelectFrom(airport)}
                    className="w-full p-2 rounded-[9px] hover:bg-[#FFF3E8] transition-colors flex items-center justify-between gap-2 cursor-pointer select-none"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-slate-900">{airport.code}</span>
                        <span className="text-xs font-medium text-slate-800 truncate">
                          {isAr ? airport.nameAr : airport.nameEn}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-normal block">{airport.country}</span>
                    </div>
                    <MapPin size={14} className="text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            </Menu.Dropdown>
          </Menu>
        </div>

        {/* Clear Direction Arrow & Swap Button */}
        <div className="flex items-center justify-center gap-1 shrink-0 self-center sm:self-auto">
          <Tooltip label={isAr ? 'تبديل مطار المغادرة والوصول' : 'Swap departure & arrival'} position="top" withArrow>
            <ActionIcon
              variant="default"
              size="lg"
              radius="md"
              onClick={handleSwapAirports}
              disabled={!fromAirport && !toAirport}
              className="border-[#E5E7EB] bg-[#FAFAFA] text-slate-600 hover:text-[#F45A0A] hover:bg-white hover:border-[#D1D5DB] cursor-pointer h-[40px] w-[40px] sm:h-[46px] sm:w-[46px] rounded-[11px] transition-all duration-150"
            >
              <ArrowRightLeft size={16} />
            </ActionIcon>
          </Tooltip>
        </div>

        {/* Arrival Airport Picker (إلى) */}
        <div className="flex-1 relative min-w-0">
          <Menu
            opened={toMenuOpened}
            onChange={setToMenuOpened}
            position="bottom-start"
            width="target"
            shadow="sm"
            radius="md"
          >
            <Menu.Target>
              <button
                type="button"
                onClick={() => setToMenuOpened(true)}
                className={`w-full h-[46px] px-3.5 rounded-[11px] border flex items-center justify-between gap-2 transition-all duration-150 cursor-pointer ${
                  isAr ? 'text-right' : 'text-left'
                } ${
                  error && !toAirport
                    ? 'bg-[#FAFAFA] border-red-400 hover:border-red-500'
                    : toMenuOpened
                    ? 'bg-white border-[#F45A0A] ring-4 ring-[#F45A0A]/10'
                    : 'bg-[#FAFAFA] border-[#E5E7EB] hover:bg-white hover:border-[#D1D5DB]'
                }`}
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  <span className="text-xs text-slate-400 font-medium shrink-0">
                    {isAr ? 'إلى:' : 'To:'}
                  </span>
                  <span className="font-mono font-bold text-xs text-slate-900 bg-slate-200/70 px-1.5 py-0.5 rounded border border-slate-300/60 shrink-0">
                    {toAirport || 'BGW'}
                  </span>
                  <span className="text-[13px] font-medium text-slate-900 truncate">
                    {toInfo ? (isAr ? toInfo.nameAr : toInfo.nameEn) : (toAirport || '')}
                  </span>
                </div>
                <PlaneLanding size={16} className="text-slate-400 shrink-0" />
              </button>
            </Menu.Target>

            <Menu.Dropdown className="p-2 space-y-1.5 rounded-[12px] shadow-[0_10px_30px_rgba(15,23,42,0.12)] border border-[#E5E7EB] bg-white font-sans" dir={direction}>
              <TextInput
                placeholder={isAr ? 'ابحث بالاسم أو الرمز...' : 'Search by name or code...'}
                leftSection={<Search size={14} className="text-slate-400" />}
                size="xs"
                value={toSearch}
                onChange={(e) => setToSearch(e.target.value)}
                autoFocus
                styles={{
                  input: {
                    fontWeight: 500,
                    fontSize: 12,
                    borderRadius: 9,
                    borderColor: '#E5E7EB',
                    backgroundColor: '#FAFAFA',
                  },
                }}
              />

              <div className="max-h-56 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden space-y-0.5 pt-1">
                {toMatches.map((airport) => (
                  <button
                    key={airport.code}
                    type="button"
                    onClick={() => handleSelectTo(airport)}
                    className="w-full p-2 rounded-[9px] hover:bg-[#FFF3E8] transition-colors flex items-center justify-between gap-2 cursor-pointer select-none"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-slate-900">{airport.code}</span>
                        <span className="text-xs font-medium text-slate-800 truncate">
                          {isAr ? airport.nameAr : airport.nameEn}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-normal block">{airport.country}</span>
                    </div>
                    <MapPin size={14} className="text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>

      {/* Stopovers row if present */}
      {stopovers.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-xs text-slate-500 font-medium">
            {isAr ? 'محطات التوقف:' : 'Stopovers:'}
          </span>
          {stopovers.map((code, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded text-xs font-mono font-semibold"
            >
              <span>{code}</span>
              <button
                type="button"
                onClick={() => handleRemoveStopover(idx)}
                className="text-slate-400 hover:text-red-600 cursor-pointer"
                title={isAr ? 'حذف المحطة' : 'Remove stop'}
              >
                <Trash2 size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <span className="text-xs font-medium text-red-600 block">{error}</span>}
    </div>
  );
};

export default FlightRouteSelector;
