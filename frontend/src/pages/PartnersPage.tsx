import React, { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '../api/client';
import { Button, Badge, Drawer, SegmentedControl, Tooltip } from '@mantine/core';
import {
  IconPlus,
  IconEye,
  IconUsers,
  IconBuildingStore,
  IconUserCheck,
  IconPhone,
  IconMail,
  IconMapPin,
  IconSend,
  IconSearch,
  IconRefresh,
  IconCopy,
  IconCheck,
  IconAt,
  IconFilter,
} from '@tabler/icons-react';
import { SmartAccountWizardModal } from '../components/accounts/SmartAccountWizardModal';
import { EmailBroadcastModal } from '../components/partners/EmailBroadcastModal';
import { showSuccessNotification } from '../utils/notifications';
import { useLanguageStore } from '../store/useLanguageStore';

// ─── Stat Card Component (White, Crisp Light Borders, Brand Orange) ───
const StatCard: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  accentBg: string;
  accentColor: string;
  subtext?: string;
}> = ({ label, value, icon, accentBg, accentColor, subtext }) => (
  <div className="flex items-center gap-3.5 px-4 py-3 rounded-2xl border border-slate-200/90 bg-white shadow-2xs flex-1 min-w-[200px] hover:border-orange-200 transition-all">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accentBg} ${accentColor} border border-slate-100`}>
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-[11.5px] font-bold text-slate-500 whitespace-nowrap">
        {label}
      </div>
      <div
        className="text-xl font-black tabular-nums text-slate-900 leading-tight"
        style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace" }}
      >
        {value.toLocaleString('en-US')}
      </div>
      {subtext && <div className="text-[10px] text-slate-400 font-medium mt-0.5">{subtext}</div>}
    </div>
  </div>
);

export const PartnersPage: React.FC = () => {
  const { direction, language } = useLanguageStore();
  const isAr = language === 'ar';

  const [loading, setLoading] = useState(true);
  const [rawAccounts, setRawAccounts] = useState<any[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  // Filters & Search
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CUSTOMER' | 'SUPPLIER'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch Accounts from Backend (Real Database)
  const fetchPartners = async () => {
    setLoading(true);
    try {
      /*
       * الشاشة تعرض اسماً ورمزاً وهاتفاً وبريداً — ولا رصيد فيها.
       *
       * وكانت تطلب النسخة الكاملة: 2.7 ميغابايت في نحو أربع ثوانٍ، لأن الخادم
       * يجمع حركات دفتر الأستاذ ويمسح القيود الافتتاحية لكل حساب من 2751 حساباً
       * ثم تُرمى تلك الأرصدة كلها هنا. والنسخة المخفَّفة تحمل ما يُعرض فقط.
       */
      const accs = await apiRequest('/api/accounts?lite=1');
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

  // Filter and map ONLY Customers & Suppliers (Excluding parents and non-partner accounts)
  const partners = useMemo(() => {
    return rawAccounts
      .filter((a) => !a.isParent)
      .map((a) => {
        let partnerType = 'OTHER';
        let partnerTypeLabel = 'مستفيد / آخر';
        let badgeColor = 'gray';

        // Categorize strictly into Customer or Supplier
        if (a.category === 'SUPPLIER' || a.code.startsWith('26')) {
          partnerType = 'SUPPLIER';
          partnerTypeLabel = 'مورد (دائن)';
          badgeColor = 'blue';
        } else if (
          a.category === 'CUSTOMER' ||
          a.code.startsWith('141') ||
          a.code.startsWith('142') ||
          a.code.startsWith('143') ||
          a.code.startsWith('14') ||
          a.code.startsWith('161')
        ) {
          partnerType = 'CUSTOMER';
          partnerTypeLabel = 'عميل (مدين)';
          badgeColor = 'orange';
        }

        return {
          id: a.id,
          code: a.code,
          nameAr: a.nameAr,
          nameEn: a.nameEn || '',
          partnerType,
          partnerTypeLabel,
          badgeColor,
          phone: a.phone || a.customer?.phone || a.supplier?.phone || '',
          email: a.email || a.customer?.email || a.supplier?.email || '',
          address: a.address || a.customer?.address || a.supplier?.address || '',
          contactPerson: a.contactPerson || '',
        };
      })
      // Keep only Customers and Suppliers
      .filter((p) => p.partnerType === 'CUSTOMER' || p.partnerType === 'SUPPLIER');
  }, [rawAccounts]);

  // Metrics
  const metrics = useMemo(() => {
    let customersCount = 0;
    let suppliersCount = 0;
    let withEmailCount = 0;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    partners.forEach((p) => {
      if (p.partnerType === 'CUSTOMER') customersCount++;
      if (p.partnerType === 'SUPPLIER') suppliersCount++;
      if (p.email && emailRegex.test(p.email.trim())) withEmailCount++;
    });

    return {
      total: partners.length,
      customersCount,
      suppliersCount,
      withEmailCount,
    };
  }, [partners]);

  // Filtered List
  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      // Type Filter
      if (typeFilter !== 'ALL' && p.partnerType !== typeFilter) return false;

      // Only With Email
      if (onlyWithEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!p.email || !emailRegex.test(p.email.trim())) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (p.nameAr || '').toLowerCase().includes(q) || (p.nameEn || '').toLowerCase().includes(q);
        const matchesCode = (p.code || '').toLowerCase().includes(q);
        const matchesPhone = (p.phone || '').toLowerCase().includes(q);
        const matchesEmail = (p.email || '').toLowerCase().includes(q);
        const matchesAddress = (p.address || '').toLowerCase().includes(q);
        return matchesName || matchesCode || matchesPhone || matchesEmail || matchesAddress;
      }

      return true;
    });
  }, [partners, typeFilter, onlyWithEmail, searchQuery]);

  // Copy helper
  const handleCopyText = (text: string, id: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showSuccessNotification('تم النسخ', `تم نسخ ${label} إلى الحافظة بنجاح`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Select all toggle
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredPartners.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPartners.map((p) => p.id));
    }
  };

  return (
    <div
      className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 py-4 space-y-4 font-sans select-none bg-[#F7F8FA] min-h-screen text-right"
      dir={direction}
      style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      {/* ── 1. STATS OVERVIEW CARDS (Refined White & Orange Palette) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="إجمالي الأطراف المسجلة"
          value={metrics.total}
          icon={<IconUsers size={20} />}
          accentBg="bg-orange-50"
          accentColor="text-[#F45A0A]"
          subtext="عملاء وموردون نشطون"
        />
        <StatCard
          label="العملاء (مدينون)"
          value={metrics.customersCount}
          icon={<IconUserCheck size={20} />}
          accentBg="bg-amber-50"
          accentColor="text-amber-600"
          subtext="شركات وأفراد ووكلاء"
        />
        <StatCard
          label="الموردون (دائنون)"
          value={metrics.suppliersCount}
          icon={<IconBuildingStore size={20} />}
          accentBg="bg-blue-50"
          accentColor="text-blue-600"
          subtext="شركات سياحة وطيران وفنادق"
        />
        <StatCard
          label="يمتلكون بريداً إلكترونياً"
          value={metrics.withEmailCount}
          icon={<IconMail size={20} />}
          accentBg="bg-emerald-50"
          accentColor="text-emerald-600"
          subtext="جاهزون لمراسلة الإعلانات"
        />
      </div>

      {/* ── 2. FILTERS & ACTIONS TOOLBAR ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Right Group: Search + Type Segment + Email Toggle */}
          <div className="flex items-center gap-2.5 flex-wrap flex-1">
            {/* Search Input */}
            <div className="relative w-full sm:w-[280px]">
              <IconSearch size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم، الكود، الهاتف، الإيميل..."
                className="w-full h-9 pr-9 pl-3 rounded-xl bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-[#F45A0A] text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all"
              />
            </div>

            {/* Segmented Filter: All / Customers / Suppliers */}
            <SegmentedControl
              size="sm"
              value={typeFilter}
              onChange={(val: any) => setTypeFilter(val)}
              data={[
                { label: `الكل (${metrics.total.toLocaleString('en-US')})`, value: 'ALL' },
                { label: `العملاء (${metrics.customersCount.toLocaleString('en-US')})`, value: 'CUSTOMER' },
                { label: `الموردون (${metrics.suppliersCount.toLocaleString('en-US')})`, value: 'SUPPLIER' },
              ]}
              color="orange"
              className="font-bold shrink-0 shadow-2xs border border-slate-200/80"
              radius="xl"
            />

            {/* Filter Toggle: Only with email */}
            <button
              type="button"
              onClick={() => setOnlyWithEmail((p) => !p)}
              className={`h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                onlyWithEmail
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <IconAt size={14} className={onlyWithEmail ? 'text-emerald-600' : 'text-slate-400'} />
              <span>يحمل بريداً إلكترونياً</span>
              {onlyWithEmail && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
            </button>
          </div>

          {/* Left Group: Action Buttons (Add Partner + Email Broadcast + Refresh) */}
          <div className="flex items-center gap-2 justify-end shrink-0">
            {/* Email Broadcast Button */}
            <Button
              size="sm"
              color="orange"
              variant="light"
              leftSection={<IconSend size={15} />}
              onClick={() => setEmailModalOpen(true)}
              className="font-bold text-xs shadow-2xs border border-orange-200"
              radius="xl"
            >
              إرسال إعلان عبر الإيميل
            </Button>

            {/* Add New Partner */}
            <Button
              size="sm"
              color="orange"
              leftSection={<IconPlus size={15} />}
              onClick={() => setCreateModalOpen(true)}
              className="font-bold text-xs shadow-2xs"
              radius="xl"
            >
              إضافة طرف جديد
            </Button>

            {/* Refresh */}
            <Tooltip label="تحديث البيانات" withArrow position="top">
              <button
                type="button"
                onClick={fetchPartners}
                disabled={loading}
                className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
              >
                <IconRefresh size={16} className={loading ? 'animate-spin text-[#F45A0A]' : ''} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* ── 3. DIRECTORY TABLE CARD ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="h-12 bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold text-[12px]">
                {/* Select Checkbox */}
                <th className="px-3.5 py-2 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredPartners.length > 0 && selectedIds.length === filteredPartners.length}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-[#F45A0A] focus:ring-[#F45A0A] cursor-pointer"
                  />
                </th>
                <th className="px-3.5 py-2 w-14 text-center">#</th>
                <th className="px-4 py-2 min-w-[220px]">اسم الطرف / كود الحساب</th>
                <th className="px-3.5 py-2 text-center w-32">التصنيف</th>
                <th className="px-4 py-2 min-w-[150px]">رقم الهاتف</th>
                <th className="px-4 py-2 min-w-[200px]">البريد الإلكتروني</th>
                <th className="px-4 py-2 min-w-[180px]">العنوان / المدينة</th>
                <th className="px-3.5 py-2 text-center w-28">الإجراءات</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 font-medium">
                    <IconRefresh size={22} className="animate-spin text-[#F45A0A] mx-auto mb-2" />
                    جاري تحميل بيانات الأطراف والعملاء والموردين...
                  </td>
                </tr>
              ) : filteredPartners.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <IconUsers size={32} className="mx-auto mb-2 text-slate-300" />
                    لا توجد أطراف مطابقة لخيارات البحث المحددة
                  </td>
                </tr>
              ) : (
                filteredPartners.map((partner, idx) => {
                  const isSelected = selectedIds.includes(partner.id);
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  const hasValidEmail = partner.email && emailRegex.test(partner.email.trim());

                  return (
                    <tr
                      key={partner.id}
                      onClick={() => {
                        setSelectedPartner(partner);
                        setDrawerOpen(true);
                      }}
                      className={`h-14 hover:bg-orange-50/20 transition-colors cursor-pointer group ${
                        isSelected ? 'bg-orange-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-3.5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedIds((prev) =>
                              prev.includes(partner.id) ? prev.filter((id) => id !== partner.id) : [...prev, partner.id]
                            );
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-[#F45A0A] focus:ring-[#F45A0A] cursor-pointer"
                        />
                      </td>

                      {/* Index */}
                      <td className="px-3.5 py-2 text-center font-mono text-slate-400 text-xs">
                        {idx + 1}
                      </td>

                      {/* Name & Code */}
                      <td className="px-4 py-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-slate-900 text-xs group-hover:text-[#F45A0A] transition-colors">
                            {partner.nameAr}
                          </span>
                          <span className="font-mono font-bold text-[10.5px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded w-fit border border-slate-200">
                            {partner.code}
                          </span>
                        </div>
                      </td>

                      {/* Classification Badge */}
                      <td className="px-3.5 py-2 text-center">
                        <Badge
                          size="sm"
                          color={partner.partnerType === 'CUSTOMER' ? 'orange' : 'blue'}
                          variant="light"
                          radius="md"
                          className="font-bold"
                        >
                          {partner.partnerType === 'CUSTOMER' ? 'عميل' : 'مورد'}
                        </Badge>
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-2">
                        {partner.phone && partner.phone !== '-' ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <span className="font-mono font-bold text-slate-700 text-xs tabular-nums" dir="ltr">
                              {partner.phone}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(partner.phone, `phone-${partner.id}`, 'رقم الهاتف')}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 transition-opacity p-0.5 cursor-pointer"
                              title="نسخ رقم الهاتف"
                            >
                              {copiedId === `phone-${partner.id}` ? <IconCheck size={13} className="text-emerald-600" /> : <IconCopy size={13} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="px-4 py-2">
                        {hasValidEmail ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <span className="font-mono text-slate-700 text-xs truncate max-w-[190px]" dir="ltr">
                              {partner.email}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(partner.email, `email-${partner.id}`, 'البريد الإلكتروني')}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 transition-opacity p-0.5 cursor-pointer"
                              title="نسخ البريد الإلكتروني"
                            >
                              {copiedId === `email-${partner.id}` ? <IconCheck size={13} className="text-emerald-600" /> : <IconCopy size={13} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[11px]">غير مسجل</span>
                        )}
                      </td>

                      {/* Address */}
                      <td className="px-4 py-2">
                        {partner.address ? (
                          <span className="text-slate-600 text-xs truncate block max-w-[180px]">
                            {partner.address}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3.5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip label="عرض بطاقة الطرف" withArrow position="top">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPartner(partner);
                                setDrawerOpen(true);
                              }}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-orange-50 text-slate-600 hover:text-[#F45A0A] flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <IconEye size={14} />
                            </button>
                          </Tooltip>

                          {hasValidEmail && (
                            <Tooltip label="إرسال إيميل" withArrow position="top">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedIds([partner.id]);
                                  setEmailModalOpen(true);
                                }}
                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <IconMail size={14} />
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Directory Footer */}
        <div className="bg-slate-50/80 border-t border-slate-200 px-5 py-3 flex items-center justify-between text-xs text-slate-500 font-medium">
          <div>
            عرض <strong className="font-mono text-slate-800">{filteredPartners.length}</strong> من أصل <strong className="font-mono text-slate-800">{partners.length}</strong> طرف
          </div>
          {selectedIds.length > 0 && (
            <div className="text-[#F45A0A] font-bold">
              تم تحديد ({selectedIds.length}) طرف
            </div>
          )}
        </div>
      </div>

      {/* ── 4. EMAIL BROADCAST MODAL ── */}
      <EmailBroadcastModal
        opened={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        partners={partners}
        selectedPartnerIds={selectedIds}
      />

      {/* ── 5. SMART ACCOUNT WIZARD MODAL ── */}
      <SmartAccountWizardModal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={fetchPartners}
        defaultAccountType="INDIVIDUAL_CLIENT"
      />

      {/* ── 6. PARTNER DETAIL DRAWER (Clean Contact View Without Financial Balances) ── */}
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
                <div className="text-[11px] text-slate-400 font-mono">{selectedPartner.code}</div>
              )}
            </div>
          </div>
        }
        position="left"
        size="md"
        dir="rtl"
        styles={{
          body: { padding: '16px' },
          header: { borderBottom: '1px solid #E5E7EB', paddingBottom: '12px' },
        }}
      >
        {selectedPartner && (
          <div className="space-y-4 text-xs font-sans">
            {/* Name + Badge */}
            <div className="p-4 bg-gradient-to-br from-slate-50 to-orange-50/30 border border-slate-200 rounded-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold mb-1">الاسم الكامل</div>
                  <div className="text-base font-black text-slate-900 leading-tight">{selectedPartner.nameAr}</div>
                  {selectedPartner.nameEn && (
                    <div className="text-[11px] text-slate-500 mt-0.5 font-medium">{selectedPartner.nameEn}</div>
                  )}
                </div>
                <Badge size="sm" color={selectedPartner.partnerType === 'CUSTOMER' ? 'orange' : 'blue'} variant="light" radius="xl" className="font-bold shrink-0">
                  {selectedPartner.partnerType === 'CUSTOMER' ? 'عميل' : 'مورد'}
                </Badge>
              </div>
            </div>

            {/* Contact Details Card */}
            <div className="p-4 border border-slate-200 rounded-2xl space-y-3 bg-white">
              <div className="text-[11px] font-black text-slate-600 uppercase tracking-wide border-b border-slate-100 pb-2">
                بيانات الاتصال والعنوان
              </div>

              {/* Phone */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5 text-slate-600">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <IconPhone size={14} className="text-slate-500" />
                  </div>
                  <span className="font-medium text-xs">رقم الهاتف:</span>
                </div>
                {selectedPartner.phone && selectedPartner.phone !== '-' ? (
                  <span className="font-mono font-bold text-slate-900 text-xs" dir="ltr">{selectedPartner.phone}</span>
                ) : (
                  <span className="text-slate-300 text-xs">غير محدد</span>
                )}
              </div>

              {/* Email */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5 text-slate-600">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <IconMail size={14} className="text-slate-500" />
                  </div>
                  <span className="font-medium text-xs">البريد الإلكتروني:</span>
                </div>
                {selectedPartner.email ? (
                  <span className="font-mono font-bold text-slate-900 text-xs" dir="ltr">{selectedPartner.email}</span>
                ) : (
                  <span className="text-slate-300 text-xs">غير مسجل</span>
                )}
              </div>

              {/* Address */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5 text-slate-600">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <IconMapPin size={14} className="text-slate-500" />
                  </div>
                  <span className="font-medium text-xs">العنوان / المدينة:</span>
                </div>
                {selectedPartner.address ? (
                  <span className="font-bold text-slate-900 text-xs text-left max-w-[200px] truncate">{selectedPartner.address}</span>
                ) : (
                  <span className="text-slate-300 text-xs">غير محدد</span>
                )}
              </div>
            </div>

            {/* Quick Direct Actions */}
            <div className="space-y-2 pt-2">
              {selectedPartner.email && (
                <Button
                  fullWidth
                  size="sm"
                  color="orange"
                  variant="light"
                  leftSection={<IconSend size={15} />}
                  className="font-bold"
                  radius="xl"
                  onClick={() => {
                    setSelectedIds([selectedPartner.id]);
                    setEmailModalOpen(true);
                  }}
                >
                  إرسال إعلان عبر البريد الإلكتروني
                </Button>
              )}

              <Button
                fullWidth
                size="sm"
                variant="default"
                leftSection={<IconCopy size={15} />}
                className="font-medium"
                radius="xl"
                onClick={() => {
                  const summary = `الاسم: ${selectedPartner.nameAr}\nالكود: ${selectedPartner.code}\nالهاتف: ${selectedPartner.phone || '-'}\nالبريد: ${selectedPartner.email || '-'}\nالعنوان: ${selectedPartner.address || '-'}`;
                  navigator.clipboard.writeText(summary);
                  showSuccessNotification('تم النسخ', 'تم نسخ كامل بطاقة الطرف إلى الحافظة');
                }}
              >
                نسخ كامل بيانات الطرف
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default PartnersPage;
