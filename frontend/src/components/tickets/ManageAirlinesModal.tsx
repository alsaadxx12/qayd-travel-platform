import React, { useState } from 'react';
import { Modal, TextInput, Button, Loader, ActionIcon, Tooltip, Badge } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Search, Plane, Check } from 'lucide-react';
import { airlinesApi, AirlineItem } from '../../api/airlines';
import { useLanguageStore } from '../../store/useLanguageStore';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';

interface ManageAirlinesModalProps {
  opened: boolean;
  onClose: () => void;
  onSelectAirline?: (airlineName: string, airlineItem?: AirlineItem) => void;
}

export const ManageAirlinesModal: React.FC<ManageAirlinesModalProps> = ({
  opened,
  onClose,
  onSelectAirline,
}) => {
  const { language, direction } = useLanguageStore();
  const isAr = language === 'ar';
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [code, setCode] = useState('');
  const [logo, setLogo] = useState('');

  // 1. Fetch Airlines
  const { data: airlines = [], isLoading } = useQuery({
    queryKey: ['airlines-list'],
    queryFn: () => airlinesApi.getAll(),
    enabled: opened,
  });

  const airlinesList: AirlineItem[] = Array.isArray(airlines)
    ? airlines
    : (airlines as any)?.data || [];

  // Filtered List
  const filteredAirlines = airlinesList.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (a.nameAr && a.nameAr.toLowerCase().includes(q)) ||
      (a.nameEn && a.nameEn.toLowerCase().includes(q)) ||
      (a.code && a.code.toLowerCase().includes(q))
    );
  });

  // 2. Create Mutation
  const createMutation = useMutation({
    mutationFn: (data: { nameAr: string; nameEn?: string; code?: string; logo?: string }) =>
      airlinesApi.create(data),
    onSuccess: (created) => {
      queryClient.setQueryData(['airlines-list'], (current: any) => {
        const currentList = Array.isArray(current) ? current : current?.data;
        const nextList = [created, ...(Array.isArray(currentList) ? currentList.filter((item: AirlineItem) => item.id !== created.id) : [])];
        return Array.isArray(current) || !current ? nextList : { ...current, data: nextList };
      });
      queryClient.invalidateQueries({ queryKey: ['airlines-list'] });
      showSuccessNotification(
        isAr ? 'تمت الإضافة بنجاح' : 'Airline Created',
        isAr ? `تمت إضافة شركة ${created.nameAr} بنجاح` : `Airline ${created.nameAr} added successfully`,
      );
      // Reset form
      setNameAr('');
      setNameEn('');
      setCode('');
      setLogo('');
      if (onSelectAirline) {
        onSelectAirline(created.nameAr || created.code || '', created);
      }
      onClose();
    },
    onError: (err: any) => {
      showErrorNotification(
        isAr ? 'خطأ في الإضافة' : 'Error',
        err?.message || (isAr ? 'فشل إضافة شركة الطيران' : 'Failed to add airline'),
      );
    },
  });

  // 3. Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      airlinesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['airlines-list'] });
      showSuccessNotification(isAr ? 'تم التعديل' : 'Updated', isAr ? 'تم تحديث بيانات الشركة بنجاح' : 'Updated successfully');
      setEditingId(null);
      setNameAr('');
      setNameEn('');
      setCode('');
      setLogo('');
    },
    onError: (err: any) => {
      showErrorNotification(isAr ? 'خطأ' : 'Error', err?.message || 'Update failed');
    },
  });

  // 4. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => airlinesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['airlines-list'] });
      showSuccessNotification(isAr ? 'تم الحذف' : 'Deleted', isAr ? 'تم حذف شركة الطيران بنجاح' : 'Airline deleted');
    },
    onError: (err: any) => {
      showErrorNotification(isAr ? 'خطأ' : 'Error', err?.message || 'Delete failed');
    },
  });

  const handleStartEdit = (item: AirlineItem) => {
    setEditingId(item.id);
    setNameAr(item.nameAr || '');
    setNameEn(item.nameEn || '');
    setCode(item.code || '');
    setLogo(item.logo || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNameAr('');
    setNameEn('');
    setCode('');
    setLogo('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      showErrorNotification(isAr ? 'تنبيه' : 'Warning', isAr ? 'اسم شركة الطيران بالعربية مطلوب' : 'Arabic name is required');
      return;
    }

    const payload = {
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || undefined,
      code: code.trim().toUpperCase() || undefined,
      logo: logo.trim() || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 font-black text-sm text-slate-900" dir={direction}>
          <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#F45A0A] flex items-center justify-center border border-orange-100">
            <Plane size={16} />
          </div>
          <span>{isAr ? 'إدارة وإضافة شركات الطيران' : 'Manage & Add Airlines'}</span>
        </div>
      }
      size="lg"
      radius="lg"
      centered
    >
      <div className="space-y-4 text-xs font-sans select-none" dir={direction}>
        {/* 1. Add / Edit Airline Form */}
        <form onSubmit={handleSubmit} className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-[12px] flex items-center gap-1.5">
              <Plus size={14} className="text-[#F45A0A]" />
              {editingId ? (isAr ? 'تعديل بيانات شركة الطيران:' : 'Edit Airline:') : (isAr ? 'إضافة شركة طيران جديدة:' : 'Add New Airline:')}
            </span>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
              >
                {isAr ? 'إلغاء التعديل' : 'Cancel Edit'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <TextInput
              size="xs"
              label={isAr ? 'اسم الشركة (بالعربية) *' : 'Airline Name (Arabic) *'}
              placeholder="مثال: الخطوط الجوية العراقية أو آفا إيرلاينز"
              required
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              styles={{ input: { borderRadius: '8px' } }}
            />

            <TextInput
              size="xs"
              label={isAr ? 'اسم الشركة (بالإنجليزية)' : 'Airline Name (English)'}
              placeholder="e.g. Iraqi Airways or Ava Airlines"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              styles={{ input: { borderRadius: '8px' } }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <TextInput
              size="xs"
              label={isAr ? 'رمز الطيران (IATA Code)' : 'IATA Code'}
              placeholder="مثال: IA, QR, EK, 7K"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              styles={{ input: { borderRadius: '8px', fontFamily: 'monospace', fontWeight: 'bold' } }}
            />

            <TextInput
              size="xs"
              label={isAr ? 'رابط الشعار / Logo URL' : 'Logo Image URL'}
              placeholder="https://.../logo.png"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              styles={{ input: { borderRadius: '8px' } }}
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              size="xs"
              color="orange"
              loading={createMutation.isPending || updateMutation.isPending}
              className="bg-[#F45A0A] hover:bg-[#dd4f05] font-bold px-4 h-8 rounded-xl shadow-xs"
            >
              {editingId ? (isAr ? 'حفظ التعديل' : 'Save Changes') : (isAr ? 'إضافة وتحديد الشركة' : 'Add & Select')}
            </Button>
          </div>
        </form>

        {/* 2. Search & Airlines List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">
              {isAr ? 'شركات الطيران المسجلة في النظام:' : 'Registered Airlines:'} ({airlinesList.length})
            </span>
            <div className="w-56">
              <TextInput
                size="xs"
                placeholder={isAr ? 'بحث في شركات الطيران...' : 'Search airlines...'}
                leftSection={<Search size={13} className="text-slate-400" />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                styles={{ input: { borderRadius: '8px', height: '32px' } }}
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[260px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400">
                <Loader size="xs" color="orange" className="mx-auto" />
                <span className="block text-[11px] mt-2 font-bold">{isAr ? 'جاري التحميل...' : 'Loading...'}</span>
              </div>
            ) : filteredAirlines.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-bold">
                {isAr ? 'لا توجد نتائج مطابقة' : 'No matching airlines'}
              </div>
            ) : (
              <table className="w-full text-right border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] sticky top-0">
                  <tr>
                    <th className="p-2.5">شركة الطيران</th>
                    <th className="p-2.5 text-center">الرمز</th>
                    <th className="p-2.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAirlines.map((item) => (
                    <tr key={item.id} className="hover:bg-orange-50/40 transition-colors">
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          {item.logo ? (
                            <img src={item.logo} alt={item.nameAr} className="w-6 h-6 object-contain rounded shrink-0" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          ) : (
                            <div className="w-6 h-6 rounded bg-slate-100 text-slate-500 flex items-center justify-center font-bold font-mono text-[10px] shrink-0">
                              {item.code || '✈'}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">{item.nameAr}</span>
                            {item.nameEn && <span className="text-[10px] text-slate-400 font-mono block">{item.nameEn}</span>}
                          </div>
                        </div>
                      </td>

                      <td className="p-2.5 text-center font-mono font-bold text-slate-700">
                        {item.code ? (
                          <Badge size="xs" variant="light" color="orange" className="font-mono">
                            {item.code}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {onSelectAirline && (
                            <Tooltip label={isAr ? 'اختيار هذه الشركة للفاتورة' : 'Select for invoice'}>
                              <ActionIcon
                                size="sm"
                                variant="light"
                                color="teal"
                                onClick={() => {
                                  onSelectAirline(item.nameAr || item.code || '', item);
                                  onClose();
                                }}
                                className="cursor-pointer"
                              >
                                <Check size={13} />
                              </ActionIcon>
                            </Tooltip>
                          )}

                          <Tooltip label={isAr ? 'تعديل' : 'Edit'}>
                            <ActionIcon
                              size="sm"
                              variant="light"
                              color="blue"
                              onClick={() => handleStartEdit(item)}
                              className="cursor-pointer"
                            >
                              <Edit2 size={13} />
                            </ActionIcon>
                          </Tooltip>

                          <Tooltip label={isAr ? 'حذف' : 'Delete'}>
                            <ActionIcon
                              size="sm"
                              variant="light"
                              color="red"
                              onClick={() => {
                                if (window.confirm(isAr ? `هل أنت متأكد من حذف شركة ${item.nameAr}؟` : `Delete ${item.nameAr}?`)) {
                                  deleteMutation.mutate(item.id);
                                }
                              }}
                              className="cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </ActionIcon>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
