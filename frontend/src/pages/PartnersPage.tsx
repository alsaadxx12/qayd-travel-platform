import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { AccountingGrid, AccountingColumnDef, AccountingActionMenuItem } from '../components/common/AccountingGrid';
import { Button, Badge, Drawer, Modal, NumberInput, SegmentedControl } from '@mantine/core';
import {
  IconPlus, IconEye, IconFileText, IconCreditCard, IconEdit,
  IconUsers, IconBuildingStore, IconPlane, IconUserCheck,
  IconPhone, IconMail, IconMapPin, IconTrendingUp, IconTrendingDown,
} from '@tabler/icons-react';
import { SmartAccountWizardModal } from '../components/accounts/SmartAccountWizardModal';

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  bg: string;
  border: string;
}> = ({ label, value, icon, accent, bg, border }) => (
  <div
    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${bg} ${border} shadow-xs`}
  >
    <div
      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accent}`}
    >
      {icon}
    </div>
    <div className="min-w-0">
      <div
        className="text-[11px] font-bold text-slate-500 whitespace-nowrap"
      >
        {label}
      </div>
      <div
        className="text-xl font-black tabular-nums text-slate-900"
        style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
      >
        {value.toLocaleString('en-US')}
      </div>
    </div>
  </div>
);

// ─── Balance Cell ─────────────────────────────────────────────────────────────
const BalanceCell: React.FC<{ value: number; suffix?: string; prefix?: string }> = ({
  value, suffix = '', prefix = '',
}) => {
  if (value > 0.01)
    return (
      <span className="inline-flex items-center gap-1 font-black tabular-nums text-emerald-700 text-xs"
        style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}>
        {prefix}{value.toLocaleString('en-US')}{suffix}
        <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 px-1 py-0.5 rounded">لنا</span>
      </span>
    );
  if (value < -0.01)
    return (
      <span className="inline-flex items-center gap-1 font-black tabular-nums text-rose-700 text-xs"
        style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}>
        {prefix}{Math.abs(value).toLocaleString('en-US')}{suffix}
        <span className="text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-200 px-1 py-0.5 rounded">علينا</span>
      </span>
    );
  return (
    <span className="font-mono text-slate-300 text-xs">
      {prefix}0{suffix}
    </span>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const PartnersPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rawAccounts, setRawAccounts] = useState<any[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Credit Limit Modal
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [newCreditLimitIQD, setNewCreditLimitIQD] = useState<number | string>('');
  const [newCreditLimitUSD, setNewCreditLimitUSD] = useState<number | string>('');
  const [savingLimit, setSavingLimit] = useState(false);

  // Filters
  const [selectedCurrency, setSelectedCurrency] = useState<'ALL' | 'IQD' | 'USD'>('ALL');

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const accs = await apiRequest('/api/accounts');
      setRawAccounts(accs || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPartners(); }, []);

  const handleUpdateCreditLimit = async () => {
    if (!selectedPartner) return;
    setSavingLimit(true);
    try {
      const limitIQDVal = newCreditLimitIQD !== '' && newCreditLimitIQD !== null ? Number(newCreditLimitIQD) : null;
      const limitUSDVal = newCreditLimitUSD !== '' && newCreditLimitUSD !== null ? Number(newCreditLimitUSD) : null;
      await apiRequest(`/api/accounts/${selectedPartner.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ creditLimit: limitIQDVal, creditLimitUSD: limitUSDVal }),
      });
      setCreditModalOpen(false);
      fetchPartners();
      setSelectedPartner({ ...selectedPartner, creditLimitIQD: limitIQDVal, creditLimitUSD: limitUSDVal });
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء تحديث حدود الائتمان');
    } finally {
      setSavingLimit(false);
    }
  };

  const partners = useMemo(() => {
    return rawAccounts
      .filter((a) => !a.isParent)
      .map((a) => {
        let partnerType = 'OTHER';
        let partnerTypeLabel = 'مستفيد / آخر';
        let badgeColor = 'violet';

        if (
          a.code.startsWith('261') ||
          (a.nameAr || '').includes('طيران') ||
          (a.nameAr || '').includes('خطوط') ||
          (a.nameAr || '').includes('Airlines')
        ) {
          partnerType = 'AIRLINE'; partnerTypeLabel = 'شركة طيران'; badgeColor = 'blue';
        } else if (a.category === 'SUPPLIER' || a.code.startsWith('26')) {
          partnerType = 'SUPPLIER'; partnerTypeLabel = 'مورد (دائن)'; badgeColor = 'orange';
        } else if (
          a.category === 'CUSTOMER' ||
          a.code.startsWith('141') || a.code.startsWith('142') ||
          a.code.startsWith('143') || a.code.startsWith('14')
        ) {
          partnerType = 'CUSTOMER'; partnerTypeLabel = 'عميل (مدين)'; badgeColor = 'teal';
        } else if (
          a.code.startsWith('144') || a.category === 'EMPLOYEE' ||
          (a.nameAr || '').includes('مستفيد') || (a.nameAr || '').includes('سلف')
        ) {
          partnerType = 'BENEFICIARY'; partnerTypeLabel = 'مستفيد / موظف'; badgeColor = 'violet';
        }

        return {
          id: a.id,
          code: a.code,
          nameAr: a.nameAr,
          nameEn: a.nameEn || '',
          partnerType, partnerTypeLabel, badgeColor,
          currency: a.currency || 'MULTI',
          phone: a.phone || a.customer?.phone || a.supplier?.phone || '',
          email: a.email || a.customer?.email || a.supplier?.email || '',
          address: a.address || a.customer?.address || a.supplier?.address || '',
          contactPerson: a.contactPerson || '',
          creditLimitIQD: a.creditLimit ? Number(a.creditLimit) : null,
          creditLimitUSD: a.creditLimitUSD ? Number(a.creditLimitUSD) : null,
          debitIQD: Number(a.debitIQD ?? 0),
          creditIQD: Number(a.creditIQD ?? 0),
          balanceIQD: Number(a.balanceIQD ?? 0),
          debitUSD: Number(a.debitUSD ?? 0),
          creditUSD: Number(a.creditUSD ?? 0),
          balanceUSD: Number(a.balanceUSD ?? 0),
        };
      });
  }, [rawAccounts]);

  const metrics = useMemo(() => {
    let totalCusts = 0, totalSupps = 0, totalAirlines = 0, totalBenef = 0;
    partners.forEach((p) => {
      if (p.partnerType === 'CUSTOMER') totalCusts++;
      else if (p.partnerType === 'SUPPLIER') totalSupps++;
      else if (p.partnerType === 'AIRLINE') totalAirlines++;
      else if (p.partnerType === 'BENEFICIARY') totalBenef++;
    });
    return { total: partners.length, totalCusts, totalSupps, totalAirlines, totalBenef };
  }, [partners]);

  const columnDefs = useMemo<AccountingColumnDef[]>(() => {
    const numStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Consolas', monospace" };
    const cols: AccountingColumnDef[] = [
      {
        field: 'partnerDetails',
        headerText: 'بيانات الطرف / الشريك',
        width: 'w-60',
        isPinned: true,
        render: (r) => (
          <div className="flex flex-col py-0.5 leading-snug gap-0.5">
            <span className="font-bold text-slate-900 text-xs">{r.nameAr}</span>
            <span className="font-mono font-bold text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded w-fit border border-slate-200">
              {r.code}
            </span>
            {r.phone && r.phone !== '-' && (
              <span className="text-[10px] text-slate-400 font-mono tabular-nums">📞 {r.phone}</span>
            )}
          </div>
        ),
      },
      {
        field: 'partnerType',
        headerText: 'نوع الشريك',
        width: 'w-32',
        align: 'center',
        render: (r) => (
          <Badge
            size="sm"
            color={r.badgeColor}
            variant="light"
            radius="md"
            className="font-bold"
          >
            {r.partnerTypeLabel}
          </Badge>
        ),
      },
    ];

    if (selectedCurrency === 'ALL' || selectedCurrency === 'IQD') {
      cols.push(
        {
          field: 'debitIQD', headerText: 'مدين (د.ع)', width: 'w-32', align: 'left', isMonetary: true,
          render: (r) => (
            <span className="font-bold tabular-nums text-slate-700 text-xs" style={numStyle}>
              {r.debitIQD > 0 ? r.debitIQD.toLocaleString('en-US') : <span className="text-slate-300">—</span>}
            </span>
          ),
        },
        {
          field: 'creditIQD', headerText: 'دائن (د.ع)', width: 'w-32', align: 'left', isMonetary: true,
          render: (r) => (
            <span className="font-bold tabular-nums text-slate-700 text-xs" style={numStyle}>
              {r.creditIQD > 0 ? r.creditIQD.toLocaleString('en-US') : <span className="text-slate-300">—</span>}
            </span>
          ),
        },
        {
          field: 'balanceIQD', headerText: 'الرصيد الصافي (د.ع)', width: 'w-40', align: 'left', isMonetary: true,
          render: (r) => <BalanceCell value={r.balanceIQD} suffix=" د.ع" />,
        },
        {
          field: 'creditLimitIQD', headerText: 'حد الائتمان (د.ع)', width: 'w-36', align: 'left',
          render: (r) => (
            <span className="font-mono tabular-nums text-xs text-slate-600" style={numStyle}>
              {r.creditLimitIQD ? r.creditLimitIQD.toLocaleString('en-US') + ' د.ع' : <span className="text-slate-300 text-[10px]">غير محدد</span>}
            </span>
          ),
        },
      );
    }

    if (selectedCurrency === 'ALL' || selectedCurrency === 'USD') {
      cols.push(
        {
          field: 'debitUSD', headerText: 'مدين ($)', width: 'w-28', align: 'left', isMonetary: true,
          render: (r) => (
            <span className="font-bold tabular-nums text-slate-700 text-xs" style={numStyle}>
              {r.debitUSD > 0 ? `$${r.debitUSD.toLocaleString('en-US')}` : <span className="text-slate-300">—</span>}
            </span>
          ),
        },
        {
          field: 'creditUSD', headerText: 'دائن ($)', width: 'w-28', align: 'left', isMonetary: true,
          render: (r) => (
            <span className="font-bold tabular-nums text-slate-700 text-xs" style={numStyle}>
              {r.creditUSD > 0 ? `$${r.creditUSD.toLocaleString('en-US')}` : <span className="text-slate-300">—</span>}
            </span>
          ),
        },
        {
          field: 'balanceUSD', headerText: 'الرصيد الصافي ($)', width: 'w-36', align: 'left', isMonetary: true,
          render: (r) => <BalanceCell value={r.balanceUSD} prefix="$" />,
        },
        {
          field: 'creditLimitUSD', headerText: 'حد الائتمان ($)', width: 'w-32', align: 'left',
          render: (r) => (
            <span className="font-mono tabular-nums text-xs text-slate-600" style={numStyle}>
              {r.creditLimitUSD ? `$${r.creditLimitUSD.toLocaleString('en-US')}` : <span className="text-slate-300 text-[10px]">غير محدد</span>}
            </span>
          ),
        },
      );
    }

    return cols;
  }, [selectedCurrency]);

  const actionMenuItems: AccountingActionMenuItem[] = [
    {
      label: 'بطاقة الشريك',
      icon: IconEye,
      onClick: (row) => { setSelectedPartner(row); setDrawerOpen(true); },
    },
    {
      label: 'كشف الحساب',
      icon: IconFileText,
      color: 'blue',
      onClick: (row) => navigate(`/admin/reports?accountId=${row.id}`),
    },
    {
      label: 'تغيير الائتمان',
      icon: IconCreditCard,
      color: 'emerald',
      onClick: (row) => {
        setSelectedPartner(row);
        setNewCreditLimitIQD(row.creditLimitIQD ? String(row.creditLimitIQD) : '');
        setNewCreditLimitUSD(row.creditLimitUSD ? String(row.creditLimitUSD) : '');
        setCreditModalOpen(true);
      },
    },
  ];

  return (
    <div className="w-full flex flex-col gap-3">

      {/* ── Stats Row ── */}
      <div className="flex items-center gap-2.5 px-1 flex-wrap">
        <StatCard
          label="إجمالي الأطراف"
          value={metrics.total}
          icon={<IconUsers size={18} className="text-slate-600" />}
          accent="bg-slate-100"
          bg="bg-white"
          border="border-slate-200"
        />
        <StatCard
          label="العملاء (مدينون)"
          value={metrics.totalCusts}
          icon={<IconUserCheck size={18} className="text-teal-600" />}
          accent="bg-teal-50"
          bg="bg-white"
          border="border-teal-200"
        />
        <StatCard
          label="الموردون (دائنون)"
          value={metrics.totalSupps}
          icon={<IconBuildingStore size={18} className="text-[#F45A0A]" />}
          accent="bg-orange-50"
          bg="bg-white"
          border="border-orange-200"
        />
        <StatCard
          label="شركات الطيران"
          value={metrics.totalAirlines}
          icon={<IconPlane size={18} className="text-blue-600" />}
          accent="bg-blue-50"
          bg="bg-white"
          border="border-blue-200"
        />
        <StatCard
          label="المستفيدون"
          value={metrics.totalBenef}
          icon={<IconUsers size={18} className="text-violet-600" />}
          accent="bg-violet-50"
          bg="bg-white"
          border="border-violet-200"
        />
      </div>

      {/* ── Grid ── */}
      <AccountingGrid
        gridKey="partners_accounting_grid"
        data={partners}
        columnDefs={columnDefs}
        loading={loading}
        onRefresh={fetchPartners}
        actionMenuItems={actionMenuItems}
        onRowDoubleClick={(row) => { setSelectedPartner(row); setDrawerOpen(true); }}
        typeFilterOptions={[
          { label: 'جميع الأطراف والشركاء', value: 'ALL' },
          { label: 'العملاء (مدينون)', value: 'CUSTOMER' },
          { label: 'الموردون (دائنون)', value: 'SUPPLIER' },
          { label: 'شركات الطيران', value: 'AIRLINE' },
          { label: 'المستفيدون والموظفون', value: 'BENEFICIARY' },
        ]}
        customToolbarElements={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-2 py-1.5">
              <span className="text-[11px] font-bold text-slate-500 shrink-0">العملة:</span>
              <SegmentedControl
                size="xs"
                value={selectedCurrency}
                onChange={(val: any) => setSelectedCurrency(val || 'ALL')}
                data={[
                  { label: 'الكل', value: 'ALL' },
                  { label: 'IQD', value: 'IQD' },
                  { label: 'USD', value: 'USD' },
                ]}
                color="orange"
                className="font-bold"
              />
            </div>
            <Button
              size="xs"
              color="orange"
              leftSection={<IconPlus size={14} />}
              onClick={() => setCreateModalOpen(true)}
              className="font-bold"
              radius="xl"
            >
              إضافة طرف جديد
            </Button>
          </div>
        }
      />

      {/* ── Credit Limit Modal ── */}
      <Modal
        opened={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        title={
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
              <IconCreditCard size={16} className="text-[#F45A0A]" />
            </div>
            <div>
              <div className="font-black text-sm text-slate-900">تغيير حد الائتمان</div>
              {selectedPartner && (
                <div className="text-[11px] text-slate-500 font-medium">{selectedPartner.nameAr}</div>
              )}
            </div>
          </div>
        }
        size="sm"
        centered
        radius="lg"
      >
        {selectedPartner && (
          <div className="space-y-4 text-xs">
            {/* Current limits info */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div className="text-[10px] text-slate-400 font-bold mb-1">الحد الحالي (دينار)</div>
                <div className="font-black text-sm text-slate-800" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {selectedPartner.creditLimitIQD ? selectedPartner.creditLimitIQD.toLocaleString('en-US') : '—'}
                </div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div className="text-[10px] text-slate-400 font-bold mb-1">الحد الحالي (دولار)</div>
                <div className="font-black text-sm text-slate-800" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {selectedPartner.creditLimitUSD ? `$${selectedPartner.creditLimitUSD.toLocaleString('en-US')}` : '—'}
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5 text-[11px]">حد الائتمان الجديد بالدينار العراقي (IQD)</label>
              <NumberInput
                size="sm"
                value={newCreditLimitIQD}
                onChange={(val) => setNewCreditLimitIQD(val)}
                thousandSeparator=","
                min={0}
                allowNegative={false}
                radius="lg"
                placeholder="أدخل الحد بالدينار..."
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5 text-[11px]">حد الائتمان الجديد بالدولار الأمريكي (USD)</label>
              <NumberInput
                size="sm"
                value={newCreditLimitUSD}
                onChange={(val) => setNewCreditLimitUSD(val)}
                thousandSeparator=","
                min={0}
                allowNegative={false}
                radius="lg"
                placeholder="أدخل الحد بالدولار..."
              />
              <p className="text-[10px] text-slate-400 mt-1">اتركه فارغاً لإلغاء الحد.</p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="default" size="sm" onClick={() => setCreditModalOpen(false)} className="font-medium" fullWidth radius="xl">
                إلغاء
              </Button>
              <Button color="orange" size="sm" loading={savingLimit} onClick={handleUpdateCreditLimit} className="font-bold" fullWidth radius="xl">
                حفظ التغيير
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Smart Wizard Modal ── */}
      <SmartAccountWizardModal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={fetchPartners}
        defaultAccountType="INDIVIDUAL_CLIENT"
      />

      {/* ── Partner Detail Drawer ── */}
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
              <IconUsers size={16} className="text-[#F45A0A]" />
            </div>
            <div>
              <div className="font-black text-sm text-slate-900">بطاقة بيانات الطرف</div>
              {selectedPartner && (
                <div className="text-[11px] text-slate-400 font-medium">{selectedPartner.code}</div>
              )}
            </div>
          </div>
        }
        position="left"
        size="md"
        styles={{
          body: { padding: '16px' },
          header: { borderBottom: '1px solid #E5E7EB', paddingBottom: '12px' },
        }}
      >
        {selectedPartner && (
          <div className="space-y-3 text-xs">

            {/* Name + Badge */}
            <div className="p-4 bg-gradient-to-br from-slate-50 to-orange-50/30 border border-slate-200 rounded-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold mb-1">الاسم</div>
                  <div className="text-base font-black text-slate-900 leading-tight">{selectedPartner.nameAr}</div>
                  {selectedPartner.nameEn && (
                    <div className="text-[11px] text-slate-500 mt-0.5 font-medium">{selectedPartner.nameEn}</div>
                  )}
                </div>
                <Badge size="sm" color={selectedPartner.badgeColor} variant="light" radius="xl" className="font-bold shrink-0">
                  {selectedPartner.partnerTypeLabel}
                </Badge>
              </div>
            </div>

            {/* Balance Cards */}
            <div className="grid grid-cols-2 gap-2">
              {/* IQD Balance */}
              <div className="p-3 rounded-2xl border border-slate-200 bg-white space-y-1.5">
                <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                  الرصيد الصافي (دينار)
                </div>
                <div
                  className={`text-sm font-black tabular-nums leading-tight ${selectedPartner.balanceIQD > 0.01 ? 'text-emerald-700' : selectedPartner.balanceIQD < -0.01 ? 'text-rose-700' : 'text-slate-400'}`}
                  style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                >
                  {Math.abs(selectedPartner.balanceIQD).toLocaleString('en-US')}
                </div>
                {selectedPartner.balanceIQD !== 0 && (
                  <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded w-fit ${selectedPartner.balanceIQD > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                    {selectedPartner.balanceIQD > 0 ? 'لنا' : 'علينا'}
                  </div>
                )}
              </div>

              {/* USD Balance */}
              <div className="p-3 rounded-2xl border border-slate-200 bg-white space-y-1.5">
                <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  الرصيد الصافي (دولار)
                </div>
                <div
                  className={`text-sm font-black tabular-nums leading-tight ${selectedPartner.balanceUSD > 0.01 ? 'text-emerald-700' : selectedPartner.balanceUSD < -0.01 ? 'text-rose-700' : 'text-slate-400'}`}
                  style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
                >
                  ${Math.abs(selectedPartner.balanceUSD).toLocaleString('en-US')}
                </div>
                {selectedPartner.balanceUSD !== 0 && (
                  <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded w-fit ${selectedPartner.balanceUSD > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                    {selectedPartner.balanceUSD > 0 ? 'لنا' : 'علينا'}
                  </div>
                )}
              </div>
            </div>

            {/* Debit / Credit breakdown */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center gap-2">
                <IconTrendingUp size={14} className="text-emerald-500 shrink-0" />
                <div>
                  <div className="text-[9px] text-slate-400 font-bold">إجمالي مدين</div>
                  <div className="font-black text-xs text-slate-800 tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {selectedPartner.debitIQD.toLocaleString('en-US')} <span className="text-[9px] text-slate-400">د.ع</span>
                  </div>
                </div>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center gap-2">
                <IconTrendingDown size={14} className="text-rose-500 shrink-0" />
                <div>
                  <div className="text-[9px] text-slate-400 font-bold">إجمالي دائن</div>
                  <div className="font-black text-xs text-slate-800 tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {selectedPartner.creditIQD.toLocaleString('en-US')} <span className="text-[9px] text-slate-400">د.ع</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            {(selectedPartner.phone || selectedPartner.email || selectedPartner.address) && (
              <div className="p-3.5 border border-slate-200 rounded-2xl space-y-2.5 bg-white">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-wide">معلومات التواصل</div>
                {selectedPartner.phone && (
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <IconPhone size={13} className="text-slate-500" />
                    </div>
                    <span className="font-bold text-slate-800 text-xs">{selectedPartner.phone}</span>
                  </div>
                )}
                {selectedPartner.email && (
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <IconMail size={13} className="text-slate-500" />
                    </div>
                    <span className="font-bold text-slate-800 text-xs">{selectedPartner.email}</span>
                  </div>
                )}
                {selectedPartner.address && (
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <IconMapPin size={13} className="text-slate-500" />
                    </div>
                    <span className="font-bold text-slate-800 text-xs">{selectedPartner.address}</span>
                  </div>
                )}
              </div>
            )}

            {/* Credit Limits */}
            <div className="p-3.5 border border-slate-200 rounded-2xl space-y-2.5 bg-white">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-wide">حدود الائتمان</div>
                <button
                  type="button"
                  onClick={() => {
                    setNewCreditLimitIQD(selectedPartner.creditLimitIQD ? String(selectedPartner.creditLimitIQD) : '');
                    setNewCreditLimitUSD(selectedPartner.creditLimitUSD ? String(selectedPartner.creditLimitUSD) : '');
                    setCreditModalOpen(true);
                  }}
                  className="text-[10px] font-bold text-[#F45A0A] hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <IconEdit size={11} /> تعديل
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <div className="text-[9px] text-slate-400 font-bold">بالدينار</div>
                  <div className="font-black text-xs text-slate-800 mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {selectedPartner.creditLimitIQD ? selectedPartner.creditLimitIQD.toLocaleString('en-US') : <span className="text-slate-300">—</span>}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <div className="text-[9px] text-slate-400 font-bold">بالدولار</div>
                  <div className="font-black text-xs text-slate-800 mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {selectedPartner.creditLimitUSD ? `$${selectedPartner.creditLimitUSD.toLocaleString('en-US')}` : <span className="text-slate-300">—</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <Button
              fullWidth
              size="sm"
              color="orange"
              leftSection={<IconFileText size={15} />}
              className="font-bold"
              radius="xl"
              onClick={() => { setDrawerOpen(false); navigate(`/admin/reports?accountId=${selectedPartner.id}`); }}
            >
              عرض كشف الحساب الكامل
            </Button>
          </div>
        )}
      </Drawer>
    </div>
  );
};
