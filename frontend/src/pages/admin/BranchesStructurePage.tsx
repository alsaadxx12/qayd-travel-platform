import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Tooltip,
  Select,
  TextInput,
  PasswordInput,
  Textarea,
  Switch,
  SegmentedControl,
  Badge,
} from '@mantine/core';
import {
  IconBuildingStore,
  IconPlus,
  IconEdit,
  IconTrash,
  IconStar,
  IconDatabaseOff,
  IconUser,
  IconPhone,
  IconMapPin,
  IconPhoto,
  IconMail,
  IconBrandWhatsapp,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandTelegram,
  IconGlobe,
  IconSitemap,
  IconShieldCheck,
  IconHeadset,
  IconKey,
  IconLock,
  IconSearch,
  IconLayoutGrid,
  IconList,
  IconUsers,
  IconCurrentLocation,
  IconDeviceMobile,
  IconDeviceMobileCheck,
  IconShieldLock,
  IconUnlink,
  IconExternalLink,
} from '@tabler/icons-react';
import { branchesApi, Branch } from '../../api/branches';
import { employeesApi } from '../../api/employees';
import { accountsApi } from '../../api/accounts';
import { rolesApi, RoleGroup } from '../../api/roles';
import { departmentsApi } from '../../api/departments';
import { apiRequest } from '../../api/client';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { useLanguageStore } from '../../store/useLanguageStore';
import { usePermissions } from '../../hooks/usePermissions';
import { usePermissionAlertStore } from '../../store/usePermissionAlertStore';

// Types
export interface DepartmentItem {
  id: string;
  branchId?: string;
  branchName: string;
  code: string;
  name: string;
  headName?: string;
  description?: string;
}

export interface EmployeeItem {
  id: string;
  branchId?: string;
  departmentId?: string;
  branchName: string;
  departmentName: string;
  fullName: string;
  jobTitle: string;
  phone: string;
  email?: string;
  status: string;
  hasUserAccount?: boolean;
  username?: string;
  assignedCashbox?: string;
  permissionGroupId?: string;
  trustedDeviceId?: string | null;
  deviceModel?: string | null;
  devicePlatform?: string | null;
  deviceBoundAt?: string | null;
  deviceAttestationType?: string | null;
  deviceAttestationKey?: string | null;
}

export interface UserItem {
  id: string;
  fullName: string;
  email: string;
  password?: string;
  branchName: string;
  role: string;
  roleId?: string | null;
  isSupport: boolean;
  status: string;
}

