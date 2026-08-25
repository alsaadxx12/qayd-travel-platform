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
    <div className="space-y-2 w-full">
      {/* Grid Component */}
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-700 shrink-0">العملة:</span>
              <SegmentedControl
                size="xs"
                value={selectedCurrency}
                onChange={(val: any) => setSelectedCurrency(val || 'ALL')}
                data={[
                  { label: 'ALL', value: 'ALL' },
                  { label: 'IQD', value: 'IQD' },
                  { label: 'USD', value: 'USD' },
                ]}
                color="emerald"
                className="bg-slate-100 font-bold border border-slate-300 shadow-2xs"
              />
            </div>

            <Button
              size="xs"
              color="emerald"
              leftSection={<IconPlus size={14} />}
              onClick={() => setCreateModalOpen(true)}
            >
              إضافة طرف جديد
            </Button>
          </div>
        }
      />

      {/* Change Credit Limits Modal (IQD & USD) */}
      <Modal
        opened={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        title="تغير حد الائتمان (دينار ودولار)"
        size="sm"
        centered
      >
        {selectedPartner && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <span className="text-[10px] text-slate-500 font-bold block">اسم الحساب / الطرف</span>
              <div className="text-sm font-bold text-slate-900">
                {selectedPartner.code} - {selectedPartner.nameAr}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex flex-col gap-0.5">
                <span>
                  حد الائتمان بالدينار: {' '}
                  <span className="font-bold text-emerald-800">
                    {selectedPartner.creditLimitIQD ? `${selectedPartner.creditLimitIQD.toLocaleString()} د.ع` : 'غير محدد'}
                  </span>
                </span>
                <span>
                  حد الائتمان بالدولار: {' '}
                  <span className="font-bold text-blue-900">
                    {selectedPartner.creditLimitUSD ? `$ ${selectedPartner.creditLimitUSD.toLocaleString()}` : 'غير محدد'}
                  </span>
                </span>
              </div>
            </div>

            {/* Field 1: IQD Limit */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">حد الائتمان بالدينار العراقي (IQD)</label>
              <NumberInput
                size="sm"
                placeholder="أدخل حد الائتمان بالدينار"
                value={newCreditLimitIQD}
                onChange={(val) => setNewCreditLimitIQD(val)}
                thousandSeparator=","
                min={0}
                allowNegative={false}
              />
            </div>

            {/* Field 2: USD Limit */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">حد الائتمان بالدولار الأمريكي (USD)</label>
              <NumberInput
                size="sm"
                placeholder="أدخل حد الائتمان بالدولار"
                value={newCreditLimitUSD}
                onChange={(val) => setNewCreditLimitUSD(val)}
                thousandSeparator=","
                min={0}
                allowNegative={false}
              />
              <span className="text-[10px] text-slate-500 block mt-1">
                اكتب المبلغ المسموح به لكل عملة، أو اتركه فارغاً لإلغاء الحد.
              </span>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="light" color="gray" size="xs" onClick={() => setCreditModalOpen(false)}>
                إلغاء
              </Button>
              <Button color="emerald" size="xs" loading={savingLimit} onClick={handleUpdateCreditLimit}>
                حفظ التغير
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

      {/* Partner Detail Drawer */}
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="بطاقة بيانات الطرف المحاسبية الشاملة"
        position="left"
        size="md"
      >
        {selectedPartner && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <span className="text-[10px] text-slate-500 font-bold block">كود واسم الطرف</span>
              <div className="text-sm font-bold text-emerald-800 tabular-nums">
                {selectedPartner.code} - {selectedPartner.nameAr}
              </div>
              <Badge size="xs" color={selectedPartner.badgeColor} className="mt-1">
                {selectedPartner.partnerTypeLabel}
              </Badge>
            </div>

            <div className="p-3 border border-slate-200 rounded space-y-2">
              <div className="font-bold text-slate-700 border-b pb-1">الرصيد المالي الحقيقي من الحركات</div>
              
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2 bg-emerald-50/50 rounded border border-emerald-100">
                  <span className="text-[10px] text-slate-500 block">الرصيد بالدينار العراقي</span>
                  <span className="font-extrabold text-xs tabular-nums text-emerald-900">
                    {selectedPartner.balanceIQD.toLocaleString()} د.ع
                  </span>
                </div>
                <div className="p-2 bg-blue-50/50 rounded border border-blue-100">
                  <span className="text-[10px] text-slate-500 block">الرصيد بالدولار الأمريكي</span>
                  <span className="font-extrabold text-xs tabular-nums text-blue-950">
                    $ {selectedPartner.balanceUSD.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 border border-slate-200 rounded space-y-2">
              <div>
                <span className="text-slate-500 block text-[10px]">الهاتف</span>
                <span className="font-bold text-slate-800">{selectedPartner.phone || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">البريد الإلكتروني</span>
                <span className="font-bold text-slate-800">{selectedPartner.email || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">العنوان</span>
                <span className="font-bold text-slate-800">{selectedPartner.address || '-'}</span>
              </div>
              <div className="pt-2 border-t space-y-1.5">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-slate-500 block text-[10px]">حد الائتمان بالدينار (IQD)</span>
                    <span className="font-bold text-slate-800">
                      {selectedPartner.creditLimitIQD ? `${selectedPartner.creditLimitIQD.toLocaleString()} د.ع` : 'غير محدد'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">حد الائتمان بالدولار (USD)</span>
                    <span className="font-bold text-slate-800">
                      {selectedPartner.creditLimitUSD ? `$ ${selectedPartner.creditLimitUSD.toLocaleString()}` : 'غير محدد'}
                    </span>
                  </div>
                </div>
                <Button
                  size="xs"
                  variant="light"
                  color="emerald"
                  fullWidth
                  leftSection={<IconEdit size={12} />}
                  onClick={() => {
                    setNewCreditLimitIQD(selectedPartner.creditLimitIQD ? String(selectedPartner.creditLimitIQD) : '');
                    setNewCreditLimitUSD(selectedPartner.creditLimitUSD ? String(selectedPartner.creditLimitUSD) : '');
                    setCreditModalOpen(true);
                  }}
                >
                  تغير حد الائتمان
                </Button>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <Button
                fullWidth
                color="blue"
                leftSection={<IconFileText size={16} />}
                onClick={() => {
                  setDrawerOpen(false);
                  navigate(`/admin/reports?accountId=${selectedPartner.id}`);
                }}
              >
                كشف الحساب 📄
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
