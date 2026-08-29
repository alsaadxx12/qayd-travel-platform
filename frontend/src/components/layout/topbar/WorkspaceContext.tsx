import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Menu, Badge, Modal } from '@mantine/core';
import {
  IconBuildingStore,
  IconCalendar,
  IconChevronDown,
  IconCheck,
  IconPlus,
  IconStar,
  IconArrowsExchange,
  IconMapPin,
  IconSearch,
  IconCoin,
  IconX,
  IconBulb,
  IconCircleCheck,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { branchesApi, Branch } from '../../../api/branches';
import { fiscalYearsApi, FiscalYear } from '../../../api/fiscalYears';
import { invalidateApiCache } from '../../../api/client';
import { useLanguageStore } from '../../../store/useLanguageStore';

export const WorkspaceContext: React.FC = () => {
  const navigate = useNavigate();
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    return localStorage.getItem('active_branch_id') || '';
  });
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [activeYear, setActiveYear] = useState<FiscalYear | null>(null);

  // Modal State for Branch Selection
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [tempSelectedBranchId, setTempSelectedBranchId] = useState<string>('');
  const [branchSearch, setBranchSearch] = useState('');

  const fetchBranches = useCallback(async () => {
    try {
      const data = await branchesApi.getLoginOptions();
      if (Array.isArray(data)) {
        setBranches(data);
        setSelectedBranchId((currentBranchId) => {
          if (data.length === 0) {
            localStorage.removeItem('active_branch_id');
            localStorage.removeItem('activeBranchId');
            localStorage.removeItem('activeBranchCode');
            localStorage.removeItem('activeBranchName');
            invalidateApiCache();
            return '';
          }

          if (!currentBranchId || !data.some((branch) => branch.id === currentBranchId)) {
            const mainBranch = data.find((b) => b.isMain) || data[0];
            localStorage.setItem('active_branch_id', mainBranch.id);
            localStorage.setItem('activeBranchId', mainBranch.id);
            localStorage.setItem('activeBranchCode', mainBranch.code);
            localStorage.setItem('activeBranchName', mainBranch.nameAr);
            invalidateApiCache();
            return mainBranch.id;
          }

          return currentBranchId;
        });
      }
    } catch (e) {
      console.error('Failed to load branches for topbar context', e);
    }
  }, []);

  const fetchFiscalYears = useCallback(async () => {
    try {
      const [yearsData, activeData] = await Promise.all([
        fiscalYearsApi.getAll(),
        fiscalYearsApi.getActive(),
      ]);
      if (Array.isArray(yearsData)) {
        setFiscalYears(yearsData);
      }
      if (activeData) {
        setActiveYear(activeData);
      }
    } catch (e) {
      console.error('Failed to load fiscal years', e);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
    fetchFiscalYears();

    const handleFiscalYearUpdate = () => {
      fetchFiscalYears();
    };

    window.addEventListener('fiscal-year-updated', handleFiscalYearUpdate);
    return () => {
      window.removeEventListener('fiscal-year-updated', handleFiscalYearUpdate);
    };
  }, [fetchBranches, fetchFiscalYears]);

  const openBranchSwitcherModal = () => {
    setTempSelectedBranchId(selectedBranchId);
    setBranchSearch('');
    setBranchModalOpen(true);
  };

  const handleConfirmBranchSwitch = (targetId?: string) => {
    const branchIdToApply = targetId || tempSelectedBranchId;
    if (!branchIdToApply) return;

    setSelectedBranchId(branchIdToApply);
    localStorage.setItem('active_branch_id', branchIdToApply);
    localStorage.setItem('activeBranchId', branchIdToApply);

    const branch = branches.find((b) => b.id === branchIdToApply);
    const branchTitle = isAr ? branch?.nameAr : (branch?.nameEn || branch?.nameAr);
    if (branch) {
      localStorage.setItem('activeBranchCode', branch.code);
      localStorage.setItem('activeBranchName', branchTitle || branch.nameAr);
    }
    invalidateApiCache();

    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        u.activeBranchId = branchIdToApply;
        u.activeBranchName = branchTitle;
        localStorage.setItem('user', JSON.stringify(u));
      } catch {}
    }

    // Smoothly notify system components and reload the entire page cleanly
    window.dispatchEvent(new CustomEvent('active-branch-changed', { detail: branchIdToApply }));
    setBranchModalOpen(false);
    window.location.reload();
  };

  const handleSelectFiscalYear = async (year: FiscalYear) => {
    try {
      await fiscalYearsApi.setActive(year.id);
      setActiveYear(year);
      window.dispatchEvent(new CustomEvent('fiscal-year-updated', { detail: year }));
    } catch (e: any) {
      console.error('Failed to switch active fiscal year', e);
    }
  };

  const activeBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];
  const activeBranchName = activeBranch
    ? isAr
      ? activeBranch.nameAr
      : activeBranch.nameEn || activeBranch.nameAr
    : isAr
    ? 'الفرع الرئيسي'
    : 'Main Branch';
  const activeBranchLogo = activeBranch?.logo;
  const activeBranchCurrency = (activeBranch as any)?.currency || 'IQD';

  const isReopenedYear = activeYear?.status === 'REOPENED';
  const isClosedYear = activeYear?.status === 'CLOSED';

  const filteredBranches = useMemo(() => {
    if (!branchSearch.trim()) return branches;
    const q = branchSearch.trim().toLowerCase();
    return branches.filter((b) => {
      const nAr = (b.nameAr || '').toLowerCase();
      const nEn = (b.nameEn || '').toLowerCase();
      const code = (b.code || '').toLowerCase();
      const city = ((b as any).city || '').toLowerCase();
      return nAr.includes(q) || nEn.includes(q) || code.includes(q) || city.includes(q);
    });
  }, [branches, branchSearch]);

  return (
    <>
      <Menu shadow="md" width={290} radius="md" position={direction === 'rtl' ? 'bottom-end' : 'bottom-start'}>
        <Menu.Target>
          <button
            className="w-full flex items-center justify-between gap-2.5 px-2 py-2 rounded-xl cursor-pointer transition-all duration-150 text-start select-none hover:bg-slate-100/70 group"
            dir={direction}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {/* Logo / Store Icon */}
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
                {activeBranchLogo ? (
                  <img
                    src={activeBranchLogo}
                    alt={activeBranchName}
                    width={40}
                    height={40}
                    decoding="async"
                    className="w-10 h-10 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center">
                    <IconBuildingStore size={22} className="text-[#F45A0A]" />
                  </div>
                )}
              </div>

              {/* Branch Name */}
              <span className="font-black text-[13.5px] text-slate-900 truncate leading-tight group-hover:text-[#F45A0A] transition-colors">
                {activeBranchName}
              </span>
            </div>

            <IconChevronDown size={14} className="text-slate-400 shrink-0 group-hover:text-slate-700 transition-colors" />
          </button>
        </Menu.Target>

        <Menu.Dropdown
          className="text-xs space-y-1 select-none shadow-xl border border-slate-200 rounded-2xl p-2"
          dir={direction}
          style={{
            fontFamily: language === 'ar' ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif",
          }}
        >
          {/* Active Branch Summary Header */}
          <div className="p-2 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isAr ? 'الفرع الحالي النشط' : 'Current Active Branch'}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-orange-100/80 text-[#F45A0A] flex items-center justify-center font-bold text-[10px] font-mono">
                {activeBranch?.code || 'BR'}
              </div>
              <div className="font-bold text-xs text-slate-900 truncate flex-1">
                {activeBranchName}
              </div>
              {activeBranch?.isMain && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  {isAr ? 'رئيسي' : 'Main'}
                </span>
              )}
            </div>
          </div>

          {/* Change Branch Action Button */}
          <button
            type="button"
            onClick={openBranchSwitcherModal}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-orange-50/80 hover:bg-orange-100/90 text-[#C2410C] border border-orange-200/90 font-bold text-xs transition-all cursor-pointer shadow-2xs hover:shadow-xs group"
          >
            <IconArrowsExchange size={16} className="text-[#F45A0A] transition-transform group-hover:rotate-180 duration-300" />
            <span>{isAr ? 'تبديل مساحة عمل الفرع' : 'Switch Branch Workspace'}</span>
          </button>

          <Menu.Item
            leftSection={<IconPlus size={14} className="text-slate-500" />}
            onClick={() => navigate('/branches-structure')}
            className="font-semibold text-xs text-slate-600 hover:bg-slate-50 rounded-xl py-1.5 cursor-pointer"
          >
            {isAr ? 'إدارة وهيكل الفروع' : 'Manage Branches Structure'}
          </Menu.Item>

          <Menu.Divider className="my-1" />

          {/* Fiscal Year Section */}
          <div className="flex items-center justify-between px-1.5 py-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isAr ? 'سنة العمل النشطة' : 'Active Fiscal Year'}
            </span>
            <button
              type="button"
              onClick={() => navigate('/fiscal-years')}
              className="text-[10px] text-[#F45A0A] font-bold hover:underline cursor-pointer"
            >
              {isAr ? 'إدارة السنوات' : 'Manage Years'}
            </button>
          </div>

          {fiscalYears.map((fy) => {
            const isSelected = fy.id === activeYear?.id;
            return (
              <Menu.Item
                key={fy.id}
                leftSection={
                  <IconCalendar
                    size={14}
                    className={
                      fy.status === 'REOPENED'
                        ? 'text-amber-600'
                        : fy.status === 'CLOSED'
                        ? 'text-slate-400'
                        : 'text-[#F45A0A]'
                    }
                  />
                }
                rightSection={
                  <div className="flex items-center gap-1.5">
                    <Badge
                      size="xs"
                      color={fy.status === 'OPEN' ? 'emerald' : fy.status === 'REOPENED' ? 'orange' : 'gray'}
                      variant="light"
                      className="text-[9.5px] rounded-md font-bold"
                    >
                      {fy.status === 'OPEN'
                        ? isAr
                          ? 'مفتوحة'
                          : 'Open'
                        : fy.status === 'REOPENED'
                        ? isAr
                          ? 'معاد فتحها'
                          : 'Reopened'
                        : isAr
                        ? 'مقفلة'
                        : 'Closed'}
                    </Badge>
                    {isSelected && <IconCheck size={12} className="text-[#F45A0A] font-black" />}
                  </div>
                }
                onClick={() => handleSelectFiscalYear(fy)}
                className={`rounded-xl py-1.5 px-2 cursor-pointer transition-colors ${
                  isSelected ? 'font-bold bg-orange-50/80 text-[#C2410C]' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="text-xs">{isAr ? `السنة المالية ${fy.name}` : `Fiscal Year ${fy.name}`}</span>
              </Menu.Item>
            );
          })}
        </Menu.Dropdown>
      </Menu>

      {/* ─── DEDICATED LUXURY BRANCH WORKSPACE SELECTOR MODAL ─── */}
      <Modal
        opened={branchModalOpen}
        onClose={() => setBranchModalOpen(false)}
        title={null}
        withCloseButton={false}
        size={640}
        radius="30px"
        centered
        padding={0}
        dir={direction}
        overlayProps={{
          backgroundOpacity: 0.66,
          blur: 10,
        }}
      >
        <div
          className="bg-white rounded-[30px] overflow-hidden border border-white/70 select-none shadow-2xl shadow-slate-950/25"
          dir={direction}
          style={{
            fontFamily: language === 'ar' ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif",
          }}
        >
          {/* MODAL HEADER */}
          <div className="relative px-7 pt-7 pb-5 bg-[radial-gradient(circle_at_top_right,rgba(244,90,10,0.14),transparent_34%),linear-gradient(180deg,#FFF8F3_0%,#FFFFFF_76%)] border-b border-slate-100">
            <button
              type="button"
              onClick={() => setBranchModalOpen(false)}
              className="absolute top-5 start-5 w-8 h-8 rounded-full bg-white/85 hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-slate-200/80 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
              title={isAr ? 'إغلاق' : 'Close'}
            >
              <IconX size={16} />
            </button>

            <div className="flex items-start justify-between gap-5 ps-10">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-[20px] bg-white border border-orange-200 text-[#F45A0A] flex items-center justify-center shadow-sm shrink-0 ring-8 ring-orange-100/45">
                  <IconBuildingStore size={30} className="stroke-[2.15]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[21px] font-black text-slate-950 tracking-tight">
                      {isAr ? 'التبديل بين فروع الشركة' : 'Switch Branch Workspace'}
                    </h3>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white text-[#C2410C] border border-orange-200/80 shadow-2xs">
                      {branches.length} {isAr ? 'فروع مسجلة' : 'Branches'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed max-w-[430px]">
                    {isAr
                      ? 'حدد مساحة عمل الفرع المطلوب لمباشرة الإدارة المالية والعمليات الحسابية'
                      : 'Select a branch to switch into its isolated accounting workspace and records'}
                  </p>
                </div>
              </div>
            </div>

            {/* SEARCH BAR (WHEN > 2 BRANCHES) */}
            {branches.length > 2 && (
              <div className="mt-4">
                <div className="relative">
                  <IconSearch size={16} className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    aria-label={isAr ? 'بحث عن فرع' : 'Search branches'}
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    placeholder={isAr ? 'بحث باسم الفرع أو الرمز أو المدينة...' : 'Search by branch name, code, or city...'}
                    className="w-full ps-10 pe-3 h-11 bg-white/90 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F45A0A]/20 focus:border-[#F45A0A] shadow-2xs transition-all"
                  />
                </div>
              </div>
            )}
          </div>

          {/* BRANCH CARDS LIST */}
          <div className="p-5 space-y-3 max-h-[390px] overflow-y-auto bg-slate-50/45">
            {filteredBranches.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <IconBuildingStore size={20} />
                </div>
                <div className="text-slate-400 text-xs font-bold">
                  {isAr ? 'لا توجد فروع مطابقة لخيارات البحث' : 'No matching branches found'}
                </div>
              </div>
            ) : (
              filteredBranches.map((b) => {
                const bName = isAr ? b.nameAr : b.nameEn || b.nameAr;
                const isSelected = b.id === tempSelectedBranchId;
                const isCurrentlyActive = b.id === selectedBranchId;
                const bCity = (b as any).city || (isAr ? 'المركز الرئيسي' : 'Headquarters');
                const bCurrency = (b as any).currency || 'IQD';

                return (
                  <div
                    key={b.id}
                    onClick={() => setTempSelectedBranchId(b.id)}
                    onDoubleClick={() => handleConfirmBranchSwitch(b.id)}
                    className={`group relative p-4 rounded-[22px] border transition-all duration-200 cursor-pointer flex items-center justify-between gap-4 overflow-hidden ${
                      isSelected
                        ? 'bg-white border-[#F45A0A] shadow-lg shadow-orange-500/10 ring-4 ring-orange-100/80'
                        : 'bg-white/92 border-slate-200/90 hover:border-orange-200 hover:bg-white shadow-2xs hover:shadow-md hover:-translate-y-0.5'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute inset-y-0 end-0 w-1.5 bg-[#F45A0A]" />
                    )}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Logo or Code Avatar */}
                      <div className="shrink-0">
                        {b.logo ? (
                          <div className="w-13 h-13 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-2xs flex items-center justify-center">
                            <img
                              src={b.logo}
                              alt={bName}
                              className="w-full h-full object-contain rounded-xl"
                            />
                          </div>
                        ) : (
                          <div
                            className={`w-13 h-13 rounded-2xl border flex flex-col items-center justify-center font-mono shrink-0 shadow-2xs ${
                              isSelected
                                ? 'bg-[#F45A0A] text-white border-[#F45A0A] shadow-md shadow-orange-500/20'
                                : 'bg-orange-50 text-[#C2410C] border-orange-200'
                            }`}
                          >
                            <span className="text-xs font-black leading-none">{b.code || 'BR'}</span>
                            <span className="text-[8.5px] opacity-80 mt-0.5 font-bold">FR</span>
                          </div>
                        )}
                      </div>

                      {/* Details Column */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-sm text-slate-900 truncate tracking-tight">
                            {bName}
                          </h4>

                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md border border-slate-200">
                            {b.code}
                          </span>

                          {b.isMain && (
                            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/90 shadow-2xs">
                              <IconStar size={10} className="fill-amber-500 text-amber-500" />
                              <span>{isAr ? 'الفرع الرئيسي' : 'Main Branch'}</span>
                            </span>
                          )}

                          {isCurrentlyActive && (
                            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span>{isAr ? 'الفرع الحالي' : 'Active Now'}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium flex-wrap">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-1">
                            <IconMapPin size={13} className="text-slate-400" />
                            <span className="truncate">{bCity}</span>
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-1 font-mono font-bold text-slate-700">
                            <IconCoin size={13} className="text-[#F45A0A]" />
                            <span>{bCurrency}</span>
                          </span>

                          {b.phone && (
                            <span className="inline-flex items-center rounded-lg bg-slate-50 border border-slate-100 px-2 py-1 font-mono text-[10.5px] text-slate-600">
                                {b.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Radio / Selection Indicator */}
                    <div className="shrink-0 ps-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
                          isSelected
                            ? 'bg-[#F45A0A] text-white shadow-sm ring-4 ring-orange-100 scale-105'
                            : 'border-2 border-slate-300 bg-white group-hover:border-orange-300'
                        }`}
                      >
                        {isSelected ? (
                          <IconCheck size={16} className="stroke-[3]" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-slate-200 group-hover:bg-orange-200"></div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* FOOTER ACTIONS */}
          <div className="px-6 py-4 bg-white border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
              <span className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                <IconBulb size={14} />
              </span>
              <span>{isAr ? 'انقر نقراً مزدوجاً على أي فرع للتبديل الفوري' : 'Double click any branch to switch immediately'}</span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 justify-end">
              <button
                type="button"
                onClick={() => setBranchModalOpen(false)}
                className="px-5 h-11 rounded-2xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition-all shadow-2xs"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={() => handleConfirmBranchSwitch()}
                disabled={!tempSelectedBranchId}
                className="px-6 h-11 rounded-2xl bg-gradient-to-r from-[#F45A0A] to-[#E04F05] hover:opacity-95 text-white font-extrabold text-xs cursor-pointer transition-all shadow-lg shadow-orange-500/20 active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <IconCircleCheck size={17} className="stroke-[2.4]" />
                <span>{isAr ? 'تأكيد التبديل للفرع' : 'Confirm Branch Switch'}</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};