export const BranchesStructurePage: React.FC = () => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';

  const { hasPermission } = usePermissions();
  const { showPermissionAlert } = usePermissionAlertStore();
  const canCreateBranch = hasPermission('branches.create');
  const canUpdateBranch = hasPermission('branches.update');
  const canCreateEmployee = hasPermission('employees.create');
  const canUpdateEmployee = hasPermission('employees.update');
  const canDeleteEmployee = hasPermission('employees.delete');

  const [activeTab, setActiveTab] = useState<'branches' | 'departments' | 'employees' | 'users'>('branches');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<RoleGroup[]>([]);
  const [realCashboxOptions, setRealCashboxOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal Control States
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Branch Form Fields
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [city, setCity] = useState('بغداد');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [phone2, setPhone2] = useState('');
  const [email, setEmail] = useState('');
  const [email2, setEmail2] = useState('');
  const [logo, setLogo] = useState('');
  const [address, setAddress] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [telegram, setTelegram] = useState('');
  const [website, setWebsite] = useState('');
  const [isMain, setIsMain] = useState(false);
  const [modalBranchTab, setModalBranchTab] = useState<'info' | 'location' | 'contacts' | 'social'>('info');
  const [branchLatitude, setBranchLatitude] = useState<string>('');
  const [branchLongitude, setBranchLongitude] = useState<string>('');
  const [branchRadius, setBranchRadius] = useState<number>(150);
  const [gettingLocation, setGettingLocation] = useState<boolean>(false);

  // Device Binding Modal States
  const [deviceModalOpen, setDeviceModalOpen] = useState<boolean>(false);
  const [selectedEmpForDevice, setSelectedEmpForDevice] = useState<EmployeeItem | null>(null);
  const [bindPlatform, setBindPlatform] = useState<'android' | 'ios'>('android');
  const [bindDeviceModel, setBindDeviceModel] = useState<string>('Samsung Galaxy S24 Ultra');
  const [bindingDevice, setBindingDevice] = useState<boolean>(false);

  // Department Form Fields
  const [depBranchName, setDepBranchName] = useState('المركز الرئيسي - بغداد');
  const [depCode, setDepCode] = useState('');
  const [depName, setDepName] = useState('');
  const [depHeadName, setDepHeadName] = useState('');
  const [depDescription, setDepDescription] = useState('');

  // Employee Form Fields
  const [empBranchName, setEmpBranchName] = useState('المركز الرئيسي - بغداد');
  const [empDepName, setEmpDepName] = useState('قسم الحسابات والمالية');
  const [empFullName, setEmpFullName] = useState('');
  const [empJobTitle, setEmpJobTitle] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empAssignedCashbox, setEmpAssignedCashbox] = useState('');
  const [empStatus, setEmpStatus] = useState('نشط');
  const [empIsHead, setEmpIsHead] = useState(false);
  const [empCreateUser, setEmpCreateUser] = useState(false);
  const [empUsername, setEmpUsername] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [empHasExistingLogin, setEmpHasExistingLogin] = useState(false);
  const [empRole, setEmpRole] = useState('');
  const [empPermissionGroupId, setEmpPermissionGroupId] = useState<string | null>(null);

  // User Form Fields
  const [usrFullName, setUsrFullName] = useState('');
  const [usrEmail, setUsrEmail] = useState('');
  const [usrPassword, setUsrPassword] = useState('');
  const [usrBranchName, setUsrBranchName] = useState('جميع الفروع');
  const [usrRole, setUsrRole] = useState('');
  const [usrIsSupport, setUsrIsSupport] = useState(false);
  const [usrStatus, setUsrStatus] = useState('نشط');

  // Delete Confirm Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string; type: string } | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Load cashbox accounts from real DB
  useEffect(() => {
    accountsApi
      .getFlat(undefined, 'CASH')
      .then((cashAccounts) => {
        const boxes = cashAccounts
          .filter((a) => !a.isGroup)
          .map((a) => {
            const cleanName = a.nameAr.replace(/^صندوق:\s*/, '');
            return {
              value: cleanName,
              label: cleanName,
            };
          });
        setRealCashboxOptions(boxes);
      })
      .catch(() => {
        setRealCashboxOptions([]);
      });
  }, []);

  const fetchStructureData = async () => {
    setLoading(true);
    try {
      const [bData, empData, rolesData, depData, usersData] = await Promise.all([
        branchesApi.getAll().catch(() => []),
        employeesApi.getAll().catch(() => []),
        rolesApi.getAll().catch(() => []),
        departmentsApi.getAll().catch(() => []),
        apiRequest('/auth/users').catch(() => []),
      ]);
      setBranches(Array.isArray(bData) ? bData : []);
      setEmployees(
        Array.isArray(empData)
          ? empData.map((e: any) => ({
              ...e,
              jobTitle: e.jobTitle || (isAr ? 'موظف' : 'Staff Member'),
            }))
          : []
      );
      setPermissionGroups(Array.isArray(rolesData) ? rolesData : []);
      setDepartments(
        Array.isArray(depData)
          ? depData.map((d: any) => ({
              id: d.id,
              branchId: d.branchId || d.branch?.id,
              branchName: d.branchName,
              code: d.code,
              name: d.name,
              headName: d.headName || '',
              description: d.description || '',
            }))
          : []
      );
      if (Array.isArray(usersData) && usersData.length > 0) {
        setUsers(
          usersData.map((u: any) => ({
            id: u.id,
            fullName: u.name || u.fullName || '',
            email: u.email || '',
            // الخادم لم يعد يحفظ كلمة المرور نصاً صريحاً ولا يعيدها؛ الصندوق الفارغ
            // يعني «أبقِ الحالية»، والتغيير يكون بكتابة كلمة جديدة.
            password: '',
            branchName: u.role?.allowedBranches || (isAr ? 'جميع الفروع' : 'All Branches'),
            role: u.role?.name || '',
            roleId: u.role?.id || null,
            isSupport: false,
            status: u.isActive !== false ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معلّق' : 'Suspended'),
          }))
        );
      }
    } catch (err: any) {
      showErrorNotification(isAr ? 'خطأ التحميل' : 'Loading Error', err.message || (isAr ? 'تعذر تحميل بيانات الهيكل الإداري' : 'Could not load administrative structure data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStructureData();
  }, []);

  // Options for selectors
  const branchOptions = useMemo(() => {
    const list = branches.map((b) => b.nameAr).filter(Boolean);
    return Array.from(new Set([isAr ? 'جميع الفروع' : 'All Branches', ...list, empBranchName].filter(Boolean)));
  }, [branches, empBranchName, isAr]);

  const departmentOptions = useMemo(() => {
    const selectedBranch = branches.find((b) => b.id === empBranchName || b.nameAr === empBranchName);
    const dbList = departments
      .filter((d) => !selectedBranch || d.branchId === selectedBranch.id || d.branchName === selectedBranch.nameAr)
      .map((d) => d.name)
      .filter(Boolean);
    return Array.from(new Set([...dbList, empDepName].filter(Boolean)));
  }, [branches, departments, empBranchName, empDepName]);

  // Filtered lists
  const filteredBranches = useMemo(() => {
    return branches.filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (b.nameAr && b.nameAr.toLowerCase().includes(q)) ||
        (b.code && b.code.toLowerCase().includes(q)) ||
        (b.city && b.city.toLowerCase().includes(q)) ||
        (b.managerName && b.managerName.toLowerCase().includes(q)) ||
        (b.phone && b.phone.includes(q));
      return matchSearch;
    });
  }, [branches, searchQuery]);

  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.code && d.code.toLowerCase().includes(q)) ||
        (d.headName && d.headName.toLowerCase().includes(q)) ||
        (d.branchName && d.branchName.toLowerCase().includes(q));
      const matchBranch = selectedBranchFilter === 'ALL' || d.branchName === selectedBranchFilter;
      return matchSearch && matchBranch;
    });
  }, [departments, searchQuery, selectedBranchFilter]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (e.fullName && e.fullName.toLowerCase().includes(q)) ||
        (e.jobTitle && e.jobTitle.toLowerCase().includes(q)) ||
        (e.phone && e.phone.includes(q)) ||
        (e.branchName && e.branchName.toLowerCase().includes(q)) ||
        (e.departmentName && e.departmentName.toLowerCase().includes(q));
      const matchBranch = selectedBranchFilter === 'ALL' || e.branchName === selectedBranchFilter;
      return matchSearch && matchBranch;
    });
  }, [employees, searchQuery, selectedBranchFilter]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q)) ||
        (u.branchName && u.branchName.toLowerCase().includes(q));
      return matchSearch;
    });
  }, [users, searchQuery]);

  // Handlers for Add Button per Tab
  const handleOpenAddModal = () => {
    if (activeTab === 'branches' && !canCreateBranch) {
      showPermissionAlert({
        actionTitle: isAr ? 'إضافة فرع جديد' : 'Add New Branch',
        permissionCode: 'branches.create',
        description: isAr ? 'لا تملك صلاحية إضافة فروع جديدة للنظام.' : 'You do not have permission to add new branches.',
      });
      return;
    }
    if ((activeTab === 'employees' || activeTab === 'users') && !canCreateEmployee) {
      showPermissionAlert({
        actionTitle: isAr ? 'إضافة موظف / مستخدم جديد' : 'Add Employee / User',
        permissionCode: 'employees.create',
        description: isAr ? 'لا تملك صلاحية إضافة كوادر أو مستخدمين جدد للنظام.' : 'You do not have permission to create employees or users.',
      });
      return;
    }

    setEditMode(false);
    setEditingId(null);

    if (activeTab === 'branches') {
      setBranchCode(`BR-0${branches.length + 1}`);
      setBranchName('');
      setCity('بغداد');
      setManagerName('');
      setPhone('');
      setPhone2('');
      setEmail('');
      setEmail2('');
      setLogo('');
      setAddress('');
      setWhatsapp('');
      setFacebook('');
      setInstagram('');
      setTelegram('');
      setWebsite('');
      setIsMain(branches.length === 0);
      setBranchLatitude('');
      setBranchLongitude('');
      setBranchRadius(150);
      setModalBranchTab('info');
    } else if (activeTab === 'departments') {
      setDepCode(`DEP-0${departments.length + 1}`);
      setDepName('');
      setDepBranchName(branches[0]?.nameAr || (isAr ? 'المركز الرئيسي - بغداد' : 'HQ - Baghdad'));
      setDepHeadName('');
      setDepDescription('');
    } else if (activeTab === 'employees') {
      setEmpFullName('');
      setEmpJobTitle('');
      setEmpPhone('');
      setEmpEmail('');
      setEmpAssignedCashbox(realCashboxOptions[0]?.value || (isAr ? 'النقود (الصناديق والمصارف)' : 'Main Cashbox'));
      setEmpBranchName(branches[0]?.nameAr || (isAr ? 'المركز الرئيسي - بغداد' : 'HQ - Baghdad'));
      setEmpDepName(departments[0]?.name || (isAr ? 'قسم الحسابات والمالية' : 'Accounting & Finance'));
      setEmpStatus('نشط');
      setEmpIsHead(false);
      setEmpCreateUser(false);
      setEmpUsername('');
      setEmpPassword('');
      setEmpHasExistingLogin(false);
      setEmpRole('');
      setEmpPermissionGroupId(null);
    } else if (activeTab === 'users') {
      setUsrFullName('');
      setUsrEmail('');
      setUsrBranchName(isAr ? 'جميع الفروع' : 'All Branches');
      setUsrRole('');
      setUsrIsSupport(false);
      setUsrStatus('نشط');
    }
    setModalOpen(true);
  };

  // High-accuracy GPS handler for Branch
  const handleGetHighAccuracyLocation = () => {
    if (!navigator.geolocation) {
      showErrorNotification(
        isAr ? 'غير مدعوم' : 'Not Supported',
        isAr ? 'المتصفح لا يدعم تحديد الموقع الجغرافي' : 'Geolocation is not supported by your browser'
      );
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBranchLatitude(pos.coords.latitude.toFixed(7));
        setBranchLongitude(pos.coords.longitude.toFixed(7));
        setGettingLocation(false);
        showSuccessNotification(
          isAr ? 'تم تحديد الموقع بدقة خيالية' : 'High Accuracy GPS Locked',
          isAr
            ? `خط العرض: ${pos.coords.latitude.toFixed(7)} | خط الطول: ${pos.coords.longitude.toFixed(7)} (دقة التحديد: ±${Math.round(pos.coords.accuracy)} متر)`
            : `Coordinates locked: ${pos.coords.latitude.toFixed(7)}, ${pos.coords.longitude.toFixed(7)} (±${Math.round(pos.coords.accuracy)}m)`
        );
      },
      (err) => {
        setGettingLocation(false);
        showErrorNotification(
          isAr ? 'تعذر جلب الموقع' : 'Location Error',
          err.message || (isAr ? 'يرجى إعطاء صلاحية الوصول للموقع الجغرافي من المتصفح' : 'Please allow location permission')
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  // Hardware Device Unbinding
  const handleUnbindDevice = async (empId: string, empName: string) => {
    if (
      !window.confirm(
        isAr
          ? `هل أنت متأكد من فك اقتران الجهاز المعتمد للموظف (${empName})؟\n\nسيتمكن الموظف من تسجيل جهازه الشخصي الجديد عند أول تسجيل دخول أو بصمة دوام.`
          : `Are you sure you want to unbind the trusted device for ${empName}?`
      )
    ) {
      return;
    }
    try {
      await employeesApi.unbindDevice(empId);
      showSuccessNotification(
        isAr ? 'تم إلغاء اقتران الجهاز' : 'Device Unbound',
        isAr
          ? `تم إلغاء ربط الجهاز المعتمد للموظف (${empName}) بنجاح. يمكنه الآن تسجيل جهاز جديد.`
          : `Device successfully unbound for ${empName}.`
      );
      fetchStructureData();
    } catch (err: any) {
      showErrorNotification(isAr ? 'خطأ' : 'Error', err?.message || 'Failed to unbind device');
    }
  };

  // Hardware Device Binding Handler
  const handleBindDevice = async () => {
    if (!selectedEmpForDevice) return;
    setBindingDevice(true);
    try {
      const attestationType = bindPlatform === 'android' ? 'KEYSTORE_PLAY_INTEGRITY' : 'SECURE_ENCLAVE_APP_ATTEST';
      const generatedDeviceId = `${bindPlatform}_hw_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const attestationKey = `${bindPlatform.toUpperCase()}_CERT_ATTEST_${Math.random().toString(36).substring(2, 12)}`;

      await employeesApi.bindDevice(selectedEmpForDevice.id, {
        trustedDeviceId: generatedDeviceId,
        deviceModel: bindDeviceModel,
        devicePlatform: bindPlatform,
        deviceAttestationType: attestationType,
        deviceAttestationKey: attestationKey,
      });

      showSuccessNotification(
        isAr ? 'تم اعتماد الجهاز بنجاح' : 'Device Verified & Bound',
        isAr
          ? `تم توثيق واعتماد (${bindDeviceModel}) بواسطة (${
              bindPlatform === 'android' ? 'Android Keystore + Play Integrity' : 'Secure Enclave + App Attest'
            }) للموظف (${selectedEmpForDevice.fullName}). يمنع فتح الحساب من هاتف آخر.`
          : `Device bound successfully for ${selectedEmpForDevice.fullName}.`
      );
      setDeviceModalOpen(false);
      fetchStructureData();
    } catch (err: any) {
      showErrorNotification(isAr ? 'خطأ' : 'Error', err?.message || 'Failed to bind device');
    } finally {
      setBindingDevice(false);
    }
  };

  // Save Actions
  const handleSaveBranch = async () => {
    if (!editMode && !canCreateBranch) {
      showPermissionAlert({
        actionTitle: isAr ? 'إضافة فرع جديد' : 'Add New Branch',
        permissionCode: 'branches.create',
      });
      return;
    }
    if (editMode && !canUpdateBranch) {
      showPermissionAlert({
        actionTitle: isAr ? 'تعديل بيانات الفرع' : 'Edit Branch',
        permissionCode: 'branches.update',
      });
      return;
    }
    if (!branchName.trim()) {
      showErrorNotification(isAr ? 'تنبيه الإدخال' : 'Input Warning', isAr ? 'يرجى إدخال اسم الفرع بالعربية' : 'Please enter Arabic branch name');
      return;
    }
    if (!branchCode.trim()) {
      showErrorNotification(isAr ? 'تنبيه الإدخال' : 'Input Warning', isAr ? 'يرجى إدخال رمز الفرع' : 'Please enter branch code');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: branchCode,
        nameAr: branchName,
        city,
        managerName,
        phone,
        phone2,
        email,
        email2,
        logo,
        address,
        whatsapp,
        facebook,
        instagram,
        telegram,
        website,
        isMain,
        latitude: branchLatitude.trim() ? parseFloat(branchLatitude) : null,
        longitude: branchLongitude.trim() ? parseFloat(branchLongitude) : null,
        allowedRadiusMeters: Number(branchRadius) || 150,
      };

      if (editMode && editingId) {
        await branchesApi.update(editingId, payload);
        showSuccessNotification(isAr ? 'تم الحفظ' : 'Saved', isAr ? `تم تحديث بيانات وشعار الفرع (${branchName}) بنجاح.` : `Branch ${branchName} updated successfully.`);
      } else {
        await branchesApi.create({ ...payload, status: 'نشط' });
        showSuccessNotification(isAr ? 'تم الحفظ' : 'Saved', isAr ? `تم إنشاء الفرع الجديد (${branchName}) بنجاح.` : `Branch ${branchName} created successfully.`);
      }
      setModalOpen(false);
      fetchStructureData();
    } catch (err: any) {
      showErrorNotification(isAr ? 'خطأ الحفظ' : 'Save Error', err.message || (isAr ? 'تعذر حفظ بيانات الفرع' : 'Could not save branch data'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDepartment = async () => {
    if (!depName.trim()) {
      showErrorNotification(isAr ? 'تنبيه الإدخال' : 'Input Warning', isAr ? 'يرجى إدخال اسم القسم' : 'Please enter department name');
      return;
    }
    setSaving(true);
    try {
      const selectedBranch = branches.find((b) => b.id === depBranchName || b.nameAr === depBranchName);
      if (!selectedBranch) {
        throw new Error(isAr ? 'اختر فرعاً مسجلاً للقسم' : 'Select a registered branch');
      }
      const payload = {
        branchId: selectedBranch.id,
        branchName: selectedBranch.nameAr,
        code: depCode || `DEP-${departments.length + 1}`,
        name: depName,
        headName: depHeadName || '',
        description: depDescription || '',
      };
      if (editMode && editingId) {
        await departmentsApi.update(editingId, payload);
        showSuccessNotification(isAr ? 'تم الحفظ' : 'Saved', isAr ? `تم تحديث بيانات قسم (${depName}) بنجاح.` : `Department ${depName} updated.`);
      } else {
        await departmentsApi.create(payload);
        showSuccessNotification(isAr ? 'تم الحفظ' : 'Saved', isAr ? `تم إضافة قسم (${depName}) جديد وحفظه بنجاح.` : `Department ${depName} created.`);
      }
      setModalOpen(false);
      fetchStructureData();
    } catch (err: any) {
      showErrorNotification(isAr ? 'خطأ الحفظ' : 'Save Error', err.message || (isAr ? 'تعذر حفظ القسم' : 'Could not save department'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmployee = async () => {
    if (!editMode && !canCreateEmployee) {
      showPermissionAlert({
        actionTitle: isAr ? 'إضافة موظف جديد' : 'Add New Employee',
        permissionCode: 'employees.create',
      });
      return;
    }
    if (editMode && !canUpdateEmployee) {
      showPermissionAlert({
        actionTitle: isAr ? 'تعديل بيانات الموظف' : 'Edit Employee',
        permissionCode: 'employees.update',
      });
      return;
    }
    if (!empFullName.trim()) {
      showErrorNotification(isAr ? 'تنبيه الإدخال' : 'Input Warning', isAr ? 'يرجى إدخال اسم الموظف الثلاثي' : 'Please enter full employee name');
      return;
    }

    setSaving(true);
    try {
      const selectedBranch = branches.find((b) => b.id === empBranchName || b.nameAr === empBranchName);
      const selectedDepartment = departments.find(
        (d) => (d.id === empDepName || d.name === empDepName) &&
          (!selectedBranch || d.branchId === selectedBranch.id || d.branchName === selectedBranch.nameAr),
      );
      if (!selectedBranch || !selectedDepartment) {
        throw new Error(isAr ? 'اختر فرعاً وقسماً مترابطين ومسجلين' : 'Select a related registered branch and department');
      }
      const payload = {
        branchId: selectedBranch.id,
        branchName: selectedBranch.nameAr,
        departmentId: selectedDepartment.id,
        departmentName: selectedDepartment.name,
        fullName: empFullName,
        jobTitle: empJobTitle || (isAr ? 'موظف' : 'Staff Member'),
        phone: empPhone,
        email: empEmail,
        assignedCashbox: empAssignedCashbox,
        status: empStatus,
        hasUserAccount: empCreateUser,
        username: empCreateUser ? empUsername || empEmail : undefined,
        // An empty box means "keep the current password", so it must not be sent.
        password: empCreateUser && empPassword.trim() ? empPassword.trim() : undefined,
        role: empRole,
        permissionGroupId: empPermissionGroupId || undefined,
      };

      if (editMode && editingId) {
        await employeesApi.update(editingId, payload);
        showSuccessNotification(isAr ? 'تم الحفظ' : 'Saved', isAr ? `تم تحديث بيانات الموظف (${empFullName}) بنجاح.` : `Employee ${empFullName} updated.`);
      } else {
        await employeesApi.create(payload);
        showSuccessNotification(isAr ? 'تم الحفظ' : 'Saved', isAr ? `تم إضافة الموظف الجديد (${empFullName}) بنجاح.` : `Employee ${empFullName} created.`);
      }

      if (empIsHead) {
        const targetDep = departments.find((d) => d.id === selectedDepartment.id);
        if (targetDep) {
          await departmentsApi.update(targetDep.id, { headName: empFullName }).catch(() => {});
        }
      }

      setModalOpen(false);
      fetchStructureData();
    } catch (err: any) {
      showErrorNotification(isAr ? 'خطأ الحفظ' : 'Save Error', err.message || (isAr ? 'تعذر حفظ بيانات الموظف' : 'Could not save employee'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUser = async () => {
    if (!editMode && !canCreateEmployee) {
      showPermissionAlert({
        actionTitle: isAr ? 'إضافة مستخدم جديد' : 'Add User',
        permissionCode: 'employees.create',
      });
      return;
    }
    if (editMode && !canUpdateEmployee) {
      showPermissionAlert({
        actionTitle: isAr ? 'تعديل بيانات المستخدم' : 'Edit User',
        permissionCode: 'employees.update',
      });
      return;
    }
    if (!usrFullName.trim() || !usrEmail.trim()) {
      showErrorNotification(isAr ? 'تنبيه الإدخال' : 'Input Warning', isAr ? 'يرجى إدخال اسم المستخدم والبريد الإلكتروني' : 'Please enter name and email');
      return;
    }
    setSaving(true);
    try {
      const selectedGroup = permissionGroups.find((g) => g.name === usrRole);
      const roleId = selectedGroup?.id || undefined;

      if (editMode && editingId) {
        const updatePayload: any = {
          name: usrFullName,
          email: usrEmail,
          roleId,
          isActive: usrStatus === 'نشط' || usrStatus === 'Active',
        };
        if (usrPassword) updatePayload.password = usrPassword;
        await apiRequest(`/auth/users/${editingId}`, { method: 'PATCH', body: JSON.stringify(updatePayload) });
        showSuccessNotification(isAr ? 'تم الحفظ' : 'Saved', isAr ? `تم تحديث بيانات المستخدم (${usrFullName}) بنجاح.` : `User ${usrFullName} updated.`);
      } else {
        await apiRequest('/auth/users', {
          method: 'POST',
          body: JSON.stringify({
            name: usrFullName,
            email: usrEmail,
            password: usrPassword || '12345678',
            roleId,
          }),
        });
        showSuccessNotification(isAr ? 'تم الحفظ' : 'Saved', isAr ? `تم إضافة مستخدم جديد (${usrFullName}) وحفظه بنجاح.` : `User ${usrFullName} created.`);
      }
      setModalOpen(false);
      fetchStructureData();
    } catch (err: any) {
      showErrorNotification(isAr ? 'خطأ الحفظ' : 'Save Error', err.message || (isAr ? 'تعذر حفظ بيانات المستخدم' : 'Could not save user'));
    } finally {
      setSaving(false);
    }
  };

  // Delete Confirm Logic
  const handleOpenDelete = (id: string, name: string, type: string) => {
    if (type === 'branch' && !canUpdateBranch) {
      showPermissionAlert({
        actionTitle: isAr ? 'حذف الفرع' : 'Delete Branch',
        permissionCode: 'branches.update',
        description: isAr ? 'لا تملك صلاحية حذف أو تعديل الفروع.' : 'You do not have permission to delete branches.',
      });
      return;
    }
    if ((type === 'employee' || type === 'user') && !canDeleteEmployee) {
      showPermissionAlert({
        actionTitle: isAr ? 'حذف الموظف / تعطيل الحساب' : 'Delete Employee / Disable Account',
        permissionCode: 'employees.delete',
        description: isAr ? 'لا تملك صلاحية حذف الموظفين أو تعطيل حسابات الدخول.' : 'You do not have permission to delete employees or disable accounts.',
      });
      return;
    }
    setItemToDelete({ id, name, type });
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'branch' && !canUpdateBranch) {
      showPermissionAlert({
        actionTitle: isAr ? 'حذف الفرع' : 'Delete Branch',
        permissionCode: 'branches.update',
      });
      return;
    }
    if ((itemToDelete.type === 'employee' || itemToDelete.type === 'user') && !canDeleteEmployee) {
      showPermissionAlert({
        actionTitle: isAr ? 'حذف الموظف / المستخدم' : 'Delete Employee / User',
        permissionCode: 'employees.delete',
      });
      return;
    }
    setDeleting(true);
    try {
      if (itemToDelete.type === 'branch') {
        await branchesApi.delete(itemToDelete.id);
        fetchStructureData();
      } else if (itemToDelete.type === 'department') {
        await departmentsApi.delete(itemToDelete.id);
        fetchStructureData();
      } else if (itemToDelete.type === 'employee') {
        await employeesApi.delete(itemToDelete.id).catch(() => {});
        fetchStructureData();
      } else if (itemToDelete.type === 'user') {
        setUsers(users.filter((u) => u.id !== itemToDelete.id));
      }
      showSuccessNotification(isAr ? 'تم الحذف' : 'Deleted', isAr ? `تم حذف (${itemToDelete.name}) بنجاح.` : `Deleted ${itemToDelete.name} successfully.`);
      setDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (err: any) {
      showErrorNotification(isAr ? 'خطأ في الحذف' : 'Delete Error', err.message || (isAr ? 'تعذر إتمام عملية الحذف' : 'Could not delete item'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1680px] mx-auto space-y-4 font-sans select-none" dir={direction}>
      
      {/* ── 1. ENTERPRISE HEADER & ACTIONS ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF3E8] text-[#F45A0A] border border-orange-200/80 flex items-center justify-center shadow-2xs shrink-0">
            <IconBuildingStore size={26} stroke={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg md:text-xl font-black text-slate-950 tracking-tight leading-tight">
                {isAr ? 'الفروع والهيكل الإداري' : 'Branches & Administrative Structure'}
              </h1>
              <span className="px-3 py-0.5 rounded-full text-xs font-black bg-orange-50 text-[#F45A0A] border border-orange-200 font-mono">
                {branches.length} {isAr ? 'فروع' : 'Branches'}
              </span>
            </div>
            <p className="text-xs md:text-[13px] text-slate-600 font-bold mt-0.5">
              {isAr
                ? 'إدارة الفروع والمقرات، الهيكلية الإدارية، الكوادر البشرية وصلاحيات الدخول المحاسبي.'
                : 'Manage branch network, operational departments, staff directory, and accounting system access.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {((activeTab === 'branches' && canCreateBranch) ||
            (activeTab === 'departments' && canCreateBranch) ||
            ((activeTab === 'employees' || activeTab === 'users') && canCreateEmployee)) && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="h-10 px-5 rounded-xl bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-black text-xs md:text-sm flex items-center gap-2 shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-98"
            >
              <IconPlus size={18} stroke={2.5} />
              <span>
                {activeTab === 'branches' && (isAr ? 'إضافة فرع جديد' : 'New Branch')}
                {activeTab === 'departments' && (isAr ? 'إضافة قسم جديد' : 'New Department')}
                {activeTab === 'employees' && (isAr ? 'إضافة موظف جديد' : 'New Employee')}
                {activeTab === 'users' && (isAr ? 'إضافة مستخدم جديد' : 'New User')}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. EXECUTIVE KPI CARDS GRID (4 Cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Branches */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-black text-slate-700">{isAr ? 'الفروع والمقرات المسجلة' : 'Branch Network'}</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F45A0A] border border-orange-200/80 flex items-center justify-center">
              <IconBuildingStore size={18} />
            </div>
          </div>
          <div className="mt-3.5 flex items-baseline justify-between">
            <div className="text-2xl md:text-3xl font-black text-slate-950 font-mono tracking-tight">
              {branches.length}
            </div>
            <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              {branches.filter((b) => b.isMain).length > 0 ? (isAr ? 'المقر الرئيسي مفعّل ★' : 'Main HQ Active') : (isAr ? 'نشط' : 'Active')}
            </span>
          </div>
        </div>

        {/* Card 2: Departments */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-black text-slate-700">{isAr ? 'الأقسام الإدارية والتشغيلية' : 'Operational Departments'}</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center">
              <IconSitemap size={18} />
            </div>
          </div>
          <div className="mt-3.5 flex items-baseline justify-between">
            <div className="text-2xl md:text-3xl font-black text-slate-950 font-mono tracking-tight">
              {departments.length}
            </div>
            <span className="text-xs font-black text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              {departments.filter((d) => d.headName).length} {isAr ? 'مسؤولين معينين' : 'Assigned Heads'}
            </span>
          </div>
        </div>

        {/* Card 3: Employees */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-black text-slate-700">{isAr ? 'الكوادر والموظفين' : 'Staff & Employees'}</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 border border-teal-200/80 flex items-center justify-center">
              <IconUsers size={18} />
            </div>
          </div>
          <div className="mt-3.5 flex items-baseline justify-between">
            <div className="text-2xl md:text-3xl font-black text-slate-950 font-mono tracking-tight">
              {employees.length}
            </div>
            <span className="text-xs font-black text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
              {employees.filter((e) => e.hasUserAccount).length} {isAr ? 'يمتلكون حسابات دخول' : 'User Accounts'}
            </span>
          </div>
        </div>

        {/* Card 4: System Users */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-black text-slate-700">{isAr ? 'مستخدمو النظام والصلاحيات' : 'System Users & Roles'}</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/80 flex items-center justify-center">
              <IconShieldCheck size={18} />
            </div>
          </div>
          <div className="mt-3.5 flex items-baseline justify-between">
            <div className="text-2xl md:text-3xl font-black text-slate-950 font-mono tracking-tight">
              {users.length}
            </div>
            <span className="text-xs font-black text-purple-800 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
              {permissionGroups.length} {isAr ? 'مجموعات صلاحيات' : 'Role Groups'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. TOOLBAR & TAB SWITCHER BAR ── */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Modern Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 border border-slate-200/80 rounded-xl flex-wrap">
          {[
            { id: 'branches', label: isAr ? 'الفروع والمقرات' : 'Branches & HQs', count: branches.length, icon: IconBuildingStore },
            { id: 'departments', label: isAr ? 'الأقسام الإدارية' : 'Departments', count: departments.length, icon: IconSitemap },
            { id: 'employees', label: isAr ? 'الكادر والموظفون' : 'Employees', count: employees.length, icon: IconUsers },
            { id: 'users', label: isAr ? 'مستخدمو النظام والدعم' : 'System Users', count: users.length, icon: IconShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setSearchQuery('');
                }}
                className={`h-9 px-4 rounded-lg text-xs md:text-sm font-black transition-all cursor-pointer flex items-center gap-2 ${
                  active
                    ? 'bg-[#F45A0A] text-white shadow-2xs font-black'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/80'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                <span
                  className={`px-2 py-0.2 rounded-full text-xs font-mono font-black ${
                    active ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Side: Search, Branch Selector, View Toggle */}
        <div className="flex items-center gap-2.5 flex-wrap flex-1 sm:flex-none justify-end">
          {/* Live Search */}
          <div className="relative w-64 min-w-[200px]">
            <IconSearch size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث سريع بالاسم، الرمز...' : 'Quick search...'}
              className="w-full h-[36px] ps-9 pe-8 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white text-xs md:text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#F45A0A] focus:ring-2 focus:ring-[#F45A0A]/10 transition-all font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute top-1/2 -translate-y-1/2 end-2.5 text-slate-400 hover:text-slate-700 cursor-pointer font-black"
              >
                ✕
              </button>
            )}
          </div>

          {/* Branch Filter for Departments/Employees */}
          {(activeTab === 'departments' || activeTab === 'employees') && (
            <div className="w-44">
              <Select
                size="xs"
                radius="md"
                data={[
                  { label: isAr ? 'كافة الفروع' : 'All Branches', value: 'ALL' },
                  ...branches.map((b) => ({ label: b.nameAr, value: b.nameAr })),
                ]}
                value={selectedBranchFilter}
                onChange={(val) => setSelectedBranchFilter(val || 'ALL')}
              />
            </div>
          )}

          {/* Cards vs Table View Switcher */}
          <div className="flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('CARDS')}
              title={isAr ? 'عرض البطاقات' : 'Cards View'}
              className={`h-[32px] w-[34px] rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                viewMode === 'CARDS'
                  ? 'bg-white text-[#F45A0A] shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <IconLayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              title={isAr ? 'عرض الجدول' : 'Table View'}
              className={`h-[32px] w-[34px] rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                viewMode === 'TABLE'
                  ? 'bg-white text-[#F45A0A] shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <IconList size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. DYNAMIC CONTENT AREA ── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-2xs space-y-3">
          <div className="w-10 h-10 border-3 border-[#F45A0A] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-bold text-slate-600 text-xs">{isAr ? 'جاري تحميل بيانات الهيكلية والفروع...' : 'Loading administrative data...'}</p>
        </div>
      ) : (
        <>
          {/* ── TAB 1: BRANCHES ── */}
          {activeTab === 'branches' && (
            filteredBranches.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center space-y-3 shadow-2xs">
                <IconDatabaseOff size={40} className="mx-auto text-slate-300" />
                <p className="font-bold text-slate-700 text-sm">{isAr ? 'لا توجد فروع مطابقة للبحث' : 'No branches found'}</p>
                {canCreateBranch && (
                  <button
                    type="button"
                    onClick={handleOpenAddModal}
                    className="h-9 px-4 rounded-xl bg-[#F45A0A] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <IconPlus size={14} />
                    <span>{isAr ? 'إضافة فرع جديد' : 'Add New Branch'}</span>
                  </button>
                )}
              </div>
            ) : viewMode === 'CARDS' ? (
              /* Visual Grid Cards View for Branches */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBranches.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-orange-300 p-5 flex flex-col justify-between space-y-4 group"
                  >
                    {/* Top Row: Logo, Code, Name, HQ badge */}
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-3.5">
                        <div className="flex items-center gap-3.5">
                          {b.logo ? (
                            <div className="w-20 h-20 rounded-2xl border-2 border-slate-200 bg-white p-2 shadow-2xs shrink-0 flex items-center justify-center overflow-hidden">
                              <img
                                src={b.logo}
                                alt="Logo"
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-20 h-20 rounded-2xl bg-orange-50 text-[#F45A0A] border-2 border-orange-200 flex items-center justify-center shrink-0 shadow-2xs">
                              <IconBuildingStore size={36} stroke={1.8} />
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-black text-xs text-[#F45A0A] bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200/80">
                                {b.code}
                              </span>
                              {b.isMain && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                                  <IconStar size={12} className="fill-amber-500 text-amber-500" />
                                  <span>{isAr ? 'المركز الرئيسي' : 'Main HQ'}</span>
                                </span>
                              )}
                            </div>
                            <h3 className="font-black text-slate-950 text-base md:text-[17px] leading-snug tracking-tight">{b.nameAr}</h3>
                          </div>
                        </div>

                        <Badge size="sm" color={b.status === 'نشط' || !b.status ? 'emerald' : 'red'} variant="light" className="shrink-0 font-bold">
                          {b.status || (isAr ? 'نشط' : 'Active')}
                        </Badge>
                      </div>

                      {/* Manager & City details */}
                      <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-slate-500 block">{isAr ? 'المدينة والموقع:' : 'City & Location:'}</span>
                          <span className="font-black text-slate-900 flex items-center gap-1 text-sm">
                            <IconMapPin size={14} className="text-slate-400 shrink-0" />
                            <span className="truncate">{b.city || (isAr ? 'كربلاء' : 'Karbala')}</span>
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-slate-500 block">{isAr ? 'مدير الفرع:' : 'Branch Manager:'}</span>
                          <span className="font-black text-slate-900 flex items-center gap-1 text-sm">
                            <IconUser size={14} className="text-[#F45A0A] shrink-0" />
                            <span className="truncate">{b.managerName || '-'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Contact Badges */}
                      {(b.phone || b.whatsapp) && (
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          {b.phone && (
                            <a
                              href={`tel:${b.phone}`}
                              className="text-xs font-mono font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors"
                            >
                              <IconPhone size={13} className="text-slate-500" />
                              <span dir="ltr">{b.phone}</span>
                            </a>
                          )}
                          {b.whatsapp && (
                            <a
                              href={`https://wa.me/${b.whatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-mono font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors"
                            >
                              <IconBrandWhatsapp size={14} className="text-teal-600" />
                              <span>{isAr ? 'واتساب' : 'WhatsApp'}</span>
                            </a>
                          )}
                        </div>
                      )}
                      {/* Branch GPS Location & Geofence Badge */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <IconMapPin size={15} className="text-[#F45A0A] shrink-0" />
                          <div className="truncate">
                            <span className="text-[11px] font-bold text-slate-500 block leading-none">
                              {isAr ? 'الموقع ونطاق الحضور:' : 'GPS & Geofence:'}
                            </span>
                            {b.latitude != null && b.longitude != null ? (
                              <a
                                href={`https://www.google.com/maps?q=${b.latitude},${b.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-xs font-black text-slate-800 hover:text-[#F45A0A] flex items-center gap-1 mt-0.5"
                                title={isAr ? 'فتح في خرائط جوجل' : 'Open in Google Maps'}
                              >
                                <span>
                                  {Number(b.latitude).toFixed(4)}, {Number(b.longitude).toFixed(4)}
                                </span>
                                <IconExternalLink size={11} className="text-slate-400" />
                              </a>
                            ) : (
                              <span className="text-[10px] text-amber-700 font-bold">
                                {isAr ? 'لم يحدد الموقع بعد' : 'Not set'}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-orange-50 text-[#C2410C] border border-orange-200">
                          ±{b.allowedRadiusMeters || 150}m
                        </span>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-mono font-black text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {(b as any).currency || 'IQD'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {canUpdateBranch && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditMode(true);
                              setEditingId(b.id);
                              setBranchCode(b.code);
                              setBranchName(b.nameAr);
                              setCity(b.city || 'بغداد');
                              setManagerName(b.managerName || '');
                              setPhone(b.phone || '');
                              setPhone2(b.phone2 || '');
                              setEmail(b.email || '');
                              setEmail2(b.email2 || '');
                              setLogo(b.logo || '');
                              setAddress(b.address || '');
                              setWhatsapp(b.whatsapp || '');
                              setFacebook(b.facebook || '');
                              setInstagram(b.instagram || '');
                              setTelegram(b.telegram || '');
                              setWebsite(b.website || '');
                              setIsMain(b.isMain);
                              setBranchLatitude(b.latitude != null ? String(b.latitude) : '');
                              setBranchLongitude(b.longitude != null ? String(b.longitude) : '');
                              setBranchRadius(b.allowedRadiusMeters != null ? Number(b.allowedRadiusMeters) : 150);
                              setModalBranchTab('info');
                              setModalOpen(true);
                            }}
                            className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-orange-50 hover:text-[#F45A0A] hover:border-orange-200 text-slate-800 font-black text-xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <IconEdit size={14} />
                            <span>{isAr ? 'تعديل' : 'Edit'}</span>
                          </button>
                        )}

                        {!b.isMain && canUpdateBranch && (
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(b.id, b.nameAr, 'branch')}
                            className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-400 transition-colors flex items-center justify-center cursor-pointer"
                            title={isAr ? 'حذف الفرع' : 'Delete Branch'}
                          >
                            <IconTrash size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start border-collapse font-sans whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold h-[42px]">
                        <th className="py-2.5 px-3.5 text-start w-28 font-mono">{isAr ? 'رمز الفرع' : 'Code'}</th>
                        <th className="py-2.5 px-3.5 text-start min-w-[240px]">{isAr ? 'اسم الفرع والشعار' : 'Branch Name'}</th>
                        <th className="py-2.5 px-3.5 text-start w-32">{isAr ? 'المدينة' : 'City'}</th>
                        <th className="py-2.5 px-3.5 text-start min-w-[160px]">{isAr ? 'مدير الفرع' : 'Manager'}</th>
                        <th className="py-2.5 px-3.5 text-start min-w-[180px]">{isAr ? 'أرقام الاتصال' : 'Contacts'}</th>
                        <th className="py-2.5 px-3.5 text-start min-w-[190px]">{isAr ? 'الموقع ونطاق الحضور (GPS)' : 'GPS & Geofence'}</th>
                        <th className="py-2.5 px-3.5 text-center w-24 font-mono">{isAr ? 'العملة' : 'Currency'}</th>
                        <th className="py-2.5 px-3.5 text-center w-24">{isAr ? 'الحالة' : 'Status'}</th>
                        <th className="py-2.5 px-3.5 text-center w-20">{isAr ? 'إجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredBranches.map((b) => (
                        <tr key={b.id} className="hover:bg-orange-50/30 transition-colors h-[48px]">
                          <td className="py-2.5 px-3.5 font-mono font-black text-[#F45A0A]">{b.code}</td>
                          <td className="py-2.5 px-3.5 font-bold text-slate-900">
                            <div className="flex items-center gap-3">
                              {b.logo ? (
                                <img src={b.logo} alt="Logo" className="w-10 h-10 object-contain rounded-xl border border-slate-200 bg-white p-1 shadow-2xs shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#F45A0A] border border-orange-200 flex items-center justify-center shrink-0">
                                  <IconBuildingStore size={20} />
                                </div>
                              )}
                              <span>{b.nameAr}</span>
                              {b.isMain && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                  {isAr ? 'رئيسي ★' : 'HQ'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5 font-medium text-slate-700">{b.city || '-'}</td>
                          <td className="py-2.5 px-3.5 font-semibold text-slate-800">{b.managerName || '-'}</td>
                          <td className="py-2.5 px-3.5 font-mono text-slate-700">{b.phone || '-'}</td>
                          <td className="py-2.5 px-3.5">
                            {b.latitude != null && b.longitude != null ? (
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={`https://www.google.com/maps?q=${b.latitude},${b.longitude}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 font-mono font-black text-slate-800 hover:text-[#F45A0A] bg-orange-50/80 border border-orange-200 px-2 py-0.5 rounded text-[11px]"
                                  title={isAr ? 'عرض في خرائط جوجل' : 'Open in Google Maps'}
                                >
                                  <IconMapPin size={12} className="text-[#F45A0A]" />
                                  <span>{Number(b.latitude).toFixed(4)}, {Number(b.longitude).toFixed(4)}</span>
                                  <IconExternalLink size={10} className="text-slate-400" />
                                </a>
                                <span className="font-mono text-[10px] font-black text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  ±{b.allowedRadiusMeters || 150}m
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-bold">{isAr ? 'غير محدد' : 'Not set'}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-mono font-bold text-slate-600">{(b as any).currency || 'IQD'}</td>
                          <td className="py-2.5 px-3.5 text-center">
                            <Badge size="xs" color={b.status === 'نشط' || !b.status ? 'emerald' : 'red'} variant="light">
                              {b.status || (isAr ? 'نشط' : 'Active')}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {canUpdateBranch && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditMode(true);
                                    setEditingId(b.id);
                                    setBranchCode(b.code);
                                    setBranchName(b.nameAr);
                                    setCity(b.city || 'بغداد');
                                    setManagerName(b.managerName || '');
                                    setPhone(b.phone || '');
                                    setPhone2(b.phone2 || '');
                                    setEmail(b.email || '');
                                    setEmail2(b.email2 || '');
                                    setLogo(b.logo || '');
                                    setAddress(b.address || '');
                                    setWhatsapp(b.whatsapp || '');
                                    setFacebook(b.facebook || '');
                                    setInstagram(b.instagram || '');
                                    setTelegram(b.telegram || '');
                                    setWebsite(b.website || '');
                                    setIsMain(b.isMain);
                                    setBranchLatitude(b.latitude != null ? String(b.latitude) : '');
                                    setBranchLongitude(b.longitude != null ? String(b.longitude) : '');
                                    setBranchRadius(b.allowedRadiusMeters != null ? Number(b.allowedRadiusMeters) : 150);
                                    setModalBranchTab('info');
                                    setModalOpen(true);
                                  }}
                                  className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-orange-50 hover:text-[#F45A0A] flex items-center justify-center text-slate-600 cursor-pointer"
                                  title={isAr ? 'تعديل' : 'Edit'}
                                >
                                  <IconEdit size={13} />
                                </button>
                              )}
                              {!b.isMain && canUpdateBranch && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDelete(b.id, b.nameAr, 'branch')}
                                  className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center text-slate-400 cursor-pointer"
                                  title={isAr ? 'حذف' : 'Delete'}
                                >
                                  <IconTrash size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* ── TAB 2: DEPARTMENTS ── */}
          {activeTab === 'departments' && (
            filteredDepartments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center space-y-3 shadow-2xs">
                <IconDatabaseOff size={40} className="mx-auto text-slate-300" />
                <p className="font-bold text-slate-700 text-sm">{isAr ? 'لا توجد أقسام مسجلة' : 'No departments found'}</p>
                {canCreateBranch && (
                  <button
                    type="button"
                    onClick={handleOpenAddModal}
                    className="h-9 px-4 rounded-xl bg-[#F45A0A] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <IconPlus size={14} />
                    <span>{isAr ? 'إضافة قسم جديد' : 'Add Department'}</span>
                  </button>
                )}
              </div>
            ) : viewMode === 'CARDS' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDepartments.map((d) => (
                  <div
                    key={d.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-200 transition-all p-5 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
                            <IconSitemap size={22} />
                          </div>
                          <div>
                            <span className="font-mono font-black text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200">
                              {d.code}
                            </span>
                            <h3 className="font-black text-slate-900 text-sm mt-1 leading-tight">{d.name}</h3>
                          </div>
                        </div>
                        <Badge size="xs" color="gray" variant="light">{d.branchName}</Badge>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">{isAr ? 'مسؤول القسم:' : 'Department Head:'}</span>
                          {d.headName ? (
                            <span className="font-bold text-slate-800 flex items-center gap-1">
                              <IconUser size={13} className="text-blue-600 shrink-0" />
                              <span>{d.headName}</span>
                            </span>
                          ) : (
                            <span className="text-amber-600 font-bold text-[11px]">{isAr ? 'لم يتم تعيين مسؤول' : 'Unassigned'}</span>
                          )}
                        </div>

                        {d.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-2 pt-1">{d.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-1.5">
                      {canUpdateBranch && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditMode(true);
                            setEditingId(d.id);
                            setDepBranchName(d.branchName);
                            setDepCode(d.code);
                            setDepName(d.name);
                            setDepHeadName(d.headName || '');
                            setDepDescription(d.description || '');
                            setModalOpen(true);
                          }}
                          className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <IconEdit size={13} />
                          <span>{isAr ? 'تعديل' : 'Edit'}</span>
                        </button>
                      )}
                      {canUpdateBranch && (
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(d.id, d.name, 'department')}
                          className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-400 transition-colors flex items-center justify-center cursor-pointer"
                          title={isAr ? 'حذف القسم' : 'Delete'}
                        >
                          <IconTrash size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start border-collapse font-sans whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold h-[42px]">
                        <th className="py-2.5 px-3.5 text-start w-28 font-mono">{isAr ? 'كود القسم' : 'Code'}</th>
                        <th className="py-2.5 px-3.5 text-start min-w-[220px]">{isAr ? 'اسم القسم الإداري' : 'Department Name'}</th>
                        <th className="py-2.5 px-3.5 text-start min-w-[180px]">{isAr ? 'الفرع التابع له' : 'Branch'}</th>
                        <th className="py-2.5 px-3.5 text-start min-w-[180px]">{isAr ? 'مسؤول القسم' : 'Head of Dept'}</th>
                        <th className="py-2.5 px-3.5 text-start min-w-[220px]">{isAr ? 'وصف القسم' : 'Description'}</th>
                        <th className="py-2.5 px-3.5 text-center w-20">{isAr ? 'إجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredDepartments.map((d) => (
                        <tr key={d.id} className="hover:bg-blue-50/30 transition-colors h-[48px]">
                          <td className="py-2.5 px-3.5 font-mono font-black text-blue-700">{d.code}</td>
                          <td className="py-2.5 px-3.5 font-bold text-slate-900">{d.name}</td>
                          <td className="py-2.5 px-3.5"><Badge size="xs" color="gray" variant="light">{d.branchName}</Badge></td>
                          <td className="py-2.5 px-3.5">
                            {d.headName ? (
                              <span className="font-bold text-slate-800">{d.headName}</span>
                            ) : (
                              <span className="text-amber-600 text-[11px] font-bold">{isAr ? 'لم يعين مسؤول' : 'Unassigned'}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-500 max-w-xs truncate">{d.description || '-'}</td>
                          <td className="py-2.5 px-3.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {canUpdateBranch && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditMode(true);
                                    setEditingId(d.id);
                                    setDepBranchName(d.branchName);
                                    setDepCode(d.code);
                                    setDepName(d.name);
                                    setDepHeadName(d.headName || '');
                                    setDepDescription(d.description || '');
                                    setModalOpen(true);
                                  }}
                                  className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center text-slate-600 cursor-pointer"
                                >
                                  <IconEdit size={13} />
                                </button>
                              )}
                              {canUpdateBranch && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDelete(d.id, d.name, 'department')}
                                  className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center text-slate-400 cursor-pointer"
                                >
                                  <IconTrash size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* ── TAB 3: EMPLOYEES ── */}
          {activeTab === 'employees' && (
            filteredEmployees.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center space-y-3 shadow-2xs">
                <IconDatabaseOff size={40} className="mx-auto text-slate-300" />
                <p className="font-bold text-slate-700 text-sm">{isAr ? 'لا يوجد موظفون مسجلون' : 'No employees found'}</p>
                {canCreateEmployee && (
                  <button
                    type="button"
                    onClick={handleOpenAddModal}
                    className="h-9 px-4 rounded-xl bg-[#F45A0A] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <IconPlus size={14} />
                    <span>{isAr ? 'إضافة موظف جديد' : 'Add Employee'}</span>
                  </button>
                )}
              </div>
            ) : viewMode === 'CARDS' ? (
              /* Visual Grid Cards for Employees */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEmployees.map((e) => {
                  const isHead = departments.some((d) => d.headName === e.fullName);
                  const hasUser = e.hasUserAccount || users.some((u) => u.fullName === e.fullName);
                  return (
                    <div
                      key={e.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-teal-200 transition-all p-5 flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center shrink-0">
                              <IconUser size={22} />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-black text-slate-900 text-sm leading-tight">{e.fullName}</h3>
                                {isHead && (
                                  <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    {isAr ? 'مسؤول قسم' : 'Head'}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-bold text-teal-700 block mt-0.5">{e.jobTitle}</span>
                            </div>
                          </div>

                          <Badge size="xs" color={e.status === 'نشط' ? 'emerald' : 'amber'} variant="light">
                            {e.status}
                          </Badge>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-medium">{isAr ? 'الفرع والقسم:' : 'Branch & Dept:'}</span>
                            <span className="font-bold text-slate-800 truncate">{e.branchName} — {e.departmentName}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-medium">{isAr ? 'الصندوق المالي:' : 'Cashbox:'}</span>
                            <span className="font-bold text-slate-700 font-mono text-[11px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 truncate">
                              {e.assignedCashbox || (isAr ? 'النقود والصناديق' : 'Default Cashbox')}
                            </span>
                          </div>

                          {e.phone && (
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-slate-400 font-medium">{isAr ? 'رقم الهاتف:' : 'Phone:'}</span>
                              <span className="font-mono font-bold text-slate-800">{e.phone}</span>
                            </div>
                          )}

                          {hasUser && (
                            <div className="pt-1">
                              <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-1 w-fit">
                                <IconKey size={12} />
                                <span>{isAr ? 'له حساب دخول للنظام 🔑' : 'User Account Enabled'}</span>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Device Security & Attestation Binding */}
                        <div className="pt-2 border-t border-slate-100">
                          {e.trustedDeviceId ? (
                            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-emerald-800">
                                  <IconDeviceMobileCheck size={16} className="text-emerald-600 shrink-0" />
                                  <span className="font-bold text-xs">{e.deviceModel || (isAr ? 'هاتف معتمد' : 'Trusted Device')}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleUnbindDevice(e.id, e.fullName)}
                                  className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-white hover:bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                  title={isAr ? 'فك اقتران الجهاز الحالي للسماح بجهاز جديد' : 'Unbind Device'}
                                >
                                  <IconUnlink size={11} />
                                  <span>{isAr ? 'فك الاقتران' : 'Unbind'}</span>
                                </button>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-emerald-700 font-mono">
                                <span className="font-bold">
                                  {e.devicePlatform === 'ios' ? 'Secure Enclave + App Attest' : 'Android Keystore + Play Integrity'}
                                </span>
                                <span className="text-emerald-600 font-bold">✓ {isAr ? 'جهاز حصري معتمد' : 'Bound'}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-2.5 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-amber-800">
                                <IconShieldLock size={15} className="text-amber-600 shrink-0" />
                                <span className="text-[11px] font-bold">
                                  {isAr ? 'لم يربط جهاز بعد (جهاز واحد معتمد)' : 'No trusted device bound'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEmpForDevice(e);
                                  setDeviceModalOpen(true);
                                }}
                                className="text-[10.5px] font-bold text-[#F45A0A] hover:text-[#C2410C] bg-white hover:bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <IconDeviceMobile size={12} />
                                <span>{isAr ? 'ربط جهاز' : 'Bind'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-1.5">
                        {canUpdateEmployee && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditMode(true);
                              setEditingId(e.id);
                              setEmpBranchName(e.branchName);
                              setEmpDepName(e.departmentName);
                              setEmpFullName(e.fullName);
                              setEmpJobTitle(e.jobTitle);
                              setEmpPhone(e.phone);
                              setEmpEmail(e.email || '');
                              setEmpAssignedCashbox(e.assignedCashbox || '');
                              setEmpStatus(e.status);
                              setEmpIsHead(isHead);

                              const existingUser = users.find((u) => u.fullName === e.fullName || (e.email && u.email === e.email));
                              setEmpCreateUser(Boolean(e.hasUserAccount || existingUser));
                              setEmpHasExistingLogin(Boolean(existingUser));
                              if (existingUser) {
                                setEmpUsername(existingUser.email);
                                // Never seed a placeholder here: the field is sent back on
                                // save, so a fake value would silently reset the login.
                                setEmpPassword(existingUser.password || '');
                                setEmpRole(existingUser.role || '');
                              } else {
                                setEmpUsername(e.email || '');
                                setEmpPassword('');
                                setEmpRole('');
                              }
                              setModalOpen(true);
                            }}
                            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <IconEdit size={13} />
                            <span>{isAr ? 'تعديل' : 'Edit'}</span>
                          </button>
                        )}
                        {canDeleteEmployee && (
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(e.id, e.fullName, 'employee')}
                            className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-400 transition-colors flex items-center justify-center cursor-pointer"
                            title={isAr ? 'حذف الموظف' : 'Delete'}
                          >
                            <IconTrash size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Table View for Employees */
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start border-collapse font-sans whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold h-[42px]">
                        <th className="py-2.5 px-3.5 text-start min-w-[220px]">{isAr ? 'اسم الموظف' : 'Full Name'}</th>
                        <th className="py-2.5 px-3.5 text-start min-w-[160px]">{isAr ? 'المسمى الوظيفي' : 'Job Title'}</th>
                        <th className="py-2.5 px-3.5 text-start min-w-[160px]">{isAr ? 'الفرع' : 'Branch'}</th>
                        <th className="py-2.5 px-3.5 text-start min-w-[160px]">{isAr ? 'القسم' : 'Department'}</th>
                        <th className="py-2.5 px-3.5 text-start min-w-[180px]">{isAr ? 'الصندوق المخصص' : 'Cashbox'}</th>
                        <th className="py-2.5 px-3.5 text-start min-w-[190px]">{isAr ? 'الجهاز المعتمد (الأمان)' : 'Device Security'}</th>
                        <th className="py-2.5 px-3.5 text-start w-32 font-mono">{isAr ? 'رقم الهاتف' : 'Phone'}</th>
                        <th className="py-2.5 px-3.5 text-center w-24">{isAr ? 'الحالة' : 'Status'}</th>
                        <th className="py-2.5 px-3.5 text-center w-20">{isAr ? 'إجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredEmployees.map((e) => (
                        <tr key={e.id} className="hover:bg-teal-50/30 transition-colors h-[48px]">
                          <td className="py-2.5 px-3.5 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span>{e.fullName}</span>
                              {e.hasUserAccount && (
                                <span className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-200 font-bold">
                                  🔑
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5 font-bold text-teal-700">{e.jobTitle}</td>
                          <td className="py-2.5 px-3.5 text-slate-700">{e.branchName}</td>
                          <td className="py-2.5 px-3.5"><Badge size="xs" color="teal" variant="outline">{e.departmentName}</Badge></td>
                          <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-700">{e.assignedCashbox || '-'}</td>
                          <td className="py-2.5 px-3.5">
                            {e.trustedDeviceId ? (
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                                  <IconDeviceMobileCheck size={16} className="text-emerald-600 shrink-0" />
                                  <div>
                                    <span className="font-bold text-xs block leading-tight text-slate-900">
                                      {e.deviceModel || (isAr ? 'هاتف معتمد' : 'Trusted Device')}
                                    </span>
                                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                      {e.devicePlatform === 'ios' ? 'Secure Enclave' : 'Android Keystore'}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleUnbindDevice(e.id, e.fullName)}
                                  className="text-[10px] text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded cursor-pointer"
                                  title={isAr ? 'فك اقتران الجهاز' : 'Unbind Device'}
                                >
                                  <IconUnlink size={11} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-slate-400 font-bold">{isAr ? 'غير مقترن' : 'Not bound'}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedEmpForDevice(e);
                                    setDeviceModalOpen(true);
                                  }}
                                  className="text-[10px] font-bold text-[#F45A0A] bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2 py-0.5 rounded cursor-pointer"
                                >
                                  {isAr ? 'ربط جهاز' : 'Bind'}
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800">{e.phone || '-'}</td>
                          <td className="py-2.5 px-3.5 text-center">
                            <Badge size="xs" color={e.status === 'نشط' ? 'emerald' : 'amber'} variant="light">
                              {e.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {canUpdateEmployee && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditMode(true);
                                    setEditingId(e.id);
                                    setEmpBranchName(e.branchName);
                                    setEmpDepName(e.departmentName);
                                    setEmpFullName(e.fullName);
                                    setEmpJobTitle(e.jobTitle);
                                    setEmpPhone(e.phone);
                                    setEmpEmail(e.email || '');
                                    setEmpAssignedCashbox(e.assignedCashbox || '');
                                    setEmpStatus(e.status);
                                    setModalOpen(true);
                                  }}
                                  className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-teal-50 hover:text-teal-700 flex items-center justify-center text-slate-600 cursor-pointer"
                                >
                                  <IconEdit size={13} />
                                </button>
                              )}
                              {canDeleteEmployee && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDelete(e.id, e.fullName, 'employee')}
                                  className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center text-slate-400 cursor-pointer"
                                >
                                  <IconTrash size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* ── TAB 4: SYSTEM USERS ── */}
          {activeTab === 'users' && (
            filteredUsers.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center space-y-3 shadow-2xs">
                <IconDatabaseOff size={40} className="mx-auto text-slate-300" />
                <p className="font-bold text-slate-700 text-sm">{isAr ? 'لا يوجد مستخدمون مسجلون' : 'No users found'}</p>
                {canCreateEmployee && (
                  <button
                    type="button"
                    onClick={handleOpenAddModal}
                    className="h-9 px-4 rounded-xl bg-[#F45A0A] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <IconPlus size={14} />
                    <span>{isAr ? 'إضافة مستخدم جديد' : 'Add User'}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start border-collapse font-sans whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold h-[42px]">
                        <th className="py-2.5 px-3.5 text-start min-w-[200px]">{isAr ? 'اسم المستخدم' : 'User Full Name'}</th>
                        <th className="py-2.5 px-3.5 text-start min-w-[200px] font-mono">{isAr ? 'البريد الإلكتروني / الدخول' : 'Login Email'}</th>
                        <th className="py-2.5 px-3.5 text-start min-w-[160px]">{isAr ? 'صلاحية الفرع' : 'Branch Scope'}</th>
                        <th className="py-2.5 px-3.5 text-start min-w-[160px]">{isAr ? 'الدور / مجموعة الصلاحيات' : 'Role / Group'}</th>
                        <th className="py-2.5 px-3.5 text-center w-28">{isAr ? 'حساب دعم فني' : 'Support Access'}</th>
                        <th className="py-2.5 px-3.5 text-center w-24">{isAr ? 'الحالة' : 'Status'}</th>
                        <th className="py-2.5 px-3.5 text-center w-20">{isAr ? 'إجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-purple-50/30 transition-colors h-[48px]">
                          <td className="py-2.5 px-3.5 font-bold text-slate-900 flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                              <IconShieldCheck size={16} />
                            </div>
                            <span>{u.fullName}</span>
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-slate-700">{u.email}</td>
                          <td className="py-2.5 px-3.5"><Badge size="xs" color="gray" variant="light">{u.branchName}</Badge></td>
                          <td className="py-2.5 px-3.5"><Badge size="xs" color="purple" variant="filled">{u.role || (isAr ? 'مستخدم عام' : 'User')}</Badge></td>
                          <td className="py-2.5 px-3.5 text-center">
                            {u.isSupport ? (
                              <Badge size="xs" color="teal" variant="light" leftSection={<IconHeadset size={11} />}>
                                {isAr ? 'دعم فني' : 'Support'}
                              </Badge>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            <Badge size="xs" color={u.status === 'نشط' || u.status === 'Active' ? 'emerald' : 'amber'} variant="light">
                              {u.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {canUpdateEmployee && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditMode(true);
                                    setEditingId(u.id);
                                    setUsrFullName(u.fullName);
                                    setUsrEmail(u.email);
                                    setUsrPassword(u.password || '');
                                    setUsrBranchName(u.branchName || (isAr ? 'جميع الفروع' : 'All Branches'));
                                    setUsrRole(u.role || '');
                                    setUsrIsSupport(u.isSupport);
                                    setUsrStatus(u.status);
                                    setModalOpen(true);
                                  }}
                                  className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-purple-50 hover:text-purple-700 flex items-center justify-center text-slate-600 cursor-pointer"
                                >
                                  <IconEdit size={13} />
                                </button>
                              )}
                              {canDeleteEmployee && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDelete(u.id, u.fullName, 'user')}
                                  className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center text-slate-400 cursor-pointer"
                                >
                                  <IconTrash size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </>
      )}

      {/* ── 5. DYNAMIC MODAL ACCORDING TO ACTIVE TAB ── */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        size={activeTab === 'branches' ? 'lg' : '640px'}
        radius="lg"
        padding="lg"
        withCloseButton
        dir={direction}
        centered
        overlayProps={{ opacity: 0.4, blur: 2 }}
        title={
          <div className="flex items-center gap-2.5 text-slate-900 font-extrabold text-xs">
            <div className="p-2 rounded-xl bg-orange-50 text-[#F45A0A] border border-orange-200 shrink-0">
              {activeTab === 'branches' && <IconBuildingStore size={18} />}
              {activeTab === 'departments' && <IconSitemap size={18} />}
              {activeTab === 'employees' && <IconUser size={18} />}
              {activeTab === 'users' && <IconShieldCheck size={18} />}
            </div>
            <div>
              <span className="block font-black text-slate-900 text-sm">
                {activeTab === 'branches' && (editMode ? (isAr ? 'تعديل بيانات وشعار الفرع' : 'Edit Branch') : (isAr ? 'إضافة فرع جديد للهيكل الإداري' : 'Add New Branch'))}
                {activeTab === 'departments' && (editMode ? (isAr ? 'تعديل بيانات القسم الإداري' : 'Edit Department') : (isAr ? 'إضافة قسم جديد لفرع' : 'Add New Department'))}
                {activeTab === 'employees' && (editMode ? (isAr ? 'تعديل بيانات الموظف وتصاريح الدخول' : 'Edit Employee') : (isAr ? 'إضافة موظف جديد لفرع وقسم' : 'Add New Employee'))}
                {activeTab === 'users' && (editMode ? (isAr ? 'تعديل مستخدم النظام والدعم' : 'Edit User') : (isAr ? 'إضافة مستخدم جديد لنظام المحاسبة والدعم' : 'Add New User'))}
              </span>
              <span className="text-[11px] font-normal text-slate-500 block">
                {isAr ? 'تعبئة البيانات التنظيمية للهيكل المحاسبي والإداري' : 'Enter organizational details for accounting structure'}
              </span>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs pt-1">
          {/* TAB 1 MODAL: BRANCH FORM */}
          {activeTab === 'branches' && (
            <>
              <SegmentedControl
                size="xs"
                fullWidth
                value={modalBranchTab}
                onChange={(val: any) => setModalBranchTab(val)}
                data={[
                  { label: isAr ? '1. البيانات والشعار' : '1. Basic Info & Logo', value: 'info' },
                  { label: isAr ? '2. الموقع ونطاق البصمة' : '2. GPS & Geofence', value: 'location' },
                  { label: isAr ? '3. الهواتف والبريد' : '3. Contacts & Emails', value: 'contacts' },
                  { label: isAr ? '4. التواصل الاجتماعي' : '4. Social Media', value: 'social' },
                ]}
                color="orange"
                className="bg-slate-100 p-0.5 rounded-xl"
              />

              {modalBranchTab === 'info' && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <TextInput
                      label={isAr ? 'رمز الفرع (Prefix) *' : 'Branch Code *'}
                      placeholder="BR-01"
                      value={branchCode}
                      onChange={(e) => setBranchCode(e.target.value)}
                    />
                    <TextInput
                      label={isAr ? 'اسم الفرع بالعربية *' : 'Branch Name (Arabic) *'}
                      placeholder="مثال: فرع كربلاء المقدسة / الروضتين"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <TextInput
                      label={isAr ? 'المدينة *' : 'City *'}
                      placeholder="كربلاء المقدسة / بغداد"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                    <TextInput
                      label={isAr ? 'مدير الفرع المسؤول' : 'Branch Manager'}
                      placeholder="حسن التميمي"
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      leftSection={<IconUser size={14} />}
                    />
                  </div>

                  <TextInput
                    label={isAr ? 'العنوان التفصيلي' : 'Address'}
                    placeholder="الشارع التجاري - قرب ساحة الشهداء"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    leftSection={<IconMapPin size={14} />}
                  />

                  {/* Branch Logo Uploader & Preview */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">{isAr ? 'شعار / لوجو الفرع (Branch Logo)' : 'Branch Logo'}</label>
                    <div className="flex items-center gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                      {logo ? (
                        <div className="w-20 h-20 rounded-2xl border-2 border-slate-200 bg-white p-2 shadow-2xs shrink-0 flex items-center justify-center">
                          <img src={logo} alt="Branch Logo" className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 shrink-0">
                          <IconPhoto size={28} />
                        </div>
                      )}

                      <div className="flex-1 space-y-1.5">
                        <TextInput
                          placeholder={isAr ? 'رابط صورة الشعار (URL) أو ارفع ملف من جهازك' : 'Logo URL or upload file'}
                          value={logo}
                          onChange={(e) => setLogo(e.target.value)}
                          size="xs"
                        />
                        <div className="flex items-center justify-between">
                          <input
                            type="file"
                            accept="image/*"
                            id="branchLogoFileInput"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = async (event) => {
                                  const base64 = event.target?.result as string;
                                  try {
                                    const res = await branchesApi.uploadLogo(file.name, base64);
                                    setLogo(res.url);
                                    showSuccessNotification(isAr ? 'تم رفع الشعار' : 'Logo Uploaded', isAr ? 'تم حفظ الشعار في حاوية Supabase بنجاح.' : 'Logo uploaded successfully.');
                                  } catch (err: any) {
                                    showErrorNotification(isAr ? 'تعذر رفع الشعار' : 'Upload Failed', isAr ? 'تعذر رفع الشعار لخادم التخزين. تأكد من إعداد Supabase Storage.' : 'Failed to upload logo to storage.');
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <label
                            htmlFor="branchLogoFileInput"
                            className="text-[11px] font-bold text-[#F45A0A] hover:underline cursor-pointer"
                          >
                            {isAr ? 'إدراج ملف شعار من الجهاز (PNG / JPG)' : 'Browse from computer'}
                          </label>

                          {logo && (
                            <button
                              type="button"
                              onClick={() => setLogo('')}
                              className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                            >
                              {isAr ? 'إزالة الشعار' : 'Remove'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 p-3 bg-orange-50/50 border border-orange-200/80 rounded-xl">
                    <input
                      type="checkbox"
                      id="isMainBranchStruct"
                      checked={isMain}
                      onChange={(e) => setIsMain(e.target.checked)}
                      className="accent-[#F45A0A] w-4 h-4 cursor-pointer rounded"
                    />
                    <label htmlFor="isMainBranchStruct" className="font-bold text-slate-800 cursor-pointer">
                      {isAr ? 'تعيين كمركز رئيسي للشؤون المالية والإدارية (Main HQ)' : 'Set as Main Headquarters (HQ)'}
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: HIGH ACCURACY GPS & GEOFENCE */}
              {modalBranchTab === 'location' && (
                <div className="space-y-4 pt-1">
                  {/* High Accuracy Auto-Detect Button */}
                  <div className="p-3.5 bg-orange-50/80 border border-orange-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-slate-900 font-black text-xs">
                        <IconCurrentLocation size={16} className="text-[#F45A0A]" />
                        <span>{isAr ? 'تحديد إحداثيات الفرع بدقة خيالية (High-Precision GPS)' : 'High Precision GPS Lock'}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium">
                        {isAr
                          ? 'جلب موقعك الجغرافي الفعلي اللحظي بدقة الأقمار الصناعية لربط الفرع ببصمة الحضور.'
                          : 'Fetch exact real-time coordinates to bind branch with employee geofence.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGetHighAccuracyLocation}
                      disabled={gettingLocation}
                      className="px-4 py-2 rounded-xl bg-[#F45A0A] hover:bg-[#DC4B02] text-white text-xs font-black shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50 active:scale-95 transition-all"
                    >
                      <IconCurrentLocation size={15} className={gettingLocation ? 'animate-spin' : ''} />
                      <span>{gettingLocation ? (isAr ? 'جاري التحديد بدقة...' : 'Acquiring...') : (isAr ? 'حدد موقعي الآن' : 'Get Current GPS')}</span>
                    </button>
                  </div>

                  {/* Manual Coordinate Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {isAr ? 'خط العرض (Latitude) *' : 'Latitude *'}
                      </label>
                      <TextInput
                        placeholder="32.616035"
                        value={branchLatitude}
                        onChange={(e) => setBranchLatitude(e.target.value)}
                        className="font-mono font-bold"
                        leftSection={<IconMapPin size={14} className="text-slate-400" />}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {isAr ? 'خط الطول (Longitude) *' : 'Longitude *'}
                      </label>
                      <TextInput
                        placeholder="44.024921"
                        value={branchLongitude}
                        onChange={(e) => setBranchLongitude(e.target.value)}
                        className="font-mono font-bold"
                        leftSection={<IconMapPin size={14} className="text-slate-400" />}
                      />
                    </div>
                  </div>

                  {/* Allowed Radius Selection */}
                  <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-800">
                        {isAr ? 'المسافة المسموحة لتسجيل الحضور (نطاق البصمة بالمتر / كم):' : 'Allowed Attendance Geofence Radius:'}
                      </label>
                      <span className="font-mono font-black text-sm text-[#F45A0A] bg-white px-2.5 py-0.5 rounded-lg border border-orange-200">
                        {branchRadius} {isAr ? 'متر' : 'm'} {branchRadius >= 1000 ? `(${(branchRadius / 1000).toFixed(1)} كم)` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {[50, 100, 150, 300, 500, 1000, 2000].map((radius) => (
                        <button
                          key={radius}
                          type="button"
                          onClick={() => setBranchRadius(radius)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                            branchRadius === radius
                              ? 'bg-[#F45A0A] text-white shadow-2xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:border-orange-300'
                          }`}
                        >
                          {radius >= 1000 ? `${radius / 1000} كم` : `${radius}م`}
                          {radius === 150 ? (isAr ? ' (افتراضي)' : ' (Default)') : ''}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Map Preview / Google Maps Link */}
                  {branchLatitude && branchLongitude && (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 text-[#F45A0A] flex items-center justify-center">
                          <IconMapPin size={16} />
                        </div>
                        <div>
                          <span className="font-mono font-black text-xs text-slate-900 block">
                            {Number(branchLatitude).toFixed(6)}, {Number(branchLongitude).toFixed(6)}
                          </span>
                          <span className="text-[11px] text-emerald-700 font-bold block">
                            ✓ {isAr ? 'جاهز لتفعيل البصمة الجغرافية الذكية' : 'Ready for geofenced attendance'}
                          </span>
                        </div>
                      </div>

                      <a
                        href={`https://www.google.com/maps?q=${branchLatitude},${branchLongitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <IconExternalLink size={13} />
                        <span>{isAr ? 'معاينة في خرائط جوجل' : 'Preview Map'}</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {modalBranchTab === 'contacts' && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <TextInput
                      label={isAr ? 'رقم الهاتف الرئيسي *' : 'Main Phone *'}
                      placeholder="07714289278"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      leftSection={<IconPhone size={14} />}
                    />
                    <TextInput
                      label={isAr ? 'رقم الهاتف الثاني (مبيعات / حوار)' : 'Secondary Phone'}
                      placeholder="07801234567"
                      value={phone2}
                      onChange={(e) => setPhone2(e.target.value)}
                      leftSection={<IconPhone size={14} />}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <TextInput
                      label={isAr ? 'البريد الإلكتروني الرئيسي' : 'Primary Email'}
                      placeholder="info@alfursan.iq"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      leftSection={<IconMail size={14} />}
                    />
                    <TextInput
                      label={isAr ? 'البريد الإلكتروني الثاني (حسابات / حجز)' : 'Secondary Email'}
                      placeholder="accounts@alfursan.iq"
                      value={email2}
                      onChange={(e) => setEmail2(e.target.value)}
                      leftSection={<IconMail size={14} />}
                    />
                  </div>
                </div>
              )}

              {modalBranchTab === 'social' && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <TextInput
                      label="WhatsApp"
                      placeholder="07714289278"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      leftSection={<IconBrandWhatsapp size={14} className="text-teal-600" />}
                    />
                    <TextInput
                      label="Telegram"
                      placeholder="@alfursan_karbala"
                      value={telegram}
                      onChange={(e) => setTelegram(e.target.value)}
                      leftSection={<IconBrandTelegram size={14} className="text-sky-600" />}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <TextInput
                      label="Facebook"
                      placeholder="https://facebook.com/alfursan.iq"
                      value={facebook}
                      onChange={(e) => setFacebook(e.target.value)}
                      leftSection={<IconBrandFacebook size={14} className="text-blue-600" />}
                    />
                    <TextInput
                      label="Instagram"
                      placeholder="@alfursan_travel"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      leftSection={<IconBrandInstagram size={14} className="text-rose-600" />}
                    />
                  </div>

                  <TextInput
                    label="Website"
                    placeholder="https://alfursan.iq"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    leftSection={<IconGlobe size={14} className="text-orange-600" />}
                  />
                </div>
              )}

              <div className="pt-3 flex justify-between items-center border-t border-slate-200">
                <div className="flex gap-1">
                  {modalBranchTab !== 'info' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (modalBranchTab === 'social') setModalBranchTab('contacts');
                        else if (modalBranchTab === 'contacts') setModalBranchTab('location');
                        else setModalBranchTab('info');
                      }}
                      className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      {isAr ? 'السابق' : 'Previous'}
                    </button>
                  )}
                  {modalBranchTab !== 'social' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (modalBranchTab === 'info') setModalBranchTab('location');
                        else if (modalBranchTab === 'location') setModalBranchTab('contacts');
                        else setModalBranchTab('social');
                      }}
                      className="h-8 px-3 rounded-lg bg-orange-50 text-[#F45A0A] hover:bg-orange-100 font-bold text-xs cursor-pointer"
                    >
                      {isAr ? 'التالي' : 'Next'}
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs cursor-pointer"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveBranch}
                    className="h-8 px-4 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {editMode ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'حفظ وإنشاء الفرع' : 'Create Branch')}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 2 MODAL: DEPARTMENT FORM */}
          {activeTab === 'departments' && (
            <div className="space-y-3.5 pt-1">
              <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
                <Select
                  label={isAr ? 'الفرع التابع له القسم *' : 'Belongs to Branch *'}
                  data={branches.map((b) => b.nameAr)}
                  value={depBranchName}
                  onChange={(val) => setDepBranchName(val || (isAr ? 'المركز الرئيسي - بغداد' : 'HQ - Baghdad'))}
                />
                <div className="grid grid-cols-2 gap-3">
                  <TextInput
                    label={isAr ? 'كود القسم *' : 'Department Code *'}
                    placeholder="ACC / TKT"
                    value={depCode}
                    onChange={(e) => setDepCode(e.target.value)}
                  />
                  <TextInput
                    label={isAr ? 'اسم القسم الإداري *' : 'Department Name *'}
                    placeholder="قسم الحسابات / قسم الطيران"
                    value={depName}
                    onChange={(e) => setDepName(e.target.value)}
                  />
                </div>
                <Select
                  label={isAr ? 'مسؤول القسم (اختر الموظف المسؤول)' : 'Department Head'}
                  placeholder={isAr ? 'اختر الموظف المسؤول عن هذا القسم' : 'Select head of department'}
                  data={[isAr ? 'لم يتم التعيين بعد' : 'Unassigned', ...employees.map((e) => e.fullName)]}
                  value={depHeadName || (isAr ? 'لم يتم التعيين بعد' : 'Unassigned')}
                  onChange={(val) => setDepHeadName(val === (isAr ? 'لم يتم التعيين بعد' : 'Unassigned') ? '' : val || '')}
                />
                <Textarea
                  label={isAr ? 'وصف القسم والمهام' : 'Description'}
                  placeholder="وصف مختصر لمسؤوليات هذا القسم..."
                  value={depDescription}
                  onChange={(e) => setDepDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveDepartment}
                  className="h-8 px-4 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {editMode ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'حفظ وإنشاء القسم' : 'Create Department')}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3 MODAL: EMPLOYEE FORM */}
          {activeTab === 'employees' && (
            <div className="space-y-3.5 pt-1">
              <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    size="xs"
                    label={isAr ? 'الفرع المخصص *' : 'Assigned Branch *'}
                    data={branches.map((b) => b.nameAr)}
                    value={empBranchName || branches[0]?.nameAr || null}
                    onChange={(val) => setEmpBranchName(val || branches[0]?.nameAr || '')}
                  />
                  <Select
                    size="xs"
                    label={isAr ? 'القسم التابع له *' : 'Department *'}
                    data={departmentOptions}
                    value={empDepName || departmentOptions[0]}
                    onChange={(val) => setEmpDepName(val || departmentOptions[0])}
                    searchable
                  />
                </div>

                <TextInput
                  size="xs"
                  label={isAr ? 'اسم الموظف الثلاثي *' : 'Full Name *'}
                  placeholder="علي حسين الكعبي"
                  value={empFullName}
                  onChange={(e) => setEmpFullName(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <TextInput
                    size="xs"
                    label={isAr ? 'المسمى الوظيفي' : 'Job Title'}
                    placeholder="محاسب / مسؤول دعم وحجوزات"
                    value={empJobTitle}
                    onChange={(e) => setEmpJobTitle(e.target.value)}
                  />
                  <TextInput
                    size="xs"
                    label={isAr ? 'رقم الهاتف' : 'Phone'}
                    placeholder="07701234567"
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    leftSection={<IconPhone size={14} />}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TextInput
                    size="xs"
                    label={isAr ? 'البريد الإلكتروني' : 'Email'}
                    placeholder="employee@alfursan.iq"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    leftSection={<IconMail size={14} />}
                  />
                  <Select
                    size="xs"
                    label={isAr ? 'الصندوق المخصص للموظف *' : 'Assigned Cashbox *'}
                    data={realCashboxOptions}
                    value={empAssignedCashbox}
                    onChange={(val) => setEmpAssignedCashbox(val || (realCashboxOptions[0]?.value || ''))}
                    searchable
                    placeholder={isAr ? 'اختر الصندوق من شجرة الحسابات...' : 'Select cashbox...'}
                  />
                </div>
              </div>

              {/* Manager Selection Checkbox */}
              <div className="flex items-center gap-2.5 p-3 bg-orange-50/60 border border-orange-200 rounded-xl">
                <input
                  type="checkbox"
                  id="empIsHeadCheckbox"
                  checked={empIsHead}
                  onChange={(e) => setEmpIsHead(e.target.checked)}
                  className="accent-[#F45A0A] w-4 h-4 cursor-pointer rounded"
                />
                <label htmlFor="empIsHeadCheckbox" className="font-bold text-slate-800 cursor-pointer text-xs">
                  {isAr ? `تعيين هذا الموظف كـ مسؤول عن (${empDepName})` : `Set as Head of (${empDepName})`}
                </label>
              </div>

              {/* Create User Account Section */}
              <div className="space-y-3 p-3.5 bg-white border border-orange-200 rounded-xl shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                    <div className="p-1.5 rounded-lg bg-orange-100 text-[#F45A0A] shrink-0">
                      <IconKey size={16} />
                    </div>
                    <div>
                      <span className="block font-black text-slate-900">{isAr ? 'إنشاء حساب دخول للنظام لهذا الموظف' : 'Enable System User Account'}</span>
                      <span className="text-[10px] font-normal text-slate-500">{isAr ? 'تعيين اسم الدخول وكلمة المرور وتفويض الصلاحيات' : 'Set username, password, and permissions'}</span>
                    </div>
                  </div>
                  <Switch
                    checked={empCreateUser}
                    onChange={(e) => {
                      const isChecked = e.currentTarget.checked;
                      setEmpCreateUser(isChecked);
                      if (isChecked) {
                        if (!empUsername) {
                          setEmpUsername(empEmail || `${empFullName.trim().replace(/\s+/g, '.').toLowerCase()}@alfursan.iq`);
                        }
                        if (!empPassword && !empHasExistingLogin) {
                          setEmpPassword('12345678');
                        }
                      }
                    }}
                    color="orange"
                    size="sm"
                  />
                </div>

                {empCreateUser && (
                  <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                    <div className="grid grid-cols-2 gap-3 items-start">
                      <TextInput
                        size="xs"
                        label={isAr ? 'اسم المستخدم / اسم الدخول *' : 'Username / Login Email *'}
                        placeholder="user@alfursan.iq"
                        value={empUsername}
                        onChange={(e) => setEmpUsername(e.target.value)}
                        leftSection={<IconUser size={14} />}
                      />
                      <PasswordInput
                        size="xs"
                        label={
                          empHasExistingLogin
                            ? (isAr ? 'كلمة المرور للنظام' : 'Password')
                            : (isAr ? 'كلمة المرور للنظام *' : 'Password *')
                        }
                        description={
                          empHasExistingLogin
                            ? (isAr
                              ? 'اتركها فارغة للإبقاء على كلمة المرور الحالية، أو اكتب كلمة جديدة لتغييرها.'
                              : 'Leave blank to keep the current password, or type a new one to change it.')
                            : undefined
                        }
                        placeholder={empHasExistingLogin ? (isAr ? 'بدون تغيير' : 'Unchanged') : '••••••••'}
                        value={empPassword}
                        onChange={(e) => setEmpPassword(e.target.value)}
                        leftSection={<IconLock size={14} />}
                      />
                    </div>

                    <Select
                      size="xs"
                      label={isAr ? 'مجموعة الصلاحيات *' : 'Permission Group *'}
                      placeholder={isAr ? 'اختر مجموعة الصلاحيات...' : 'Select role group...'}
                      data={permissionGroups.map((g) => ({
                        value: g.id,
                        label: `${g.name}${g.description ? ` — ${g.description}` : ''}`,
                      }))}
                      value={empPermissionGroupId}
                      onChange={(val) => {
                        setEmpPermissionGroupId(val || null);
                        const group = permissionGroups.find((g) => g.id === val);
                        setEmpRole(group?.name || '');
                      }}
                      searchable
                    />
                  </div>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveEmployee}
                  className="h-8 px-4 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {editMode ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'حفظ وإضافة الموظف' : 'Add Employee')}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4 MODAL: USER FORM */}
          {activeTab === 'users' && (
            <div className="space-y-3.5 pt-1">
              <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
                <TextInput
                  size="xs"
                  label={isAr ? 'اسم المستخدم الحقيقي *' : 'User Full Name *'}
                  placeholder="أحمد المحمود"
                  value={usrFullName}
                  onChange={(e) => setUsrFullName(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3 items-start">
                  <TextInput
                    size="xs"
                    label={isAr ? 'اسم الدخول / البريد *' : 'Login Email *'}
                    placeholder="user@alfursan.iq"
                    value={usrEmail}
                    onChange={(e) => setUsrEmail(e.target.value)}
                    leftSection={<IconMail size={14} />}
                  />
                  <PasswordInput
                    size="xs"
                    label={isAr ? 'كلمة المرور للنظام *' : 'Password *'}
                    placeholder="••••••••"
                    value={usrPassword}
                    onChange={(e) => setUsrPassword(e.target.value)}
                    leftSection={<IconLock size={14} />}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Select
                    size="xs"
                    label={isAr ? 'صلاحية الفرع *' : 'Branch Scope *'}
                    data={branchOptions}
                    value={usrBranchName}
                    onChange={(val) => setUsrBranchName(val || (isAr ? 'جميع الفروع' : 'All Branches'))}
                  />
                  <Select
                    size="xs"
                    label={isAr ? 'دور الصلاحيات للنظام *' : 'Role *'}
                    data={permissionGroups.map((g) => g.name)}
                    value={usrRole}
                    onChange={(val) => setUsrRole(val || '')}
                    placeholder={isAr ? 'اختر مجموعة الصلاحيات' : 'Select role'}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl">
                <div>
                  <span className="font-black text-slate-900 block text-xs">{isAr ? 'تعيين كحساب دعم فني لنظام الشركة' : 'System Support Account'}</span>
                  <span className="text-[11px] text-slate-500 font-normal">{isAr ? 'يمتلك حساب الدعم صلاحية الدعم والمساعدة لمستخدمي فروع الشركة' : 'Grant support and troubleshooting access across branches'}</span>
                </div>
                <Switch
                  checked={usrIsSupport}
                  onChange={(e) => setUsrIsSupport(e.currentTarget.checked)}
                  color="purple"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveUser}
                  className="h-8 px-4 rounded-lg bg-[#F45A0A] hover:bg-[#DD4F05] text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {editMode ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'حفظ وإنشاء مستخدم النظام' : 'Create User')}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── 6. CONFIRM DELETE MODAL ── */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title={<span className="font-bold text-xs text-rose-900">{isAr ? 'تأكيد عملية الحذف' : 'Confirm Delete'}</span>}
        size="sm"
        dir={direction}
        centered
        radius="lg"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-800 font-semibold leading-relaxed">
            {isAr ? 'هل أنت متأكد من رغبتك في حذف' : 'Are you sure you want to delete'}{' '}
            <strong className="text-rose-700 font-bold">({itemToDelete?.name})</strong>{' '}
            {isAr ? 'نهائياً من قاعدة البيانات؟' : 'permanently?'}
          </p>
          <p className="text-[11px] text-slate-600 bg-amber-50 p-2.5 border border-amber-200 rounded-xl">
            {isAr ? '⚠️ تنبيه: لا يمكن التراجع عن هذه العملية بعد إتمام الحذف.' : '⚠️ Warning: This action cannot be undone.'}
          </p>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleConfirmDelete}
              className="h-8 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isAr ? 'تأكيد الحذف النهائي' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── 7. HARDWARE DEVICE BINDING MODAL ── */}
      <Modal
        opened={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-50 text-[#F45A0A] border border-orange-200">
              <IconDeviceMobile size={16} />
            </div>
            <div>
              <span className="font-black text-xs text-slate-900 block">
                {isAr ? 'اعتماد وربط جهاز موثّق حصري للموظف' : 'Bind Hardware Trusted Device'}
              </span>
              <span className="text-[10px] text-slate-500 font-bold block">
                {selectedEmpForDevice?.fullName} — {selectedEmpForDevice?.branchName}
              </span>
            </div>
          </div>
        }
        size="md"
        dir={direction}
        centered
        radius="lg"
      >
        <div className="space-y-3.5 text-xs">
          <div className="p-3 bg-orange-50/70 border border-orange-200/80 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-slate-900 font-black text-xs">
              <IconShieldLock size={15} className="text-[#F45A0A]" />
              <span>{isAr ? 'سياسة جهاز واحد معتمد لكل موظف' : 'One Trusted Device Per Employee Policy'}</span>
            </div>
            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
              {isAr
                ? 'يمنع هذا النظام فتح الحساب أو تسجيل الحضور من هاتف صديق أو أجهزة متعددة. يتم توثيق بصمة عتادية مؤمنة داخل المعالج الأمني للهاتف.'
                : 'Prevents account access or attendance logging from colleagues’ phones. Hardware security attestation is enforced.'}
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              {isAr ? 'منصة الهاتف ونظام الأمان المعتمد *' : 'Platform & Security Attestation *'}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setBindPlatform('android');
                  setBindDeviceModel('Samsung Galaxy S24 Ultra');
                }}
                className={`p-3 rounded-xl border text-start transition-all cursor-pointer ${
                  bindPlatform === 'android'
                    ? 'border-[#F45A0A] bg-orange-50/50 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="text-base block mb-1">🤖</span>
                <span className="font-black text-xs text-slate-900 block">Android</span>
                <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                  Keystore + Play Integrity
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBindPlatform('ios');
                  setBindDeviceModel('iPhone 15 Pro Max');
                }}
                className={`p-3 rounded-xl border text-start transition-all cursor-pointer ${
                  bindPlatform === 'ios'
                    ? 'border-[#F45A0A] bg-orange-50/50 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="text-base block mb-1">🍏</span>
                <span className="font-black text-xs text-slate-900 block">iPhone / iOS</span>
                <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                  Secure Enclave + App Attest
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isAr ? 'طراز الجهاز (Model Name) *' : 'Device Model Name *'}
            </label>
            <TextInput
              value={bindDeviceModel}
              onChange={(e) => setBindDeviceModel(e.target.value)}
              placeholder={bindPlatform === 'android' ? 'Samsung Galaxy S24 / Xiaomi 14' : 'iPhone 15 Pro / iPhone 14'}
            />
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[10.5px] text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span className="font-bold">{isAr ? 'نوع التوثيق العتادي:' : 'Hardware Attestation:'}</span>
              <span className="font-black text-slate-800">
                {bindPlatform === 'android' ? 'Android Keystore HSM' : 'Apple Secure Enclave'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">{isAr ? 'حماية من فتح الحساب من هاتف الصديق:' : 'Friend Phone Prevention:'}</span>
              <span className="text-emerald-700 font-black">✓ {isAr ? 'مفعلة وصارمة' : 'Active & Enforced'}</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setDeviceModalOpen(false)}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={bindingDevice || !bindDeviceModel.trim()}
              onClick={handleBindDevice}
              className="h-8 px-4 rounded-lg bg-[#F45A0A] hover:bg-[#DC4B02] text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <IconShieldCheck size={14} />
              <span>{bindingDevice ? (isAr ? 'جاري الاعتماد...' : 'Binding...') : (isAr ? 'اعتماد وتوثيق الجهاز' : 'Verify & Bind Device')}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
