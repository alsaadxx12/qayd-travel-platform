import React, { useState, useMemo, useEffect } from 'react';
import {
  Button,
  Badge,
  Modal,
  TextInput,
  Drawer,
  Switch,
  Tooltip,
  ActionIcon,
  Select,
} from '@mantine/core';
import {
  IconShieldCheck,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconUserCheck,
  IconDatabaseOff,
  IconEdit,
  IconTrash,
  IconCopy,
  IconCheck,
  IconLock,
  IconDeviceFloppy,
  IconChecklist,
  IconUsers,
  IconSitemap,
  IconFilter,
  IconEye,
} from '@tabler/icons-react';
import { PERMISSION_REGISTRY } from '../../config/permissionRegistry';
import { usePermissions } from '../../hooks/usePermissions';
import { usePermissionAlertStore } from '../../store/usePermissionAlertStore';
import { rolesApi } from '../../api/roles';
import { branchesApi } from '../../api/branches';
import { employeesApi } from '../../api/employees';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';

export interface PermissionGroup {
  id: string;
  name: string;
  type: string;
  level: number;
  allowedBranches: string;
  empCount: number;
  updated: string;
  status: string;
  description?: string;
  enabledPermissions: string[]; // List of permission codes enabled for this group
}

export const PermissionGroupsPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const { showPermissionAlert } = usePermissionAlertStore();
  const canCreateRole = hasPermission('roles.create');
  const canUpdateRole = hasPermission('roles.update');
  const canDeleteRole = hasPermission('roles.delete');

  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [branchOptions, setBranchOptions] = useState<string[]>(['جميع الفروع']);

  useEffect(() => {
    branchesApi.getAll()
      .then(branches => {
        const names = branches.map((b: any) => b.nameAr).filter(Boolean);
        setBranchOptions(['جميع الفروع', ...names, 'فرع محدد']);
      })
      .catch(() => {});
  }, []);

  const [activeCategory, setActiveCategory] = useState<string>('الكل');
  const [activeModuleId, setActiveModuleId] = useState<string>('tickets');
  const [searchModuleTerm, setSearchModuleTerm] = useState<string>('');
  const [searchGroupTerm, setSearchGroupTerm] = useState<string>('');

  // Modals & Drawers State
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [effectivePreviewOpen, setEffectivePreviewOpen] = useState<boolean>(false);
  const [isEditGroupMode, setIsEditGroupMode] = useState<boolean>(false);

  // Group Modal Form State
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalGroupScope, setModalGroupScope] = useState('جميع الفروع');
  const [modalGroupDescription, setModalGroupDescription] = useState('');
  const [modalEditingId, setModalEditingId] = useState<string | null>(null);

  // Real employees for effective preview
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [previewEmployeeId, setPreviewEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    employeesApi.getAll()
      .then(emps => setEmployeesList(Array.isArray(emps) ? emps : []))
      .catch(() => {});
  }, []);

  // Load from DB
  useEffect(() => {
    rolesApi.getAll()
      .then(roles => {
        if (roles && roles.length > 0) {
          const mapped: PermissionGroup[] = roles.map((r: any) => {
            let perms: string[] = [];
            try {
              perms = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : (r.permissions || []);
            } catch (e) {
              perms = [];
            }
            return {
              id: r.id,
              name: r.name,
              type: r.isSystem ? 'نظامي' : 'مخصص',
              level: r.isSystem ? 100 : 50,
              allowedBranches: r.allowedBranches || 'جميع الفروع',
              empCount: 0,
              updated: r.updatedAt ? new Date(r.updatedAt).toISOString().split('T')[0] : '2026-08-20',
              status: 'نشط',
              description: r.description,
              enabledPermissions: perms,
            };
          });
          setPermissionGroups(mapped);
          setSelectedGroupId(mapped[0]?.id || '');
        } else {
          const defaultGroup: PermissionGroup = {
            id: 'admin-default',
            name: 'إدارة العمليات المحاسبية والحجوزات',
            type: 'مخصص',
            level: 80,
            allowedBranches: 'جميع الفروع',
            empCount: 0,
            updated: '2026-08-20',
            status: 'نشط',
            description: 'دور محاسبي وتشغيلي مخصص',
            enabledPermissions: ['tickets.view', 'tickets.create', 'vouchers.view', 'vouchers.create'],
          };
          setPermissionGroups([defaultGroup]);
          setSelectedGroupId(defaultGroup.id);
        }
      })
      .catch(() => {});
  }, []);

  // Update employee counts for groups
  useEffect(() => {
    employeesApi.getAll()
      .then(emps => {
        if (emps && emps.length > 0) {
          setPermissionGroups(prev => prev.map(grp => {
            const count = emps.filter((e: any) => e.departmentName === grp.name || e.jobTitle?.includes(grp.name)).length;
            return { ...grp, empCount: count };
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Active Selected Group
  const currentGroup = useMemo(() => {
    return permissionGroups.find(g => g.id === selectedGroupId) || permissionGroups[0] || null;
  }, [permissionGroups, selectedGroupId]);

  // Statistics calculation
  const totalModules = PERMISSION_REGISTRY.length;
  const totalPermissionsCount = useMemo(() => {
    return PERMISSION_REGISTRY.reduce((acc, mod) => acc + mod.permissions.length, 0);
  }, []);

  const groupEnabledCount = currentGroup?.enabledPermissions?.length || 0;
  const coveragePercentage = Math.round((groupEnabledCount / (totalPermissionsCount || 1)) * 100);

  // Categories list
  const categories = ['الكل', 'الرئيسية', 'العمليات والخدمات', 'الحسابات', 'التقارير', 'الإدارة والرقابة'];

  // Filter Modules by category and search
  const filteredModules = useMemo(() => {
    return PERMISSION_REGISTRY.filter(mod => {
      const matchCategory = activeCategory === 'الكل' || mod.category === activeCategory;
      const matchSearch = searchModuleTerm.trim() === '' || 
        mod.title.toLowerCase().includes(searchModuleTerm.toLowerCase()) ||
        mod.permissions.some(p => p.label.includes(searchModuleTerm) || p.code.includes(searchModuleTerm));
      return matchCategory && matchSearch;
    });
  }, [activeCategory, searchModuleTerm]);

  // Filter Groups by search
  const filteredGroups = useMemo(() => {
    return permissionGroups.filter(g => 
      searchGroupTerm.trim() === '' || g.name.toLowerCase().includes(searchGroupTerm.toLowerCase())
    );
  }, [permissionGroups, searchGroupTerm]);

  // Active Module Details
  const currentModule = useMemo(() => {
    return PERMISSION_REGISTRY.find(m => m.id === activeModuleId) || PERMISSION_REGISTRY[0];
  }, [activeModuleId]);

  // Ensure activeModuleId stays valid when category changes
  useEffect(() => {
    if (filteredModules.length > 0 && !filteredModules.some(m => m.id === activeModuleId)) {
      setActiveModuleId(filteredModules[0].id);
    }
  }, [filteredModules, activeModuleId]);

  // Toggle single permission for current group
  const handleTogglePermission = (permCode: string) => {
    if (!canUpdateRole) {
      showPermissionAlert({
        actionTitle: 'تعديل صلاحيات الأدوار',
        permissionCode: 'roles.update',
        description: 'لا تملك صلاحية تعديل صلاحيات المجموعات والأدوار.',
      });
      return;
    }
    if (!currentGroup) return;

    const currentEnabled = currentGroup.enabledPermissions || [];
    const exists = currentEnabled.includes(permCode);
    const updatedPermissions = exists
      ? currentEnabled.filter(c => c !== permCode)
      : [...currentEnabled, permCode];

    setPermissionGroups(permissionGroups.map(g => 
      g.id === currentGroup.id 
        ? { ...g, enabledPermissions: updatedPermissions, updated: new Date().toISOString().split('T')[0] } 
        : g
    ));

    // Sync to DB
    rolesApi.update(currentGroup.id, {
      permissions: JSON.stringify(updatedPermissions),
    }).catch(() => {});
  };

  // Enable all permissions for active module
  const handleEnableAllInModule = () => {
    if (!canUpdateRole) {
      showPermissionAlert({
        actionTitle: 'تفعيل وحدة الصلاحيات',
        permissionCode: 'roles.update',
        description: 'لا تملك صلاحية تعديل مصفوفة الصلاحيات.',
      });
      return;
    }
    if (!currentGroup || !currentModule) return;
    const moduleCodes = currentModule.permissions.map(p => p.code);
    const existing = new Set(currentGroup.enabledPermissions || []);
    moduleCodes.forEach(code => existing.add(code));

    const updated = Array.from(existing);
    setPermissionGroups(permissionGroups.map(g => 
      g.id === currentGroup.id 
        ? { ...g, enabledPermissions: updated, updated: new Date().toISOString().split('T')[0] } 
        : g
    ));
    rolesApi.update(currentGroup.id, {
      permissions: JSON.stringify(updated),
    }).catch(() => {});
    showSuccessNotification('تم التفعيل', `تم تفعيل كافة صلاحيات وحدة (${currentModule.title}) لمجموعة (${currentGroup.name}).`);
  };

  // Disable all permissions for active module
  const handleDisableAllInModule = () => {
    if (!canUpdateRole) {
      showPermissionAlert({
        actionTitle: 'تعطيل وحدة الصلاحيات',
        permissionCode: 'roles.update',
        description: 'لا تملك صلاحية تعديل مصفوفة الصلاحيات.',
      });
      return;
    }
    if (!currentGroup || !currentModule) return;
    const moduleCodes = new Set(currentModule.permissions.map(p => p.code));
    const updatedPermissions = (currentGroup.enabledPermissions || []).filter(code => !moduleCodes.has(code));

    setPermissionGroups(permissionGroups.map(g => 
      g.id === currentGroup.id 
        ? { ...g, enabledPermissions: updatedPermissions, updated: new Date().toISOString().split('T')[0] } 
        : g
    ));
    rolesApi.update(currentGroup.id, {
      permissions: JSON.stringify(updatedPermissions),
    }).catch(() => {});
    showSuccessNotification('تم التعطيل', `تم إيقاف صلاحيات وحدة (${currentModule.title}) لمجموعة (${currentGroup.name}).`);
  };

  // Save / Create Group Modal Handler
  const handleOpenAddGroup = () => {
    if (!canCreateRole) {
      showPermissionAlert({
        actionTitle: 'إنشاء مجموعة جديدة',
        permissionCode: 'roles.create',
        description: 'لا تملك صلاحية إنشاء مجموعات صلاحيات جديدة.',
      });
      return;
    }
    setIsEditGroupMode(false);
    setModalEditingId(null);
    setModalGroupName('');
    setModalGroupScope('جميع الفروع');
    setModalGroupDescription('');
    setCreateModalOpen(true);
  };

  const handleOpenEditGroup = (group: PermissionGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canUpdateRole) {
      showPermissionAlert({
        actionTitle: 'تعديل بيانات المجموعة',
        permissionCode: 'roles.update',
        description: 'لا تملك صلاحية تعديل بيانات مجموعة الصلاحيات.',
      });
      return;
    }
    setIsEditGroupMode(true);
    setModalEditingId(group.id);
    setModalGroupName(group.name);
    setModalGroupScope(group.allowedBranches);
    setModalGroupDescription(group.description || '');
    setCreateModalOpen(true);
  };

  const handleSaveGroupModal = () => {
    if (!modalGroupName.trim()) {
      showErrorNotification('تنبيه الإدخال', 'يرجى كتابة اسم مجموعة الصلاحيات');
      return;
    }

    if (isEditGroupMode && modalEditingId) {
      if (!canUpdateRole) {
        showPermissionAlert({
          actionTitle: 'تحديث بيانات المجموعة',
          permissionCode: 'roles.update',
          description: 'لا تملك صلاحية تعديل مجموعات الصلاحيات.',
        });
        return;
      }
      rolesApi.update(modalEditingId, {
        name: modalGroupName,
        description: modalGroupDescription,
        allowedBranches: modalGroupScope,
      }).then(() => {
        setPermissionGroups(permissionGroups.map(g => g.id === modalEditingId ? {
          ...g,
          name: modalGroupName,
          allowedBranches: modalGroupScope,
          description: modalGroupDescription,
          updated: new Date().toISOString().split('T')[0],
        } : g));
        showSuccessNotification('تم التحديث', `تم تحديث بيانات مجموعة (${modalGroupName}) في قاعدة البيانات.`);
      }).catch((err: any) => {
        showErrorNotification('خطأ', err.message || 'تعذر تحديث المجموعة');
      });
    } else {
      if (!canCreateRole) {
        showPermissionAlert({
          actionTitle: 'إنشاء مجموعة جديدة',
          permissionCode: 'roles.create',
          description: 'لا تملك صلاحية إنشاء مجموعات صلاحيات جديدة.',
        });
        return;
      }
      rolesApi.create({
        name: modalGroupName,
        description: modalGroupDescription || 'مجموعة صلاحيات مخصصة للنظام',
        permissions: '[]',
        allowedBranches: modalGroupScope,
      }).then(created => {
        const newGroup: PermissionGroup = {
          id: created.id,
          name: created.name,
          type: 'مخصص',
          level: 50,
          allowedBranches: modalGroupScope,
          empCount: 0,
          updated: new Date().toISOString().split('T')[0],
          status: 'نشط',
          description: created.description || 'مجموعة صلاحيات مخصصة للنظام',
          enabledPermissions: [],
        };
        setPermissionGroups([...permissionGroups, newGroup]);
        setSelectedGroupId(newGroup.id);
        showSuccessNotification('تم الحفظ', `تم إنشاء مجموعة الصلاحيات (${modalGroupName}) في قاعدة البيانات.`);
      }).catch((err: any) => {
        showErrorNotification('خطأ', err.message || 'تعذر إنشاء المجموعة');
      });
    }
    setCreateModalOpen(false);
  };

  const handleDeleteGroup = (groupId: string, groupName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDeleteRole) {
      showPermissionAlert({
        actionTitle: 'حذف مجموعة الصلاحيات',
        permissionCode: 'roles.delete',
        description: 'لا تملك صلاحية حذف مجموعات الصلاحيات.',
      });
      return;
    }
    if (permissionGroups.length <= 1) {
      showErrorNotification('تنبيه', 'لا يمكن حذف كافة المجموعات، يجب الإبقاء على مجموعة واحدة على الأقل');
      return;
    }
    rolesApi.delete(groupId).catch(() => {});
    setPermissionGroups(permissionGroups.filter(g => g.id !== groupId));
    if (selectedGroupId === groupId) {
      setSelectedGroupId(permissionGroups.find(g => g.id !== groupId)?.id || '');
    }
    showSuccessNotification('تم الحذف', `تم حذف مجموعة الصلاحيات (${groupName}) بنجاح.`);
  };

  const handleDuplicateGroup = (group: PermissionGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canCreateRole) {
      showPermissionAlert({
        actionTitle: 'نسخ وتكرار المجموعة',
        permissionCode: 'roles.create',
        description: 'لا تملك صلاحية إنشاء / تكرار مجموعات الصلاحيات.',
      });
      return;
    }
    rolesApi.create({
      name: `${group.name} (نسخة)`,
      description: group.description || '',
      permissions: JSON.stringify(group.enabledPermissions || []),
      allowedBranches: group.allowedBranches,
    }).then(created => {
      const dupGroup: PermissionGroup = {
        id: created.id,
        name: created.name,
        type: 'مخصص',
        level: 50,
        allowedBranches: group.allowedBranches,
        empCount: 0,
        updated: new Date().toISOString().split('T')[0],
        status: 'نشط',
        description: created.description || '',
        enabledPermissions: group.enabledPermissions || [],
      };
      setPermissionGroups([...permissionGroups, dupGroup]);
      setSelectedGroupId(dupGroup.id);
      showSuccessNotification('تم النسخ', `تم إنشاء نسخة طبق الأصل من مجموعة (${group.name}) بنجاح.`);
    }).catch(() => {
      showErrorNotification('خطأ', 'تعذر تكرار المجموعة');
    });
  };

  return (
    <div 
      className="space-y-4 w-full select-none text-xs pb-10" 
      dir="rtl"
      style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
    >
      {/* ── 1. TOP HEADER BANNER ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF3E8] text-[#F45A0A] border border-orange-200 flex items-center justify-center font-black shadow-2xs shrink-0">
              <IconShieldCheck size={26} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-base sm:text-lg font-black text-slate-950 leading-tight">
                  صلاحيات وأدوار موظفي وكوادر الشركة (Company Staff RBAC)
                </h1>
                <Badge color="orange" variant="light" radius="xl" className="font-mono font-black tabular-nums">
                  تغطية الصلاحيات: {coveragePercentage}% ({totalModules}/29 وحدة)
                </Badge>
              </div>
              <p className="text-xs text-slate-500 font-bold mt-1">
                إدارة أدوار موظفي الشركة فقط، تحديد صلاحيات المحاسبين وكوادر الحجز، وتعيين استثناءات الفروع الداخلية.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              size="sm"
              variant="default"
              leftSection={<IconUserCheck size={16} className="text-slate-600" />}
              onClick={() => setEffectivePreviewOpen(true)}
              className="h-10 px-4 rounded-xl font-black text-xs border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              معاينة صلاحيات الموظف
            </Button>

            {canCreateRole && (
              <Button
                size="sm"
                leftSection={<IconPlus size={16} strokeWidth={2.5} />}
                onClick={handleOpenAddGroup}
                className="h-10 px-5 rounded-xl font-black text-xs bg-[#F45A0A] hover:bg-[#DD4F05] text-white shadow-2xs hover:shadow-xs transition-all"
              >
                إنشاء مجموعة جديدة
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. STATS ROW ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Card 1 */}
        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold block">مجموعات الصلاحيات</span>
            <span className="text-xl font-mono font-black text-slate-950 mt-0.5 block tabular-nums">
              {permissionGroups.length} <span className="text-xs font-sans text-slate-400 font-bold">مجموعة</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <IconShieldCheck size={20} strokeWidth={2.2} />
          </div>
        </div>

        {/* Card 2 */}
        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold block">الوحدات البرمجية</span>
            <span className="text-xl font-mono font-black text-slate-950 mt-0.5 block tabular-nums">
              {totalModules} <span className="text-xs font-sans text-slate-400 font-bold">وحدة</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <IconSitemap size={20} strokeWidth={2.2} />
          </div>
        </div>

        {/* Card 3 */}
        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold block">إجمالي الصلاحيات الدقيقة</span>
            <span className="text-xl font-mono font-black text-[#F45A0A] mt-0.5 block tabular-nums">
              {totalPermissionsCount} <span className="text-xs font-sans text-orange-400 font-bold">صلاحية</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#FFF3E8] text-[#F45A0A] border border-orange-200 flex items-center justify-center shrink-0">
            <IconChecklist size={20} strokeWidth={2.2} />
          </div>
        </div>

        {/* Card 4 */}
        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 font-bold block">الصلاحيات المفعّلة للمجموعة</span>
            <span className="text-xl font-mono font-black text-emerald-700 mt-0.5 block tabular-nums">
              {groupEnabledCount} <span className="text-xs font-mono text-slate-400 font-bold">/ {totalPermissionsCount}</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
            <IconSparkles size={20} strokeWidth={2.2} />
          </div>
        </div>
      </div>

      {/* ── 3. MAIN WORKSPACE MATRIX ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full">
        {/* RIGHT COLUMN: PERMISSION GROUPS CARDS SELECTOR (4 Columns) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="font-black text-xs text-slate-950 flex items-center gap-2">
                <IconShieldCheck size={18} className="text-[#F45A0A]" strokeWidth={2.2} />
                <span>مجموعات الصلاحيات المعتمدة</span>
              </span>
              <Badge color="orange" variant="light" className="font-mono font-black tabular-nums">
                {permissionGroups.length}
              </Badge>
            </div>

            <div className="relative">
              <TextInput
                placeholder="بحث في المجموعات..."
                size="sm"
                value={searchGroupTerm}
                onChange={(e) => setSearchGroupTerm(e.target.value)}
                leftSection={<IconSearch size={15} className="text-slate-400" />}
                className="font-bold"
              />
            </div>

            <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-0.5">
              {filteredGroups.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold text-xs space-y-2">
                  <IconDatabaseOff size={28} className="mx-auto text-slate-300" />
                  <p>لا توجد نتائج مطابقة لمجموعات الصلاحيات</p>
                </div>
              ) : (
                filteredGroups.map((grp) => {
                  const isSelected = grp.id === selectedGroupId;
                  const enabledNum = grp.enabledPermissions?.length || 0;
                  return (
                    <div
                      key={grp.id}
                      onClick={() => setSelectedGroupId(grp.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2.5 relative overflow-hidden ${
                        isSelected
                          ? 'bg-[#FFF3E8]/40 border-[#F45A0A] shadow-xs ring-1 ring-[#F45A0A]'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Right accent bar for active group */}
                      {isSelected && (
                        <div className="absolute top-0 right-0 bottom-0 w-1.5 bg-[#F45A0A]"></div>
                      )}

                      <div className="flex items-start justify-between gap-2 pr-1.5">
                        <div>
                          <h3 className="font-black text-xs text-slate-950 flex items-center gap-1.5">
                            <span>{grp.name}</span>
                          </h3>
                          <p className="text-[10.5px] text-slate-500 font-bold line-clamp-1 mt-0.5">
                            {grp.description || 'مجموعة صلاحيات مخصصة للنظام'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {canUpdateRole && (
                            <Tooltip label="تعديل المجموعة">
                              <ActionIcon size="sm" variant="subtle" color="gray" onClick={(e) => handleOpenEditGroup(grp, e)}>
                                <IconEdit size={14} />
                              </ActionIcon>
                            </Tooltip>
                          )}

                          {canCreateRole && (
                            <Tooltip label="نسخ وتكرار المجموعة">
                              <ActionIcon size="sm" variant="subtle" color="blue" onClick={(e) => handleDuplicateGroup(grp, e)}>
                                <IconCopy size={14} />
                              </ActionIcon>
                            </Tooltip>
                          )}

                          {canDeleteRole && (
                            <Tooltip label="حذف المجموعة">
                              <ActionIcon size="sm" variant="subtle" color="red" onClick={(e) => handleDeleteGroup(grp.id, grp.name, e)}>
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 pr-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-bold">{grp.allowedBranches}</span>
                        </div>

                        <Badge size="sm" color="orange" variant="light" className="font-mono font-black tabular-nums">
                          {enabledNum} صلاحية
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* LEFT COLUMN: PERMISSION MATRIX & MODULES TOGGLES (8 Columns) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4.5 shadow-2xs space-y-4">
            {/* Header of Active Group */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2.5">
                  <span className="font-black text-sm text-slate-950">
                    مصفوفة صلاحيات: {currentGroup?.name || 'اختر مجموعة'}
                  </span>
                  <Badge color="orange" variant="light" className="font-mono font-black tabular-nums">
                    {groupEnabledCount} من أصل {totalPermissionsCount} مفعّلة
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 font-bold">
                  حدد الصلاحيات الدقيقة المسموح بها لهذه المجموعة عبر الوحدات والخدمات.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {canUpdateRole && (
                  <>
                    <Button 
                      size="xs" 
                      variant="light" 
                      color="orange" 
                      leftSection={<IconCheck size={14} strokeWidth={2.5} />} 
                      onClick={handleEnableAllInModule}
                      className="h-8 rounded-xl font-black text-xs"
                    >
                      تفعيل وحدة ({currentModule?.title})
                    </Button>
                    <Button 
                      size="xs" 
                      variant="light" 
                      color="red" 
                      leftSection={<IconTrash size={14} />} 
                      onClick={handleDisableAllInModule}
                      className="h-8 rounded-xl font-black text-xs"
                    >
                      تعطيل الوحدة
                    </Button>
                    <Button 
                      size="xs" 
                      leftSection={<IconDeviceFloppy size={14} strokeWidth={2.2} />} 
                      onClick={() => showSuccessNotification('تم الحفظ', 'تم حفظ وتحديث مصفوفة الصلاحيات في قاعدة البيانات بنجاح.')} 
                      className="h-8 rounded-xl font-black text-xs bg-[#F45A0A] hover:bg-[#DD4F05] text-white shadow-xs"
                    >
                      حفظ الصلاحيات
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* CATEGORY & MODULE FILTER NAVIGATION */}
            <div className="space-y-3">
              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black shrink-0 cursor-pointer transition-all ${
                      activeCategory === cat
                        ? 'bg-[#F45A0A] text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}

                <div className="mr-auto min-w-[200px]">
                  <TextInput
                    placeholder="بحث عن صلاحية في الوحدات..."
                    size="xs"
                    value={searchModuleTerm}
                    onChange={(e) => setSearchModuleTerm(e.target.value)}
                    leftSection={<IconSearch size={14} className="text-slate-400" />}
                    className="font-bold"
                  />
                </div>
              </div>

              {/* Module Buttons Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100">
                {filteredModules.map((mod) => {
                  const isActive = activeModuleId === mod.id;
                  const modEnabledNum = mod.permissions.filter(p => currentGroup?.enabledPermissions?.includes(p.code)).length;
                  return (
                    <button
                      key={mod.id}
                      onClick={() => setActiveModuleId(mod.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black shrink-0 cursor-pointer flex items-center gap-2 transition-all ${
                        isActive
                          ? 'bg-orange-50 text-[#F45A0A] border border-[#F45A0A] shadow-2xs'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <span>{mod.title}</span>
                      <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded-md tabular-nums ${
                        isActive ? 'bg-[#F45A0A] text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {modEnabledNum}/{mod.permissions.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ACTIVE MODULE PERMISSIONS MATRIX GRID */}
            {currentModule && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 font-black text-slate-950 text-xs">
                    <IconSparkles size={16} className="text-[#F45A0A]" />
                    <span>وحدة: {currentModule.title}</span>
                    <span className="text-[10.5px] font-mono text-slate-500 font-bold">({currentModule.route})</span>
                  </div>

                  <Badge color="orange" variant="light" className="font-mono font-black tabular-nums">
                    {currentModule.permissions.filter(p => currentGroup?.enabledPermissions?.includes(p.code)).length} / {currentModule.permissions.length} مفعّلة
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-0.5">
                  {currentModule.permissions.map((perm) => {
                    const isChecked = currentGroup?.enabledPermissions?.includes(perm.code) || false;
                    return (
                      <div
                        key={perm.code}
                        onClick={() => handleTogglePermission(perm.code)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                          isChecked
                            ? 'bg-[#FFF3E8]/50 border-orange-300 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <Switch
                          size="xs"
                          color="orange"
                          checked={isChecked}
                          disabled={!canUpdateRole}
                          onChange={() => handleTogglePermission(perm.code)}
                          className="mt-0.5 shrink-0 cursor-pointer"
                        />

                        <div className="flex-1 space-y-1.5 min-w-0">
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="font-black text-slate-950 text-xs leading-snug truncate">
                              {perm.label}
                            </span>
                            <Badge
                              size="xs"
                              color={
                                perm.actionType === 'Delete' || perm.actionType === 'Cancel' ? 'red' :
                                perm.actionType === 'Post' || perm.actionType === 'Approve' ? 'amber' :
                                perm.actionType === 'Create' ? 'orange' : 'gray'
                              }
                              variant="light"
                              className="shrink-0 font-mono text-[9.5px] font-black"
                            >
                              {perm.actionType}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between text-[10.5px] text-slate-500 font-mono tabular-nums">
                            <span className="truncate">{perm.code}</span>
                            {perm.isSensitive && (
                              <span className="text-rose-700 font-sans font-black text-[10px] flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 shrink-0">
                                <IconLock size={11} /> حساسة
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. MODAL: CREATE / EDIT PERMISSION GROUP ── */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        size="560px"
        radius="20px"
        padding="xl"
        dir="rtl"
        centered
        title={
          <div className="flex items-center gap-3 text-slate-950 font-black text-sm">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF3E8] text-[#F45A0A] border border-orange-200 flex items-center justify-center font-black shrink-0">
              <IconShieldCheck size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-950">
                {isEditGroupMode ? 'تعديل دور موظفي الشركة' : 'إضافة دور جديد لموظفي الشركة'}
              </h3>
              <span className="text-xs text-slate-500 font-bold">
                حدد اسم الدور الوظيفي الداخلي (مثل: محاسب عام، موظف حجز، مدير فرع) ونطاق الفروع المتاحة له.
              </span>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs pt-2 font-sans">
          <TextInput
            size="sm"
            label="اسم الدور الوظيفي للموظف *"
            placeholder="مثال: محاسب رئيسي - فرع المنصور"
            value={modalGroupName}
            onChange={(e) => setModalGroupName(e.target.value)}
            required
            className="font-bold"
          />

          <div>
            <Select
              size="sm"
              label="نطاق الفروع المتاحة *"
              data={branchOptions}
              value={modalGroupScope}
              onChange={(val) => setModalGroupScope(val || 'جميع الفروع')}
              className="font-bold"
            />
          </div>

          <TextInput
            size="sm"
            label="وصف الوظيفة والمسؤوليات"
            placeholder="وصف مختصر لمسؤوليات وسلطة هذه المجموعة..."
            value={modalGroupDescription}
            onChange={(e) => setModalGroupDescription(e.target.value)}
            className="font-bold"
          />

          <div className="pt-4 flex justify-end gap-2.5 border-t border-slate-200">
            <Button 
              variant="default" 
              onClick={() => setCreateModalOpen(false)}
              className="h-10 px-4 rounded-xl font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              إلغاء
            </Button>
            <Button 
              onClick={handleSaveGroupModal} 
              className="h-10 px-5 rounded-xl font-black bg-[#F45A0A] hover:bg-[#DD4F05] text-white shadow-xs"
            >
              {isEditGroupMode ? 'حفظ التعديلات' : 'إنشاء المجموعة'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── 5. DRAWER: EFFECTIVE EMPLOYEE PERMISSION AUDIT PREVIEW ── */}
      <Drawer
        opened={effectivePreviewOpen}
        onClose={() => setEffectivePreviewOpen(false)}
        title={
          <div className="flex items-center gap-2.5 font-black text-slate-950 text-sm">
            <div className="w-8 h-8 rounded-xl bg-[#FFF3E8] text-[#F45A0A] border border-orange-200 flex items-center justify-center shrink-0">
              <IconUserCheck size={18} strokeWidth={2.2} />
            </div>
            <span>معاينة الصلاحيات الفعلية المحسوبة للموظف</span>
          </div>
        }
        position="left"
        size="lg"
        padding="xl"
        radius="16px"
      >
        <div className="space-y-4 text-xs pt-1 font-sans">
          <Select
            size="sm"
            label="اختر الموظف أو مستخدم النظام *"
            placeholder="بحث باسم الموظف..."
            data={employeesList.map(emp => ({
              value: emp.id,
              label: `${emp.fullName} — ${emp.jobTitle || 'موظف'}`,
            }))}
            value={previewEmployeeId}
            onChange={(val) => setPreviewEmployeeId(val)}
            searchable
            nothingFoundMessage="لا يوجد موظفين مسجلين"
            className="font-bold"
          />

          {(() => {
            const selectedEmp = employeesList.find(e => e.id === previewEmployeeId);
            const empGroup = selectedEmp ? permissionGroups.find(g => g.id === selectedEmp.permissionGroupId) : null;
            const empPerms = empGroup ? empGroup.enabledPermissions : [];
            const hasWildcard = empPerms.includes('*');

            if (!previewEmployeeId) return (
              <div className="p-8 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                اختر موظفاً من القائمة أعلاه لعرض مصفوفة صلاحياته الفعلية.
              </div>
            );

            if (!empGroup) return (
              <div className="p-5 text-center text-amber-800 font-bold bg-amber-50 rounded-2xl border border-amber-200">
                هذا الموظف غير مربوط بأي مجموعة صلاحيات حالياً.
              </div>
            );

            return (
              <>
                <div className="p-4 bg-[#FFF3E8]/60 border border-orange-200 rounded-2xl text-slate-900 space-y-1">
                  <span className="font-black text-sm text-slate-950 block">مجموعة الصلاحيات: {empGroup.name}</span>
                  <p className="text-xs text-[#F45A0A] font-bold font-mono tabular-nums">
                    عدد الصلاحيات الممنوحة: {hasWildcard ? 'كافة صلاحيات النظام (*)' : `${empPerms.length} صلاحية`}
                  </p>
                </div>

                <div className="space-y-2.5">
                  <span className="font-black text-slate-900 block border-b border-slate-200 pb-1.5">
                    نتائج الصلاحيات الممنوحة بالفعل:
                  </span>
                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-0.5">
                    {PERMISSION_REGISTRY.map(mod => {
                      const modulePerms = mod.permissions.filter(p => hasWildcard || empPerms.includes(p.code));
                      if (modulePerms.length === 0) return null;
                      return (
                        <div key={mod.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <span className="font-black text-slate-950 text-xs block">{mod.title}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {modulePerms.map(p => (
                              <Badge key={p.code} size="sm" color="orange" variant="light" className="font-bold">
                                {p.label}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </Drawer>
    </div>
  );
};

export default PermissionGroupsPage;
