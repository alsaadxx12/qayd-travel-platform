import React, { useState, useEffect } from 'react';
import {
  Paper,
  SegmentedControl,
  Button,
  TextInput,
  Badge,
  Modal,
  Menu,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconBuildingStore,
  IconPlus,
  IconEdit,
  IconTrash,
  IconStar,
  IconCheck,
  IconPhone,
  IconUser,
  IconMapPin,
} from '@tabler/icons-react';
import { AuditLogsPage } from './AuditLogsPage';
import { branchesApi, Branch } from '../api/branches';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';

export const BranchesSettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('branches');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State for Create / Edit
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  // Form Fields
  const [code, setCode] = useState<string>('');
  const [nameAr, setNameAr] = useState<string>('');
  const [city, setCity] = useState<string>('بغداد');
  const [managerName, setManagerName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [isMain, setIsMain] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const data = await branchesApi.getAll();
      setBranches(data);
    } catch (err: any) {
      showErrorNotification('خطأ في التحميل', err.message || 'تعذر تحميل قائمة الفروع');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleOpenAddModal = () => {
    setEditMode(false);
    setSelectedBranchId(null);
    setCode(`BR-0${branches.length + 1}`);
    setNameAr('');
    setCity('بغداد');
    setManagerName('');
    setAddress('');
    setPhone('');
    setIsMain(branches.length === 0);
    setModalOpen(true);
  };

  const handleOpenEditModal = (branch: Branch) => {
    setEditMode(true);
    setSelectedBranchId(branch.id);
    setCode(branch.code);
    setNameAr(branch.nameAr);
    setCity(branch.city);
    setManagerName(branch.managerName || '');
    setAddress(branch.address || '');
    setPhone(branch.phone || '');
    setIsMain(branch.isMain);
    setModalOpen(true);
  };

  const handleSaveBranch = async () => {
    if (!nameAr.trim()) {
      showErrorNotification('تنبيه الإدخال', 'يرجى إدخال اسم الفرع بالعربية');
      return;
    }
    if (!code.trim()) {
      showErrorNotification('تنبيه الإدخال', 'يرجى إدخال رمز الفرع');
      return;
    }

    setSaving(true);
    try {
      if (editMode && selectedBranchId) {
        await branchesApi.update(selectedBranchId, {
          code,
          nameAr,
          city,
          managerName,
          address,
          phone,
          isMain,
        });
        showSuccessNotification('تمت العملية بنجاح', `تم تحديث بيانات الفرع (${nameAr}) بنجاح.`);
      } else {
        await branchesApi.create({
          code,
          nameAr,
          city,
          managerName,
          address,
          phone,
          isMain,
          status: 'نشط',
        });
        showSuccessNotification('تمت العملية بنجاح', `تم إنشاء الفرع الجديد (${nameAr}) بنجاح في قاعدة البيانات.`);
      }
      setModalOpen(false);
      fetchBranches();
    } catch (err: any) {
      showErrorNotification('خطأ في العملية', err.message || 'تعذر حفظ بيانات الفرع');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBranch = async (branch: Branch) => {
    if (branch.isMain) {
      showErrorNotification('تنبيه الحذف', 'لا يمكن حذف المركز الرئيسي للشؤون المالية');
      return;
    }

    try {
      await branchesApi.delete(branch.id);
      showSuccessNotification('تم الحذف', `تم حذف الفرع (${branch.nameAr}) بنجاح.`);
      fetchBranches();
    } catch (err: any) {
      showErrorNotification('خطأ في الحذف', err.message || 'تعذر حذف الفرع');
    }
  };

  return (
    <div className="space-y-3 w-full select-none">
      <Paper p="xs" radius="sm" withBorder className="bg-white space-y-2 no-print shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
          <div className="flex items-center gap-2">
            <IconBuildingStore size={18} className="text-emerald-700" />
            <h1 className="font-extrabold text-xs text-slate-900">إدارة الفروع والهيكلة الإدارية (Branches & System Administration)</h1>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge size="xs" color="emerald" variant="light">
              الشركة: شركة الفرسان للسياحة والسفر
            </Badge>
          </div>
        </div>

        {/* Tab Navigation */}
        <SegmentedControl
          size="xs"
          fullWidth
          value={activeTab}
          onChange={setActiveTab}
          data={[
            { label: 'إدارة الفروع والهيكلة', value: 'branches' },
            { label: 'الفترات المالية المحاسبية', value: 'periods' },
            { label: 'المستخدمون والصلاحيات', value: 'users' },
            { label: 'سجل العمليات والرقابة', value: 'audit-logs' },
          ]}
          color="emerald"
        />
      </Paper>

      {/* Tab 1: Branches & Hierarchy */}
      {activeTab === 'branches' && (
        <Paper p="xs" radius="sm" withBorder className="bg-white space-y-3">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <div>
              <span className="font-extrabold text-xs text-slate-900 block">فروع وهيكلة شركة الفرسان المحاسبية</span>
              <span className="text-[11px] text-slate-500">إجمالي الفروع المسجلة: {branches.length} فرع</span>
            </div>

            <Button
              size="xs"
              color="emerald"
              leftSection={<IconPlus size={14} />}
              onClick={handleOpenAddModal}
              className="font-bold cursor-pointer"
            >
              إضافة فرع جديد
            </Button>
          </div>

          <div className="border border-slate-300 rounded overflow-hidden">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-900 h-[36px]">
                  <th className="py-1 px-2 border-l border-slate-300 w-24">رمز الفرع</th>
                  <th className="py-1 px-2 border-l border-slate-300">اسم الفرع</th>
                  <th className="py-1 px-2 border-l border-slate-300 w-24">المدينة</th>
                  <th className="py-1 px-2 border-l border-slate-300 w-36">مدير الفرع المسجل</th>
                  <th className="py-1 px-2 border-l border-slate-300 w-32">الهاتف والعنوان</th>
                  <th className="py-1 px-2 border-l border-slate-300 w-28 text-center">النوع الهيكلي</th>
                  <th className="py-1 px-2 border-l border-slate-300 w-20 text-center">الحالة</th>
                  <th className="py-1 px-2 w-16 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-bold">
                      جاري تحميل بيانات الفروع...
                    </td>
                  </tr>
                ) : branches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 font-bold">
                      لا توجد فروع مسجلة حالياً.
                    </td>
                  </tr>
                ) : (
                  branches.map((b) => (
                    <tr key={b.id} className="h-[36px] hover:bg-slate-50 border-b border-slate-200 transition-colors">
                      <td className="py-1 px-2 border-l border-slate-200 font-mono font-bold text-emerald-800">
                        {b.code}
                      </td>
                      <td className="py-1 px-2 border-l border-slate-200 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          {b.isMain && <IconStar size={14} className="text-amber-500 fill-amber-500 shrink-0" />}
                          <span>{b.nameAr}</span>
                        </div>
                      </td>
                      <td className="py-1 px-2 border-l border-slate-200 text-slate-700 font-medium">
                        {b.city}
                      </td>
                      <td className="py-1 px-2 border-l border-slate-200 text-slate-800 font-semibold">
                        {b.managerName || '-'}
                      </td>
                      <td className="py-1 px-2 border-l border-slate-200 text-slate-600 text-[11px]">
                        <div>{b.phone || '-'}</div>
                        <div className="text-[10px] text-slate-400">{b.address || ''}</div>
                      </td>
                      <td className="py-1 px-2 border-l border-slate-200 text-center">
                        <Badge size="xs" color={b.isMain ? 'emerald' : 'gray'} variant={b.isMain ? 'filled' : 'light'}>
                          {b.isMain ? 'المركز الرئيسي' : 'فرع تابع'}
                        </Badge>
                      </td>
                      <td className="py-1 px-2 border-l border-slate-200 text-center font-semibold">
                        <Badge size="xs" color={b.status === 'نشط' ? 'emerald' : 'red'} variant="light">
                          {b.status}
                        </Badge>
                      </td>
                      <td className="py-1 px-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Tooltip label="تعديل بيانات والمدير المسؤول">
                            <Button
                              size="xs"
                              variant="light"
                              color="emerald"
                              leftSection={<IconEdit size={13} />}
                              onClick={() => handleOpenEditModal(b)}
                              className="h-7 px-2 text-[11px] font-bold cursor-pointer"
                            >
                              تعديل
                            </Button>
                          </Tooltip>

                          {!b.isMain ? (
                            <Tooltip label="حذف الفرع">
                              <ActionIcon
                                size="sm"
                                variant="light"
                                color="red"
                                onClick={() => handleDeleteBranch(b)}
                                className="h-7 w-7 cursor-pointer"
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Tooltip>
                          ) : (
                            <Badge size="xs" color="emerald" variant="outline" className="text-[10px]">
                              رئيسي
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Paper>
      )}

      {/* Tab 2: Fiscal Periods */}
      {activeTab === 'periods' && (
        <Paper p="xs" radius="sm" withBorder className="bg-white space-y-3">
          <span className="font-extrabold text-xs text-slate-900 block">الفترات المالية المحاسبية (Fiscal Periods 2026)</span>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded flex justify-between items-center text-xs">
            <div>
              <span className="font-bold text-slate-900 block text-sm">السنة المالية 2026 (مفتوحة)</span>
              <span className="text-[11px] text-slate-500">من 2026/01/01 إلى 2026/12/31</span>
            </div>
            <Badge color="emerald">مسموح بالإدخال والترحيل</Badge>
          </div>
        </Paper>
      )}

      {/* Tab 3: Users & Roles */}
      {activeTab === 'users' && (
        <Paper p="xs" radius="sm" withBorder className="bg-white space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-extrabold text-xs text-slate-900">مستخدمو النظام وصلاحيات الفروع</span>
            <Button size="xs" color="emerald" leftSection={<IconPlus size={14} />}>
              مستخدم جديد
            </Button>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
            <div className="flex justify-between items-center font-bold text-slate-800">
              <span>أحمد المحمود (مدير النظام)</span>
              <Badge color="emerald">جميع الفروع</Badge>
            </div>
            <span className="text-[11px] text-slate-500 block">صلاحية كاملة لإدارة التقارير المجمعة والفروع</span>
          </div>
        </Paper>
      )}

      {/* Tab 4: Audit Logs */}
      {activeTab === 'audit-logs' && <AuditLogsPage />}

      {/* Modal for Add/Edit Branch */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          <span className="font-bold text-xs text-slate-900">
            {editMode ? 'تعديل بيانات الفرع' : 'إضافة فرع جديد للشركة'}
          </span>
        }
        size="md"
        dir="rtl"
        centered
      >
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <TextInput
              label="رمز الفرع *"
              placeholder="BR-01"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <TextInput
              label="اسم الفرع بالعربية *"
              placeholder="فرع الكرخ / النجف"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <TextInput
              label="المدينة *"
              placeholder="بغداد / أربيل / النجف"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
            <TextInput
              label="اسم مدير الفرع"
              placeholder="أحمد المحمود"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              leftSection={<IconUser size={14} />}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <TextInput
              label="رقم الهاتف"
              placeholder="07801234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              leftSection={<IconPhone size={14} />}
            />
            <TextInput
              label="العنوان"
              placeholder="الكرادة - الشارع الرئيسي"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              leftSection={<IconMapPin size={14} />}
            />
          </div>

          <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded">
            <input
              type="checkbox"
              id="isMain"
              checked={isMain}
              onChange={(e) => setIsMain(e.target.checked)}
              className="accent-emerald-700 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="isMain" className="font-bold text-slate-800 cursor-pointer">
              تعيين كمركز رئيسي للشؤون المالية والإدارية
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button size="xs" variant="outline" color="gray" onClick={() => setModalOpen(false)}>
              إلغاء
            </Button>
            <Button size="xs" color="emerald" loading={saving} onClick={handleSaveBranch}>
              {editMode ? 'حفظ التعديلات' : 'إنشاء الفرع'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
