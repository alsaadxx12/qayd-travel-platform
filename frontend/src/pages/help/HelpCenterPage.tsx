import React, { useState } from 'react';
import {
  Badge,
  Button,
  TextInput,
  Select,
  Modal,
  Skeleton,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconLifebuoy,
  IconBug,
  IconBulb,
  IconHelpCircle,
  IconSearch,
  IconCheck,
  IconEye,
  IconPhoto,
  IconRefresh,
  IconPlus,
  IconClock,
  IconCircleCheck,
  IconMessageReport,
  IconSparkles,
  IconBuildingStore,
  IconFlame,
  IconAlertTriangle,
  IconCircleDot,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { feedbackApi, SystemFeedback } from '../../api/feedback';

export const HelpCenterPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedTicket, setSelectedTicket] = useState<SystemFeedback | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Fetch current user's tickets with auto refetch
  const {
    data: myTickets = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['my-support-tickets'],
    queryFn: feedbackApi.getMyFeedbacks,
    refetchInterval: 10000,
  });

  const handleOpenSideDrawer = () => {
    window.dispatchEvent(new CustomEvent('open-feedback-drawer'));
  };

  const filteredTickets = myTickets.filter((t) => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      return (
        t.title.toLowerCase().includes(s) ||
        t.description.toLowerCase().includes(s) ||
        (t.adminReply && t.adminReply.toLowerCase().includes(s))
      );
    }
    return true;
  });

  const openCount = myTickets.filter((t) => t.status === 'OPEN').length;
  const inProgressCount = myTickets.filter((t) => t.status === 'IN_PROGRESS').length;
  const resolvedCount = myTickets.filter((t) => t.status === 'RESOLVED').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <Badge size="sm" color="red" variant="light" className="font-black rounded-lg text-[10.5px]">
            🔴 بانتظار المعالجة
          </Badge>
        );
      case 'IN_PROGRESS':
        return (
          <Badge size="sm" color="amber" variant="light" className="font-black rounded-lg text-[10.5px]">
            🟡 قيد المراجعة
          </Badge>
        );
      case 'RESOLVED':
        return (
          <Badge size="sm" color="emerald" variant="filled" className="font-black rounded-lg text-[10.5px] shadow-xs">
            🟢 تم الحل بنجاح ✓
          </Badge>
        );
      case 'CLOSED':
        return (
          <Badge size="sm" color="gray" variant="light" className="font-bold rounded-lg text-[10.5px]">
            مغلق
          </Badge>
        );
      default:
        return <Badge size="sm" color="blue" className="rounded-lg">{status}</Badge>;
    }
  };

  const getTypeBadge = (t: string) => {
    switch (t) {
      case 'BUG':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 font-black text-xs">
            <IconBug size={13} /> مشكلة تقنية
          </span>
        );
      case 'FEEDBACK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-black text-xs">
            <IconBulb size={13} /> اقتراح
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-black text-xs">
            <IconHelpCircle size={13} /> استفسار
          </span>
        );
    }
  };

  const getSeverityBadge = (s: string) => {
    switch (s) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 text-red-900 border border-red-300 font-black text-[11px]">
            <IconFlame size={12} /> حرج
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 text-orange-950 border border-orange-300 font-black text-[11px]">
            <IconAlertTriangle size={12} /> مرتفع
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-black text-[11px]">
            <IconCircleDot size={12} /> متوسط
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-black text-[11px]">
            منخفض
          </span>
        );
    }
  };

  return (
    <div
      className="space-y-4 p-4 max-w-6xl mx-auto"
      style={{
        fontFamily: "'Cairo', 'IBM Plex Sans Arabic', 'Tajawal', sans-serif",
      }}
      dir="rtl"
    >
      {/* ── 1. Page Header matching system theme ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center font-black shadow-md shadow-orange-500/20">
            <IconLifebuoy size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-base text-slate-900 leading-tight">مركز المساعدة والدعم الفني</h1>
              <Badge size="sm" color="orange" variant="light" className="font-mono font-black rounded-md">
                {myTickets.length} بلاغ
              </Badge>
            </div>
            <p className="text-xs font-bold text-slate-500 mt-0.5">
              متابعة حالة بلاغاتك وملاحظاتك المباشرة وردود فريق الدعم الفني فور معالجة الطلب
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Tooltip label="تحديث حالة البلاغات" withArrow>
            <ActionIcon
              variant="default"
              size="md"
              radius="md"
              loading={isRefetching}
              onClick={() => refetch()}
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>

          <Button
            size="xs"
            color="orange"
            variant="filled"
            radius="md"
            leftSection={<IconPlus size={15} />}
            onClick={handleOpenSideDrawer}
            className="bg-orange-500 hover:bg-orange-600 font-black h-9 px-4 text-white shadow-xs cursor-pointer"
          >
            إرسال بلاغ أو ملاحظة جديدة
          </Button>
        </div>
      </div>

      {/* ── 2. Live Status KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-black block">إجمالي البلاغات المرسلة</span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">{myTickets.length}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black">
            <IconMessageReport size={20} />
          </div>
        </div>

        <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-800 font-black block">قيد المراجعة والمعالجة</span>
            <span className="text-2xl font-black text-amber-950 font-mono mt-0.5 block">{openCount + inProgressCount}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-black">
            <IconClock size={20} />
          </div>
        </div>

        <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-800 font-black block">تم الحل والإشعار بنجاح</span>
            <span className="text-2xl font-black text-emerald-950 font-mono mt-0.5 block">{resolvedCount}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
            <IconCircleCheck size={20} />
          </div>
        </div>
      </div>

      {/* ── 3. Filters Bar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
        <TextInput
          placeholder="بحث في عنوان المشكلة أو التفاصيل..."
          leftSection={<IconSearch size={14} className="text-slate-400" />}
          size="xs"
          radius="md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          styles={{ input: { fontWeight: 700, fontSize: 11 } }}
          className="sm:col-span-2"
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
            { value: 'RESOLVED', label: '🟢 تم الحل بنجاح' },
          ]}
          styles={{ input: { fontWeight: 700, fontSize: 11 } }}
        />
      </div>

      {/* ── 4. Tickets Feed / Cards ── */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
              <Skeleton height={20} width={200} radius="md" />
              <Skeleton height={14} width="80%" radius="md" />
            </div>
          ))
        ) : filteredTickets.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-xl border border-slate-200/90 p-6 space-y-3 shadow-2xs">
            <div className="w-13 h-13 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <IconCheck size={26} stroke={3} />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-sm text-slate-900">لا توجد بلاغات حالية</h3>
              <p className="text-xs font-bold text-slate-500">
                إذا واجهت أي مشكلة أثناء العمل، يمكنك إرسال بلاغ فوري وسيتابعه فريق الدعم الفني مباشرة.
              </p>
            </div>
            <Button
              size="xs"
              color="orange"
              variant="light"
              radius="md"
              onClick={handleOpenSideDrawer}
              className="font-black"
            >
              إرسال بلاغ الآن
            </Button>
          </div>
        ) : (
          filteredTickets.map((t) => (
            <div
              key={t.id}
              className={`p-4 transition-all shadow-2xs rounded-xl border bg-white ${
                t.status === 'RESOLVED'
                  ? 'border-emerald-300 ring-1 ring-emerald-500/10'
                  : t.status === 'IN_PROGRESS'
                  ? 'border-amber-300 ring-1 ring-amber-500/10'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-2.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getTypeBadge(t.type)}
                    {getSeverityBadge(t.severity)}
                    <span className="text-slate-300">•</span>
                    <span className="text-[11px] font-mono text-slate-500 font-bold">
                      {new Date(t.createdAt).toLocaleDateString('ar-IQ')}
                    </span>
                    <span className="text-slate-300">•</span>
                    {getStatusBadge(t.status)}
                  </div>

                  <h3 className="font-black text-sm text-slate-900 leading-snug">
                    {t.title}
                  </h3>

                  <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/80 text-xs text-slate-900 leading-relaxed font-sans whitespace-pre-wrap font-bold">
                    {t.description}
                  </div>

                  {t.screenshotUrl && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTicket(t);
                          setDetailsModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[11px] font-black text-orange-700 cursor-pointer transition-colors"
                      >
                        <IconPhoto size={14} />
                        <span>معاينة لقطة الشاشة المرفقة</span>
                      </button>
                    </div>
                  )}

                  {/* Support Reply Box (When Resolved) */}
                  {t.adminReply && (
                    <div className="mt-3 p-3.5 bg-emerald-50/90 rounded-xl border border-emerald-300/80 space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-emerald-800 font-black text-xs">
                          <IconSparkles size={15} />
                          <span>رد فريق الدعم الفني المباشر:</span>
                        </div>
                        {t.resolvedAt && (
                          <span className="text-[10px] font-mono font-bold text-emerald-700">
                            {new Date(t.resolvedAt).toLocaleString('ar-IQ')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-emerald-950 font-black leading-relaxed font-sans pt-0.5">
                        {t.adminReply}
                      </p>
                    </div>
                  )}
                </div>

                <div className="shrink-0 self-end sm:self-auto">
                  <Button
                    size="xs"
                    variant="default"
                    radius="md"
                    leftSection={<IconEye size={14} />}
                    onClick={() => {
                      setSelectedTicket(t);
                      setDetailsModalOpen(true);
                    }}
                    className="font-black border-slate-200 text-xs hover:bg-slate-50"
                  >
                    تفاصيل البلاغ
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── MODAL: TICKET FULL DETAILS ── */}
      <Modal
        opened={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={
          <div className="flex items-center gap-2 font-black text-sm text-slate-900">
            <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
              <IconLifebuoy size={17} />
            </div>
            <span>تفاصيل تذكرة الدعم الفني</span>
          </div>
        }
        size="lg"
        radius="xl"
        dir="rtl"
        centered
      >
        {selectedTicket && (
          <div className="space-y-3.5 text-xs font-sans">
            {/* Header info */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getTypeBadge(selectedTicket.type)}
                  {getSeverityBadge(selectedTicket.severity)}
                </div>
                <div>{getStatusBadge(selectedTicket.status)}</div>
              </div>

              <h4 className="font-black text-sm text-slate-900 pt-1 leading-snug">
                {selectedTicket.title}
              </h4>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] font-black text-slate-600 mb-1">تفاصيل المشكلة والوصف:</label>
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-slate-900 leading-relaxed font-bold whitespace-pre-wrap shadow-2xs">
                {selectedTicket.description}
              </div>
            </div>

            {/* Attached Screenshot */}
            {selectedTicket.screenshotUrl && (
              <div>
                <label className="block text-[11px] font-black text-slate-600 mb-1">لقطة الشاشة المرفقة:</label>
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-center overflow-hidden">
                  <img
                    src={selectedTicket.screenshotUrl}
                    alt="Screenshot"
                    className="max-h-72 w-auto mx-auto rounded-lg shadow-xs border border-slate-200 object-contain"
                  />
                </div>
              </div>
            )}

            {/* Support Reply Box */}
            {selectedTicket.adminReply && (
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-300 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-800 font-black text-xs">
                  <IconCheck size={16} stroke={3} />
                  <span>رد فريق الدعم الفني:</span>
                </div>
                <p className="text-xs text-emerald-950 font-black leading-relaxed font-sans">
                  {selectedTicket.adminReply}
                </p>
                {selectedTicket.resolvedAt && (
                  <span className="text-[10px] text-emerald-700 font-mono font-bold block pt-1">
                    تاريخ المعالجة: {new Date(selectedTicket.resolvedAt).toLocaleString('ar-IQ')}
                  </span>
                )}
              </div>
            )}

            {/* Footer meta */}
            <div className="flex items-center justify-between text-[10.5px] text-slate-500 font-mono font-bold pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1 text-slate-800 font-black">
                <IconBuildingStore size={13} className="text-orange-600" />
                <span>{selectedTicket.tenantName || 'علاء الدين'}</span>
              </div>
              <span>{new Date(selectedTicket.createdAt).toLocaleString('ar-IQ')}</span>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="xs" variant="default" radius="md" onClick={() => setDetailsModalOpen(false)}>
                إغلاق
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default HelpCenterPage;
