import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { AccountingGrid, AccountingColumnDef, AccountingActionMenuItem } from '../components/common/AccountingGrid';
import { Button, TextInput, Modal, Badge, Drawer, Select, Paper, NumberInput, SegmentedControl } from '@mantine/core';
import { IconPlus, IconEye, IconFileText, IconCreditCard, IconUsers, IconEdit } from '@tabler/icons-react';
import { useForm } from 'react-hook-form';
import { SmartAccountWizardModal } from '../components/accounts/SmartAccountWizardModal';

export const PartnersPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rawAccounts, setRawAccounts] = useState<any[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Credit Limit Edit Modal State
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [newCreditLimitIQD, setNewCreditLimitIQD] = useState<number | string>('');
  const [newCreditLimitUSD, setNewCreditLimitUSD] = useState<number | string>('');
  const [savingLimit, setSavingLimit] = useState(false);

  // Filter States
  const [selectedCurrency, setSelectedCurrency] = useState<'ALL' | 'IQD' | 'USD'>('ALL');
  const [partnerTypeFilter, setPartnerTypeFilter] = useState<string>('ALL');

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      type: 'CUSTOMER',
      code: '',
      nameAr: '',
      nameEn: '',
      phone: '',
      email: '',
      address: '',
    },
  });

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

  useEffect(() => {
    fetchPartners();
  }, []);

  const handleCreatePartner = async (formData: any) => {
    try {
      const isCustomer = formData.type === 'CUSTOMER';
      const endpoint = isCustomer ? '/api/partners/customers' : '/api/partners/suppliers';

      await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          code: formData.code,
          nameAr: formData.nameAr,
          nameEn: formData.nameEn,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          isAirline: formData.type === 'AIRLINE',
        }),
      });

      setCreateModalOpen(false);
      reset();
      fetchPartners();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إضافة الشريك');
    }
  };

  // Handle Changing Credit Limits (IQD & USD)
  const handleUpdateCreditLimit = async () => {
    if (!selectedPartner) return;
    setSavingLimit(true);
    try {
      const limitIQDVal = newCreditLimitIQD !== '' && newCreditLimitIQD !== null ? Number(newCreditLimitIQD) : null;
      const limitUSDVal = newCreditLimitUSD !== '' && newCreditLimitUSD !== null ? Number(newCreditLimitUSD) : null;

      await apiRequest(`/api/accounts/${selectedPartner.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          creditLimit: limitIQDVal,
          creditLimitUSD: limitUSDVal,
        }),
      });

      setCreditModalOpen(false);
      fetchPartners();
      if (selectedPartner) {
        setSelectedPartner({
          ...selectedPartner,
          creditLimitIQD: limitIQDVal,
          creditLimitUSD: limitUSDVal,
        });
      }
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء تحديث حدود الائتمان');
    } finally {
      setSavingLimit(false);
    }
  };

  // Transform raw sub-accounts into Partner entities with multi-currency balances
  const partners = useMemo(() => {
    return rawAccounts
      .filter((a) => !a.isParent)
      .map((a) => {
        let partnerType = 'OTHER';
        let partnerTypeLabel = 'مستفيد / آخر';
        let badgeColor = 'purple';

        if (
          a.code.startsWith('261') ||
          (a.nameAr || '').includes('طيران') ||
          (a.nameAr || '').includes('خطوط') ||
          (a.nameAr || '').includes('Airlines')
        ) {
          partnerType = 'AIRLINE';
          partnerTypeLabel = 'شركة طيران';
          badgeColor = 'blue';
        } else if (a.category === 'SUPPLIER' || a.code.startsWith('26')) {
          partnerType = 'SUPPLIER';
          partnerTypeLabel = 'مـورد (دائن)';
          badgeColor = 'orange';
        } else if (
          a.category === 'CUSTOMER' ||
          a.code.startsWith('141') ||
          a.code.startsWith('142') ||
          a.code.startsWith('143') ||
          a.code.startsWith('14')
        ) {
          partnerType = 'CUSTOMER';
          partnerTypeLabel = 'عميـل (مدين)';
          badgeColor = 'emerald';
        } else if (
          a.code.startsWith('144') ||
          a.category === 'EMPLOYEE' ||
          (a.nameAr || '').includes('مستفيد') ||
          (a.nameAr || '').includes('سلف')
        ) {
          partnerType = 'BENEFICIARY';
          partnerTypeLabel = 'مستفيد / موظف';
          badgeColor = 'purple';
        }

        return {
          id: a.id,
          code: a.code,
          nameAr: a.nameAr,
          nameEn: a.nameEn || '',
          partnerType,
          partnerTypeLabel,
          badgeColor,
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
          isActive: true,
        };
      });
  }, [rawAccounts]);

  // Apply Partner Type Filter
  const filteredPartners = useMemo(() => {
    if (partnerTypeFilter === 'ALL') return partners;
    return partners.filter((p) => p.partnerType === partnerTypeFilter);
  }, [partners, partnerTypeFilter]);

  // Column Definitions
  const columnDefs = useMemo<AccountingColumnDef[]>(() => {
    const cols: AccountingColumnDef[] = [
      {
        field: 'partnerDetails',
        headerText: 'بيانات الطرف / الشريك',
        width: 'w-64',
        isPinned: true,
        render: (r) => (
          <div className="flex flex-col py-0.5 leading-snug">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-900 text-xs">{r.nameAr}</span>
              <span className="font-mono font-bold text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                {r.code}
              </span>
            </div>
            {r.phone && r.phone !== '-' && (
              <span className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                📞 {r.phone}
              </span>
            )}
          </div>
        ),
      },
      {
        field: 'partnerType',
        headerText: 'نوع الشريك',
        width: 'w-32',
        align: 'center',
        render: (r) => <Badge size="xs" color={r.badgeColor}>{r.partnerTypeLabel}</Badge>,
      },
    ];

    // Credit Limit Columns
    if (selectedCurrency === 'ALL' || selectedCurrency === 'IQD') {
      cols.push({
        field: 'creditLimitIQD',
        headerText: 'حد الائتمان (د.ع)',
        width: 'w-32',
        align: 'left',
        render: (r) => (
          <span className="font-mono tabular-nums text-slate-700 text-left block w-full">
            {r.creditLimitIQD ? `${r.creditLimitIQD.toLocaleString()} د.ع` : 'غير محدد'}
          </span>
        ),
      });
    }

    if (selectedCurrency === 'ALL' || selectedCurrency === 'USD') {
      cols.push({
        field: 'creditLimitUSD',
        headerText: 'حد الائتمان ($)',
        width: 'w-28',
        align: 'left',
        render: (r) => (
          <span className="font-mono tabular-nums text-slate-700 text-left block w-full">
            {r.creditLimitUSD ? `$ ${r.creditLimitUSD.toLocaleString()}` : 'غير محدد'}
          </span>
        ),
      });
    }

    // IQD Balances Columns
    if (selectedCurrency === 'ALL' || selectedCurrency === 'IQD') {
      cols.push(
        {
          field: 'debitIQD',
          headerText: 'مدين (د.ع)',
          width: 'w-32',
          align: 'left',
          isMonetary: true,
          render: (r) => (
            <span className="font-bold tabular-nums text-emerald-800 text-left block w-full">
              {r.debitIQD > 0 ? r.debitIQD.toLocaleString() : '-'}
            </span>
          ),
        },
        {
          field: 'creditIQD',
          headerText: 'دائن (د.ع)',
          width: 'w-32',
          align: 'left',
          isMonetary: true,
          render: (r) => (
            <span className="font-bold tabular-nums text-rose-800 text-left block w-full">
              {r.creditIQD > 0 ? r.creditIQD.toLocaleString() : '-'}
            </span>
          ),
        },
        {
          field: 'balanceIQD',
          headerText: 'الرصيد الصافي (د.ع)',
          width: 'w-36',
          align: 'left',
          isMonetary: true,
          render: (r) => {
            const bal = r.balanceIQD;
            if (bal > 0.01) {
              return (
                <span className="font-extrabold tabular-nums text-left block w-full text-emerald-700">
                  {bal.toLocaleString()} د.ع (لنا)
                </span>
              );
            }
            if (bal < -0.01) {
              return (
                <span className="font-extrabold tabular-nums text-left block w-full text-rose-700">
                  {Math.abs(bal).toLocaleString()} د.ع (علينا)
                </span>
              );
            }
            return <span className="font-mono text-slate-400 text-left block w-full">0 د.ع</span>;
          },
        }
      );
    }

    // USD Balances Columns
    if (selectedCurrency === 'ALL' || selectedCurrency === 'USD') {
      cols.push(
        {
          field: 'debitUSD',
          headerText: 'مدين ($)',
          width: 'w-28',
          align: 'left',
          isMonetary: true,
          render: (r) => (
            <span className="font-bold tabular-nums text-blue-800 text-left block w-full">
              {r.debitUSD > 0 ? `$ ${r.debitUSD.toLocaleString()}` : '-'}
            </span>
          ),
        },
        {
          field: 'creditUSD',
          headerText: 'دائن ($)',
          width: 'w-28',
          align: 'left',
          isMonetary: true,
          render: (r) => (
            <span className="font-bold tabular-nums text-rose-800 text-left block w-full">
              {r.creditUSD > 0 ? `$ ${r.creditUSD.toLocaleString()}` : '-'}
            </span>
          ),
        },
        {
          field: 'balanceUSD',
          headerText: 'الرصيد الصافي ($)',
          width: 'w-32',
          align: 'left',
          isMonetary: true,
          render: (r) => {
            const bal = r.balanceUSD;
            if (bal > 0.01) {
              return (
                <span className="font-extrabold tabular-nums text-left block w-full text-blue-700">
                  $ {bal.toLocaleString()} (لنا)
                </span>
              );
            }
            if (bal < -0.01) {
              return (
                <span className="font-extrabold tabular-nums text-left block w-full text-rose-700">
                  $ {Math.abs(bal).toLocaleString()} (علينا)
                </span>
              );
            }
            return <span className="font-mono text-slate-400 text-left block w-full">$ 0.00</span>;
          },
        }
      );
    }

    cols.push({
      field: 'isActive',
      headerText: 'حالة الحساب',
      width: 'w-24',
      align: 'center',
      render: () => <Badge size="xs" color="emerald">نشـط</Badge>,
    });

    return cols;
  }, [selectedCurrency]);

  // Shortened popup action menu items with credit limit edit
  const actionMenuItems: AccountingActionMenuItem[] = [
    {
      label: 'بطاقة الشريك',
      icon: IconEye,
      onClick: (row) => {
        setSelectedPartner(row);
        setDrawerOpen(true);
      },
    },
    {
      label: 'كشف الحساب',
      icon: IconFileText,
      color: 'blue',
      onClick: (row) => {
        navigate(`/admin/reports?accountId=${row.id}`);
      },
    },
    {
      label: 'تغير الائتمان',
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

  // Stats Summary Metrics
  const metrics = useMemo(() => {
    let totalCusts = 0, totalSupps = 0, totalAirlines = 0, totalBeneficiaries = 0;

    partners.forEach((p) => {
      if (p.partnerType === 'CUSTOMER') totalCusts++;
      if (p.partnerType === 'SUPPLIER') totalSupps++;
      if (p.partnerType === 'AIRLINE') totalAirlines++;
      if (p.partnerType === 'BENEFICIARY') totalBeneficiaries++;
    });

    return {
      total: partners.length,
      totalCusts,
      totalSupps,
      totalAirlines,
      totalBeneficiaries,
    };
  }, [partners]);

  return (
    <div className="w-full">
      {/* ── Grid ── */}
      <AccountingGrid
        gridKey="partners_accounting_grid"
        data={filteredPartners}
        columnDefs={columnDefs}
        loading={loading}
        onRefresh={fetchPartners}
        actionMenuItems={actionMenuItems}
        onRowDoubleClick={(row) => {
          setSelectedPartner(row);
          setDrawerOpen(true);
        }}
        typeFilterOptions={[
          { label: 'جميع الأطراف والشركاء (الكل)', value: 'ALL' },
          { label: 'العملاء (المدينون - Customers)', value: 'CUSTOMER' },
          { label: 'الموردون (الدائنون - Suppliers)', value: 'SUPPLIER' },
          { label: 'شركات الطيران (Airlines)', value: 'AIRLINE' },
          { label: 'المستفيدون والموظفون (Beneficiaries)', value: 'BENEFICIARY' },
        ]}
        customToolbarElements={
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 shrink-0">العملة:</span>
              <SegmentedControl
                size="xs"
                value={selectedCurrency}
                onChange={(val: any) => setSelectedCurrency(val || 'ALL')}
                data={[
                  { label: 'ALL', value: 'ALL' },
                  { label: 'IQD', value: 'IQD' },
                  { label: 'USD', value: 'USD' },
                ]}
                color="orange"
                className="bg-slate-100 font-bold"
              />
            </div>

            <Button
              size="xs"
              color="orange"
              leftSection={<IconPlus size={14} />}
              onClick={() => setCreateModalOpen(true)}
              className="font-bold"
            >
              إضافة طرف جديد
            </Button>
          </div>
        }
      />

      {/* ── Credit Limits Modal ── */}
      <Modal
        opened={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        title={
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center shrink-0">
              <IconCreditCard size={16} />
            </div>
            <span>تغيير حد الائتمان</span>
          </div>
        }
        size="sm"
        centered
        radius="lg"
      >
        {selectedPartner && (
          <div className="space-y-3.5 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[10px] text-slate-500 font-bold block">اسم الحساب / الطرف</span>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {selectedPartner.nameAr}
              </div>
              <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-3">
                <span>
                  دينار: <span className="font-bold text-slate-700">{selectedPartner.creditLimitIQD ? `${selectedPartner.creditLimitIQD.toLocaleString()} د.ع` : 'غير محدد'}</span>
                </span>
                <span className="text-slate-300">|</span>
                <span>
                  دولار: <span className="font-bold text-slate-700">{selectedPartner.creditLimitUSD ? `$ ${selectedPartner.creditLimitUSD.toLocaleString()}` : 'غير محدد'}</span>
                </span>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 text-[11px]">حد الائتمان بالدينار العراقي (IQD)</label>
              <NumberInput
                size="xs"
                value={newCreditLimitIQD}
                onChange={(val) => setNewCreditLimitIQD(val)}
                thousandSeparator=","
                min={0}
                allowNegative={false}
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 text-[11px]">حد الائتمان بالدولار الأمريكي (USD)</label>
              <NumberInput
                size="xs"
                value={newCreditLimitUSD}
                onChange={(val) => setNewCreditLimitUSD(val)}
                thousandSeparator=","
                min={0}
                allowNegative={false}
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                اتركه فارغاً لإلغاء الحد.
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="default" size="xs" onClick={() => setCreditModalOpen(false)} className="font-medium">
                إلغاء
              </Button>
              <Button color="orange" size="xs" loading={savingLimit} onClick={handleUpdateCreditLimit} className="font-bold">
                حفظ التغيير
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Smart Chart of Accounts Wizard Modal for Partners/Clients/Suppliers */}
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
          <span className="font-black text-sm text-slate-900">بطاقة بيانات الطرف</span>
        }
        position="left"
        size="md"
      >
        {selectedPartner && (
          <div className="space-y-3.5 text-xs">
            {/* Header Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">كود واسم الطرف</span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {selectedPartner.nameAr}
                  </div>
                </div>
                <span className="font-mono text-[11px] font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">
                  {selectedPartner.code}
                </span>
              </div>
              <Badge size="xs" color={selectedPartner.badgeColor} className="mt-2">
                {selectedPartner.partnerTypeLabel}
              </Badge>
            </div>

            {/* Balance Card */}
            <div className="p-3.5 border border-slate-200 rounded-lg space-y-2.5">
              <div className="font-bold text-slate-700 text-[11px]">الرصيد المالي الحقيقي</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block">الرصيد بالدينار</span>
                  <span className="font-black text-xs tabular-nums text-slate-900 font-mono" style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}>
                    {selectedPartner.balanceIQD.toLocaleString('en-US')} <span className="text-slate-400 font-semibold">د.ع</span>
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block">الرصيد بالدولار</span>
                  <span className="font-black text-xs tabular-nums text-slate-900 font-mono" style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}>
                    $ {selectedPartner.balanceUSD.toLocaleString('en-US')}
                  </span>
                </div>
              </div>
            </div>

            {/* Contact & Credit Card */}
            <div className="p-3.5 border border-slate-200 rounded-lg space-y-2.5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">الهاتف</span>
                  <span className="font-bold text-slate-800">{selectedPartner.phone || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold">البريد الإلكتروني</span>
                  <span className="font-bold text-slate-800">{selectedPartner.email || '-'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px] font-bold">العنوان</span>
                  <span className="font-bold text-slate-800">{selectedPartner.address || '-'}</span>
                </div>
              </div>
              <div className="pt-2.5 border-t border-slate-100 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">حد الائتمان (دينار)</span>
                    <span className="font-bold text-slate-800">
                      {selectedPartner.creditLimitIQD ? `${selectedPartner.creditLimitIQD.toLocaleString('en-US')} د.ع` : 'غير محدد'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">حد الائتمان (دولار)</span>
                    <span className="font-bold text-slate-800">
                      {selectedPartner.creditLimitUSD ? `$ ${selectedPartner.creditLimitUSD.toLocaleString('en-US')}` : 'غير محدد'}
                    </span>
                  </div>
                </div>
                <Button
                  size="xs"
                  variant="light"
                  color="orange"
                  fullWidth
                  leftSection={<IconEdit size={12} />}
                  className="font-bold"
                  onClick={() => {
                    setNewCreditLimitIQD(selectedPartner.creditLimitIQD ? String(selectedPartner.creditLimitIQD) : '');
                    setNewCreditLimitUSD(selectedPartner.creditLimitUSD ? String(selectedPartner.creditLimitUSD) : '');
                    setCreditModalOpen(true);
                  }}
                >
                  تغيير حد الائتمان
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-1">
              <Button
                fullWidth
                size="xs"
                color="orange"
                variant="filled"
                leftSection={<IconFileText size={14} />}
                className="font-bold"
                onClick={() => {
                  setDrawerOpen(false);
                  navigate(`/admin/reports?accountId=${selectedPartner.id}`);
                }}
              >
                عرض كشف الحساب
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
