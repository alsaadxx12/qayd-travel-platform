import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Paper, Button, Select, SegmentedControl, Badge } from '@mantine/core';
import {
  IconBuilding,
  IconDeviceFloppy,
  IconUpload,
  IconTrash,
  IconPhoto,
  IconBuildingStore,
} from '@tabler/icons-react';
import { branchesApi, type Branch } from '../../api/branches';
import { fetchPrintTemplate, savePrintTemplate } from '../../api/printTemplates';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';

export const CompanySettingsPage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const [branches, setBranches] = useState<Branch[]>([]);
  const [logoSourceMode, setLogoSourceMode] = useState<'BRANCH' | 'CUSTOM'>('BRANCH');
  const [selectedLogoBranchId, setSelectedLogoBranchId] = useState<string>('');
  const [customLogoUrl, setCustomLogoUrl] = useState<string>('');
  const [existingTemplateConfig, setExistingTemplateConfig] = useState<any>({});
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const activeLogoUrl = useMemo(() => {
    if (logoSourceMode === 'BRANCH') {
      const b = branches.find(item => item.id === selectedLogoBranchId);
      return b?.logo || '';
    }
    return customLogoUrl;
  }, [logoSourceMode, selectedLogoBranchId, customLogoUrl, branches]);

  const handleCustomLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const result = evt.target?.result as string;
        setCustomLogoUrl(result);
        setLogoSourceMode('CUSTOM');
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    branchesApi
      .getAll()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setBranches(data);
          if (!selectedLogoBranchId) {
            setSelectedLogoBranchId(data[0].id);
          }
        }
      })
      .catch(() => {});

    // Load existing template config
    fetchPrintTemplate('statement')
      .then((res) => {
        if (res && res.config) {
          setExistingTemplateConfig(res.config);
          if (res.config.logoSourceMode) setLogoSourceMode(res.config.logoSourceMode);
          if (res.config.selectedLogoBranchId) setSelectedLogoBranchId(res.config.selectedLogoBranchId);
          if (res.config.customLogoUrl) setCustomLogoUrl(res.config.customLogoUrl);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveLogoSettings = async () => {
    setIsSavingLogo(true);
    try {
      const activeLogo = activeLogoUrl;
      let baseConfig = existingTemplateConfig;
      try {
        const latest = await fetchPrintTemplate('statement');
        if (latest && latest.config) {
          baseConfig = latest.config;
        }
      } catch {}

      const newConfig = {
        ...baseConfig,
        logoSourceMode,
        selectedLogoBranchId,
        customLogoUrl,
        logoUrl: activeLogo,
      };

      await savePrintTemplate('statement', newConfig);
      setExistingTemplateConfig(newConfig);

      showSuccessNotification(
        isAr ? 'تم حفظ الشعار' : 'Logo Saved',
        isAr ? 'تم حفظ وتحديث الشعار المعتمد بنجاح في قاعدة البيانات لكشوفات الحساب' : 'Logo saved successfully'
      );
    } catch (err) {
      showErrorNotification(
        isAr ? 'خطأ في الحفظ' : 'Save Error',
        isAr ? 'تعذر حفظ الشعار المعتمد في قاعدة البيانات' : 'Failed to save logo'
      );
    } finally {
      setIsSavingLogo(false);
    }
  };

  return (
    <div
      className="p-4 md:p-6 space-y-4 max-w-[1200px] mx-auto select-none"
      dir={direction}
      style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', system-ui, sans-serif" : "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}
    >
      {/* Page Header */}
      <Paper p="sm" radius="md" withBorder className="bg-white shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F45A0A] flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <IconBuilding size={20} />
            </div>
            <div>
              <h1 className="font-black text-sm text-slate-900">
                {isAr ? 'إعدادات الشركة والشعار' : 'Company & Logo Settings'}
              </h1>
              <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                {isAr
                  ? 'إدارة شعار المؤسسة المعتمد لكشوفات الحساب والمستندات الرسمية'
                  : 'Manage the official company logo for account statements and documents'}
              </p>
            </div>
          </div>
          <Badge size="sm" color="orange" variant="filled" className="font-black px-3">
            {isAr ? 'إعدادات الشركة' : 'Company Settings'}
          </Badge>
        </div>
      </Paper>

      {/* Logo Settings */}
      <Paper p="md" radius="md" withBorder className="bg-white shadow-2xs">
        <div className="space-y-4 text-xs">
          <input
            type="file"
            ref={logoFileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleCustomLogoUpload}
          />

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <IconPhoto size={20} className="text-[#F45A0A]" />
                  <span>{isAr ? 'اعتماد شعار (لوجو) المستندات وكشوفات الحساب' : 'Adopt Document & Statement Logo'}</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {isAr
                    ? 'حدد شعار الفرع المطلوب اعتماده لكشوفات الحساب أو قم برفع شعار مخصص'
                    : 'Select a branch logo or upload a custom one for account statements'}
                </p>
              </div>
              <SegmentedControl
                size="xs"
                radius="md"
                value={logoSourceMode}
                onChange={(v) => setLogoSourceMode(v as 'BRANCH' | 'CUSTOM')}
                data={[
                  { label: isAr ? '🏢 شعار فرع معتمد' : '🏢 Branch Logo', value: 'BRANCH' },
                  { label: isAr ? '🎨 شعار مخصص' : '🎨 Custom Logo', value: 'CUSTOM' },
                ]}
                color="orange"
                className="font-bold"
              />
            </div>

            {/* Mode A: Branch Logo Selection */}
            {logoSourceMode === 'BRANCH' && (
              <div className="space-y-2">
                <Select
                  size="xs"
                  label={isAr ? 'اختر الفرع المطلوب اعتماد شعاره للمستندات والكشوفات:' : 'Select branch for document logo:'}
                  placeholder={isAr ? 'اختر الفرع...' : 'Select branch...'}
                  data={branches.map((b) => ({
                    value: b.id,
                    label: `${b.nameAr} (${b.code || 'BGD'})${b.logo ? (isAr ? ' — (يوجد شعار مرفع للفرع)' : ' — (has logo)') : (isAr ? ' — (بدون شعار مرفع)' : ' — (no logo)')}`,
                  }))}
                  value={selectedLogoBranchId}
                  onChange={(v) => v && setSelectedLogoBranchId(v)}
                  className="font-bold"
                  leftSection={<IconBuildingStore size={14} className="text-[#F45A0A]" />}
                />
              </div>
            )}

            {/* Mode B: Custom Logo Upload */}
            {logoSourceMode === 'CUSTOM' && (
              <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                <Button
                  size="xs"
                  variant="outline"
                  color="orange"
                  leftSection={<IconUpload size={14} />}
                  onClick={() => logoFileInputRef.current?.click()}
                  className="font-bold text-xs"
                >
                  {isAr ? 'رفع صورة شعار مخصص من الجهاز' : 'Upload custom logo'}
                </Button>

                {customLogoUrl && (
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    leftSection={<IconTrash size={14} />}
                    onClick={() => setCustomLogoUrl('')}
                    className="font-bold text-xs"
                  >
                    {isAr ? 'حذف الشعار المخصص' : 'Remove custom logo'}
                  </Button>
                )}
              </div>
            )}

            {/* Active Adopted Logo Preview Card */}
            <div className="bg-white p-3.5 rounded-xl border border-orange-200 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                {activeLogoUrl ? (
                  <img
                    src={activeLogoUrl}
                    alt="Active Logo"
                    className="w-14 h-14 object-contain rounded-lg border p-1 bg-white shadow-2xs"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#C2410C] font-black text-xs">
                    {isAr ? 'لا يوجد شعار' : 'No logo'}
                  </div>
                )}
                <div>
                  <span className="font-extrabold text-xs text-slate-900 block">
                    {isAr ? 'الشعار المحدد حالياً:' : 'Currently selected logo:'}
                  </span>
                  <span className="text-[11px] text-[#C2410C] font-bold">
                    {logoSourceMode === 'BRANCH'
                      ? `${isAr ? 'فرع' : 'Branch'}: ${branches.find(b => b.id === selectedLogoBranchId)?.nameAr || (isAr ? 'الفرع المحدد' : 'Selected branch')}`
                      : (customLogoUrl ? (isAr ? 'شعار مخصص تم رفعه' : 'Custom uploaded logo') : (isAr ? 'لم يتم تحديد شعار مخصص بعد' : 'No custom logo selected'))}
                  </span>
                </div>
              </div>

              <Button
                color="orange"
                size="xs"
                loading={isSavingLogo}
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleSaveLogoSettings}
                className="font-extrabold px-4 bg-[#F45A0A] hover:bg-[#DD4F05]"
              >
                {isAr ? 'حفظ التغييرات واعتماد الشعار' : 'Save & Apply Logo'}
              </Button>
            </div>
          </div>
        </div>
      </Paper>
    </div>
  );
};
