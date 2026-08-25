import React, { useState } from 'react';
import {
  Card,
  Table,
  Badge,
  Button,
  TextInput,
  Select,
  Modal,
  Textarea,
  Group,
  Skeleton,
  ActionIcon,
  Tooltip,
  Alert,
} from '@mantine/core';
import {
  IconMessageReport,
  IconBug,
  IconBulb,
  IconHelpCircle,
  IconSearch,
  IconCheck,
  IconTrash,
  IconEye,
  IconPhoto,
  IconArrowRight,
  IconSend,
  IconPhone,
  IconMail,
  IconBuildingStore,
  IconRefresh,
  IconAlertTriangle,
  IconSparkles,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feedbackApi, SystemFeedback } from '../../api/feedback';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';

export const FeedbackManagementPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [selectedFeedback, setSelectedFeedback] = useState<SystemFeedback | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [adminReply, setAdminReply] = useState('');

  const {
    data: feedbacks = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['admin-feedbacks', statusFilter, typeFilter, severityFilter, searchTerm],
    queryFn: () =>
      feedbackApi.getAllFeedbacks({
        status: statusFilter,
        type: typeFilter,
        severity: severityFilter,
        search: searchTerm,
      }),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) =>
      feedbackApi.resolveFeedback(id, { adminReply: reply, status: 'RESOLVED' }),
    onSuccess: () => {
      showSuccessNotification('تم حل المشكلة بنجاح', 'تم إرسال إشعار فوري في صندوق إشعارات المشترك لإعلامه بالحل.');
      queryClient.invalidateQueries({ queryKey: ['admin-feedbacks'] });
      setResolveModalOpen(false);
      setDetailsModalOpen(false);
      setAdminReply('');
    },
    onError: (err: any) => {
      showErrorNotification('فشل تحديث الحالة', err?.message || 'تعذر معالجة البلاغ');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => feedbackApi.deleteFeedback(id),
    onSuccess: () => {
      showSuccessNotification('تم الحذف', 'تم حذف سجل البلاغ بنجاح');
      queryClient.invalidateQueries({ queryKey: ['admin-feedbacks'] });
    },
    onError: (err: any) => {
      showErrorNotification('فشل الحذف', err?.message || 'تعذر حذف البلاغ');
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <Badge size="xs" color="red" variant="light" className="font-bold">بانتظار المعالجة</Badge>;
      case 'IN_PROGRESS':
        return <Badge size="xs" color="amber" variant="light" className="font-bold">قيد المراجعة</Badge>;
      case 'RESOLVED':
        return <Badge size="xs" color="emerald" variant="filled" className="font-bold">تم الحل ✓</Badge>;
      case 'CLOSED':
        return <Badge size="xs" color="gray" variant="light" className="font-bold">مغلق</Badge>;
      default:
        return <Badge size="xs" color="blue">{status}</Badge>;
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return <Badge size="xs" color="red" variant="filled">🔴 حرج جداً</Badge>;
      case 'HIGH':
        return <Badge size="xs" color="orange" variant="light">🟠 مرتفع</Badge>;
      case 'MEDIUM':
        return <Badge size="xs" color="yellow" variant="light">🟡 متوسط</Badge>;
      default:
        return <Badge size="xs" color="teal" variant="light">🟢 منخفض</Badge>;
    }
  };

  const getTypeBadge = (t: string) => {
    switch (t) {
      case 'BUG':
        return (
          <span className="flex items-center gap-1 text-red-600 font-bold">
            <IconBug size={14} /> مشكلة تقنية
          </span>
        );
      case 'FEEDBACK':
        return (
          <span className="flex items-center gap-1 text-amber-600 font-bold">
            <IconBulb size={14} /> اقتراح / فكرة
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-blue-600 font-bold">
            <IconHelpCircle size={14} /> استفسار عام
          </span>
        );
    }
  };

  const openResolveModal = (fb: SystemFeedback) => {
    setSelectedFeedback(fb);
    setAdminReply(fb.adminReply || 'تم حل المشكلة وتطبيق التحديثات اللازمة على نظامكم بنجاح.');
    setResolveModalOpen(true);
  };

  const openDetailsModal = (fb: SystemFeedback) => {
    setSelectedFeedback(fb);
    setDetailsModalOpen(true);
  };

  const openCount = feedbacks.filter((f) => f.status === 'OPEN').length;
  const resolvedCount = feedbacks.filter((f) => f.status === 'RESOLVED').length;

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto" dir="rtl">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold shadow-2xs">
            <IconMessageReport size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-base text-slate-900 leading-tight">مركز البلاغات والدعم الفني</h1>
              <Badge size="sm" color="orange" variant="filled" className="font-mono font-black">
                {feedbacks.length} بلاغ
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              استقبال ومتابعة مشاكل وملاحظات المستخدمين والرد عليها مع إشعار المستخدم فور الحل
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Tooltip label="تحديث البيانات" withArrow>
            <ActionIcon
              variant="default"
              size="md"
              radius="md"
              loading={isRefetching}
              onClick={() => refetch()}
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {/* ── KPI Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block">إجمالي البلاغات الواردة</span>
            <span className="text-xl font-black text-slate-900 font-mono mt-0.5 block">{feedbacks.length}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <IconMessageReport size={18} />
          </div>
        </div>

        <div className="p-3.5 bg-red-50/70 rounded-2xl border border-red-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-red-700 font-bold block">بانتظار المعالجة والحل</span>
            <span className="text-xl font-black text-red-800 font-mono mt-0.5 block">{openCount}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
            <IconAlertTriangle size={18} />
          </div>
        </div>

        <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-700 font-bold block">تم الحل والإشعار بنجاح</span>
            <span className="text-xl font-black text-emerald-800 font-mono mt-0.5 block">{resolvedCount}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <IconCheck size={18} stroke={3} />
          </div>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <TextInput
          placeholder="بحث بالعنوان، المستخدم، المؤسسة..."
          leftSection={<IconSearch size={14} className="text-slate-400" />}
          size="xs"
          radius="md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <Select
          size="xs"
          radius="md"
          value={statusFilter}
          onChange={(val) => setStatusFilter(val || 'ALL')}
          data={[
            { value: 'ALL', label: 'كافة الحالات' },
            { value: 'OPEN', label: '🔴 بانتظار المعالجة' },
            { value: 'IN_PROGRESS', label: '🟡 قيد المراجعة' },
            { value: 'RESOLVED', label: '🟢 تم الحل' },
          ]}
        />

        <Select
          size="xs"
          radius="md"
          value={typeFilter}
          onChange={(val) => setTypeFilter(val || 'ALL')}
          data={[
            { value: 'ALL', label: 'كافة الأنواع' },
            { value: 'BUG', label: '🐞 مشكلة تقنية' },
            { value: 'FEEDBACK', label: '💡 اقتراح / فكرة' },
            { value: 'INQUIRY', label: '❓ استفسار عام' },
          ]}
        />

        <Select
          size="xs"
          radius="md"
          value={severityFilter}
          onChange={(val) => setSeverityFilter(val || 'ALL')}
          data={[
            { value: 'ALL', label: 'كافة المستويات' },
            { value: 'CRITICAL', label: '🔴 حرج' },
            { value: 'HIGH', label: '🟠 مرتفع' },
            { value: 'MEDIUM', label: '🟡 متوسط' },
            { value: 'LOW', label: '🟢 منخفض' },
          ]}
        />
      </div>

      {/* ── Table Card ── */}
      <Card className="rounded-2xl border border-slate-200 shadow-xs p-0 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <Table className="text-xs text-right border-collapse">
            <Table.Thead className="bg-slate-50/90 border-b border-slate-200">
              <Table.Tr>
                <Table.Th className="p-3 text-slate-800 font-bold">النوع والخطورة</Table.Th>
                <Table.Th className="p-3 text-slate-800 font-bold">الموضوع والتفاصيل</Table.Th>
                <Table.Th className="p-3 text-slate-800 font-bold">المؤسسة والمُرسل</Table.Th>
                <Table.Th className="p-3 text-slate-800 font-bold">التاريخ</Table.Th>
                <Table.Th className="p-3 text-slate-800 font-bold">الحالة</Table.Th>
                <Table.Th className="p-3 text-center text-slate-800 font-bold">الإجراءات</Table.Th>
              </Table.Tr>
            </Table.Thead>

            <Table.Tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <Table.Tr key={idx}>
                    <Table.Td className="p-3"><Skeleton height={20} width={90} /></Table.Td>
                    <Table.Td className="p-3"><Skeleton height={20} width={200} /></Table.Td>
                    <Table.Td className="p-3"><Skeleton height={20} width={120} /></Table.Td>
                    <Table.Td className="p-3"><Skeleton height={20} width={80} /></Table.Td>
                    <Table.Td className="p-3"><Skeleton height={20} width={70} /></Table.Td>
                    <Table.Td className="p-3"><Skeleton height={20} width={80} mx="auto" /></Table.Td>
                  </Table.Tr>
                ))
              ) : feedbacks.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="space-y-1.5">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <IconCheck size={24} stroke={2.5} />
                      </div>
                      <p className="font-bold text-xs text-slate-700">لا توجد بلاغات أو مشاكل مطابقة</p>
                      <p className="text-[11px] text-slate-400">كافة الأنظمة تعمل بكفاءة ولم يتم استلام بلاغات جديدة</p>
                    </div>
                  </Table.Td>
                </Table.Tr>
              ) : (
                feedbacks.map((item) => (
                  <Table.Tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Type & Severity */}
                    <Table.Td className="p-3">
                      <div className="space-y-1">
                        <div>{getTypeBadge(item.type)}</div>
                        <div>{getSeverityBadge(item.severity)}</div>
                      </div>
                    </Table.Td>

                    {/* Title & Description */}
                    <Table.Td className="p-3 max-w-[280px]">
                      <div className="space-y-0.5">
                        <span className="font-black text-slate-900 block leading-tight truncate">
                          {item.title}
                        </span>
                        <p className="text-[11px] text-slate-500 truncate leading-relaxed">
                          {item.description}
                        </p>
                        {item.screenshotUrl && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-orange-600 font-bold mt-0.5">
                            <IconPhoto size={12} /> مرفق لقطة شاشة
                          </span>
                        )}
                      </div>
                    </Table.Td>

                    {/* Tenant & User */}
                    <Table.Td className="p-3">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-900 block truncate">
                          {item.tenantName || item.tenant?.name || 'مؤسسة مستقلة'}
                        </span>
                        <span className="text-[10.5px] text-slate-500 block truncate">
                          {item.userName} {item.userEmail ? `(${item.userEmail})` : ''}
                        </span>
                      </div>
                    </Table.Td>

                    {/* Date */}
                    <Table.Td className="p-3 text-[11px] text-slate-500 font-mono">
                      {new Date(item.createdAt).toLocaleDateString('ar-IQ')}
                    </Table.Td>

                    {/* Status */}
                    <Table.Td className="p-3">
                      {getStatusBadge(item.status)}
                    </Table.Td>

                    {/* Actions */}
                    <Table.Td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        <Tooltip label="معاينة التفاصيل الكاملة" withArrow>
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="blue"
                            onClick={() => openDetailsModal(item)}
                          >
                            <IconEye size={14} />
                          </ActionIcon>
                        </Tooltip>

                        {item.status !== 'RESOLVED' && (
                          <Tooltip label="حل المشكلة وإشعار المستخدم" withArrow>
                            <Button
                              size="compact-xs"
                              color="teal"
                              variant="light"
                              leftSection={<IconCheck size={12} stroke={3} />}
                              onClick={() => openResolveModal(item)}
                              className="font-bold rounded-lg text-[10.5px]"
                            >
                              حل وإشعار
                            </Button>
                          </Tooltip>
                        )}

                        <Tooltip label="حذف البلاغ" withArrow>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            onClick={() => deleteMutation.mutate(item.id)}
                            loading={deleteMutation.isPending}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </div>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </div>
      </Card>

      {/* ── MODAL 1: TICKET DETAILS ── */}
      <Modal
        opened={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={
          <div className="flex items-center gap-2 font-black text-sm text-slate-900">
            <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
              <IconMessageReport size={17} />
            </div>
            <span>تفاصيل البلاغ والملاحظة</span>
          </div>
        }
        size="lg"
        radius="xl"
        dir="rtl"
        centered
      >
        {selectedFeedback && (
          <div className="space-y-4 text-xs font-sans">
            {/* Header info card */}
            <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getTypeBadge(selectedFeedback.type)}
                  {getSeverityBadge(selectedFeedback.severity)}
                </div>
                <div>{getStatusBadge(selectedFeedback.status)}</div>
              </div>

              <h4 className="font-black text-sm text-slate-900 pt-1 leading-snug">
                {selectedFeedback.title}
              </h4>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] font-black text-slate-600 mb-1.5">تفاصيل المشكلة والوصف:</label>
              <div className="p-3.5 bg-white rounded-2xl border border-slate-200 text-slate-900 leading-relaxed font-bold whitespace-pre-wrap shadow-2xs">
                {selectedFeedback.description}
              </div>
            </div>

            {/* Attached Screenshot */}
            {selectedFeedback.screenshotUrl && (
              <div>
                <label className="block text-[11px] font-black text-slate-600 mb-1.5">لقطة الشاشة المرفقة:</label>
                <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200 text-center overflow-hidden">
                  <img
                    src={selectedFeedback.screenshotUrl}
                    alt="Screenshot"
                    className="max-h-72 w-auto mx-auto rounded-xl shadow-xs border border-slate-200 object-contain"
                  />
                </div>
              </div>
            )}

            {/* Sender & Company Details Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-[11px]">
              {/* Sender info */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <span className="text-slate-400 font-black text-[10px] block">بيانات المُرسل:</span>
                <span className="font-black text-slate-900 block text-xs">{selectedFeedback.userName}</span>
                {selectedFeedback.userEmail && (
                  <span className="text-slate-600 block font-mono text-[10.5px] font-bold truncate">
                    {selectedFeedback.userEmail}
                  </span>
                )}
                {selectedFeedback.userPhone && (
                  <span className="text-slate-600 block font-mono text-[10.5px] font-bold" dir="ltr">
                    {selectedFeedback.userPhone}
                  </span>
                )}
              </div>

              {/* Company & Page info */}
              <div className="p-3 bg-orange-50/50 rounded-2xl border border-orange-200/70 space-y-1.5">
                <span className="text-orange-600 font-black text-[10px] block flex items-center gap-1">
                  <IconBuildingStore size={13} />
                  <span>اسم الشركة / المؤسسة:</span>
                </span>
                <span className="font-black text-orange-950 block text-xs">
                  {selectedFeedback.tenantName || 'شركة الروضتين للسياحة والسفر'}
                </span>
                {selectedFeedback.pageUrl && (
                  <div className="pt-0.5">
                    <span className="text-slate-400 font-black text-[9.5px] block">الصفحة:</span>
                    <span className="text-slate-700 block truncate font-mono text-[10px] font-bold" title={selectedFeedback.pageUrl}>
                      {selectedFeedback.pageUrl}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* If already resolved */}
            {selectedFeedback.adminReply && (
              <Alert color="teal" radius="lg" title="رد الدعم الفني المرسل للمستخدم" icon={<IconCheck size={16} />}>
                <p className="text-xs text-slate-800 leading-relaxed font-bold">{selectedFeedback.adminReply}</p>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button size="xs" variant="default" radius="lg" onClick={() => setDetailsModalOpen(false)}>إغلاق</Button>
              {selectedFeedback.status !== 'RESOLVED' && (
                <Button
                  size="xs"
                  color="orange"
                  variant="filled"
                  radius="lg"
                  rightSection={<IconCheck size={14} />}
                  onClick={() => openResolveModal(selectedFeedback)}
                  className="bg-orange-500 hover:bg-orange-600 font-black text-white shadow-xs"
                >
                  معالجة وحل البلاغ الآن
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL 2: RESOLVE & NOTIFY USER ── */}
      <Modal
        opened={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        title={
          <div className="flex items-center gap-2 font-black text-sm text-emerald-700">
            <IconCheck size={18} stroke={3} />
            <span>حل المشكلة وإرسال إشعار للمستخدم</span>
          </div>
        }
        radius="lg"
        dir="rtl"
        centered
      >
        {selectedFeedback && (
          <div className="space-y-3.5 text-xs">
            <Alert color="emerald" variant="light" title="إشعار فوري تلقائي" icon={<IconSparkles size={16} />}>
              عند تأكيد الحل، سيتم إرسال إشعار مباشر في صندوق إشعارات المستخدم <strong>({selectedFeedback.userName})</strong> لإبلاغه بأن المشكلة تم حلها.
            </Alert>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                رسالة الدعم الفني وتفاصيل الحل للمستخدم:
              </label>
              <Textarea
                size="xs"
                radius="md"
                minRows={3}
                maxRows={6}
                value={adminReply}
                onChange={(e) => setAdminReply(e.target.value)}
                placeholder="اكتب توضيحاً للحل أو رسالة شكر للمستخدم..."
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button size="xs" variant="default" onClick={() => setResolveModalOpen(false)}>إلغاء</Button>
              <Button
                size="xs"
                color="teal"
                variant="filled"
                loading={resolveMutation.isPending}
                rightSection={<IconSend size={14} />}
                onClick={() =>
                  resolveMutation.mutate({
                    id: selectedFeedback.id,
                    reply: adminReply.trim(),
                  })
                }
                className="bg-emerald-600 hover:bg-emerald-700 font-bold text-white"
              >
                تأكيد الحل وإرسال الإشعار
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FeedbackManagementPage;
