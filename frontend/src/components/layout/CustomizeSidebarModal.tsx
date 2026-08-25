import React, { useState } from 'react';
import { Modal, Button, Select, ActionIcon, Tooltip, Badge, Paper } from '@mantine/core';
import {
  IconArrowUp,
  IconArrowDown,
  IconArrowsExchange,
  IconRestore,
  IconCheck,
  IconSettings,
  IconFolder,
  IconFile,
} from '@tabler/icons-react';
import { showSuccessNotification } from '../../utils/notifications';

export interface NavItem {
  id: string;
  title: string;
  path: string;
  iconKey: string;
}

export interface NavSection {
  key: string;
  title: string;
  iconKey: string;
  items: NavItem[];
}

interface CustomizeSidebarModalProps {
  opened: boolean;
  onClose: () => void;
  sections: NavSection[];
  defaultSections: NavSection[];
  onSave: (newSections: NavSection[]) => void;
  iconMap: Record<string, any>;
}

export const CustomizeSidebarModal: React.FC<CustomizeSidebarModalProps> = ({
  opened,
  onClose,
  sections,
  defaultSections,
  onSave,
  iconMap,
}) => {
  const [draftSections, setDraftSections] = useState<NavSection[]>(() =>
    JSON.parse(JSON.stringify(sections))
  );

  // Sync with prop when modal opens
  React.useEffect(() => {
    if (opened) {
      setDraftSections(JSON.parse(JSON.stringify(sections)));
    }
  }, [opened, sections]);

  const moveItemWithinSection = (sectionIndex: number, itemIndex: number, direction: 'UP' | 'DOWN') => {
    const updated = JSON.parse(JSON.stringify(draftSections));
    const targetItems = updated[sectionIndex].items;
    const targetIdx = direction === 'UP' ? itemIndex - 1 : itemIndex + 1;

    if (targetIdx < 0 || targetIdx >= targetItems.length) return;

    const [moved] = targetItems.splice(itemIndex, 1);
    targetItems.splice(targetIdx, 0, moved);
    setDraftSections(updated);
  };

  const moveItemToSection = (fromSectionIndex: number, itemIndex: number, targetSectionKey: string) => {
    if (!targetSectionKey || draftSections[fromSectionIndex].key === targetSectionKey) return;

    const updated = JSON.parse(JSON.stringify(draftSections));
    const [movedItem] = updated[fromSectionIndex].items.splice(itemIndex, 1);
    const toSection = updated.find((s: NavSection) => s.key === targetSectionKey);

    if (toSection) {
      toSection.items.push(movedItem);
      setDraftSections(updated);
    }
  };

  const handleResetToDefault = () => {
    setDraftSections(JSON.parse(JSON.stringify(defaultSections)));
    showSuccessNotification('تمت الاستعادة', 'تمت استعادة الترتيب الافتراضي للقائمة الجانبية بنجاح');
  };

  const handleSave = () => {
    onSave(draftSections);
    showSuccessNotification('تم الحفظ', 'تم حفظ الترتيب الجديد للقائمة وتطبيقه بنجاح');
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 font-extrabold text-sm text-slate-800">
          <IconSettings size={18} className="text-emerald-600" />
          <span>تخصيص وترتيب القائمة الجانبية</span>
        </div>
      }
      size="xl"
      radius="md"
      overlayProps={{ opacity: 0.5, blur: 2 }}
    >
      <div className="space-y-4 text-xs select-none">
        <p className="text-slate-500 text-[11px] leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          يمكنك هنا إعادة ترتيب صفحات القائمة الجانبية أو <strong>نقل أي صفحة من مجموعة إلى مجموعة أخرى</strong> بحسب طبيعة عملك وسير إجراءاتك.
        </p>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
          {draftSections.map((sec, secIdx) => {
            const SecIcon = iconMap[sec.iconKey] || IconFolder;
            return (
              <div key={sec.key} className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center">
                      <SecIcon size={14} />
                    </div>
                    <span className="font-extrabold text-xs text-slate-800">{sec.title}</span>
                    <Badge size="xs" variant="light" color="gray">
                      {sec.items.length} صفحات
                    </Badge>
                  </div>
                </div>

                {sec.items.length === 0 ? (
                  <div className="text-center py-3 text-[11px] text-slate-400 font-medium bg-white rounded-lg border border-dashed border-slate-200">
                    لا توجد صفحات في هذه المجموعة حالياً.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {sec.items.map((item, itemIdx) => {
                      const ItemIcon = iconMap[item.iconKey] || IconFile;
                      return (
                        <Paper
                          key={item.id}
                          p="xs"
                          radius="md"
                          withBorder
                          className="bg-white hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                              <ItemIcon size={15} />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-800 block truncate text-[11.5px]">{item.title}</span>
                              <span className="text-[9.5px] font-mono text-slate-400 block truncate">{item.path}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Move to another section select */}
                            <Select
                              size="xs"
                              value={sec.key}
                              data={draftSections.map((s) => ({ label: s.title, value: s.key }))}
                              onChange={(val) => val && moveItemToSection(secIdx, itemIdx, val)}
                              className="w-36 text-xs font-bold"
                              leftSection={<IconArrowsExchange size={13} className="text-slate-400" />}
                              comboboxProps={{ shadow: 'md', withinPortal: true }}
                            />

                            {/* Up Button */}
                            <Tooltip label="تحريك للأعلى" position="top">
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                color="gray"
                                disabled={itemIdx === 0}
                                onClick={() => moveItemWithinSection(secIdx, itemIdx, 'UP')}
                              >
                                <IconArrowUp size={14} />
                              </ActionIcon>
                            </Tooltip>

                            {/* Down Button */}
                            <Tooltip label="تحريك للأسفل" position="top">
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                color="gray"
                                disabled={itemIdx === sec.items.length - 1}
                                onClick={() => moveItemWithinSection(secIdx, itemIdx, 'DOWN')}
                              >
                                <IconArrowDown size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </div>
                        </Paper>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <Button
            size="xs"
            variant="light"
            color="orange"
            leftSection={<IconRestore size={14} />}
            onClick={handleResetToDefault}
          >
            استعادة الترتيب الافتراضي
          </Button>

          <div className="flex items-center gap-2">
            <Button size="xs" variant="default" onClick={onClose}>
              إلغاء
            </Button>
            <Button size="xs" color="orange" leftSection={<IconCheck size={14} />} onClick={handleSave}>
              حفظ الترتيب والتطبيق
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
