import React, { useState, useMemo } from 'react';
import {
  Paper,
  Badge,
  Button,
  TextInput,
  ActionIcon,
  Tooltip,
  SegmentedControl,
  Collapse,
} from '@mantine/core';
import {
  IconSearch,
  IconPlus,
  IconMinus,
  IconFolder,
  IconFolderOpen,
  IconFileText,
  IconEye,
  IconEdit,
  IconChevronDown,
  IconChevronLeft,
  IconLayersSubtract,
  IconLayersLinked,
  IconPrinter,
  IconCurrencyDollar,
  IconArrowUpRight,
} from '@tabler/icons-react';
import { AccountNode } from '../common/AccountingTreeGrid';

interface VisualAccountTreeViewProps {
  accounts: AccountNode[];
  onSelectAccount?: (account: AccountNode) => void;
  onEditAccount?: (account: AccountNode) => void;
  onAddSubAccount?: (parentAccount: AccountNode) => void;
  onViewStatement?: (account: AccountNode) => void;
}

const CLASS_CONFIG: Record<string, { label: string; color: string; badgeBg: string; border: string; iconColor: string }> = {
  '1': {
    label: 'الموجودات (Assets)',
    color: 'teal',
    badgeBg: 'bg-emerald-500/10 text-emerald-700 border-emerald-300',
    border: 'border-r-4 border-r-emerald-600',
    iconColor: 'text-emerald-600',
  },
  '2': {
    label: 'المطلوبات ومصادر التمويل (Liabilities & Capital)',
    color: 'indigo',
    badgeBg: 'bg-indigo-500/10 text-indigo-700 border-indigo-300',
    border: 'border-r-4 border-r-indigo-600',
    iconColor: 'text-indigo-600',
  },
  '3': {
    label: 'الاستخدامات / المصروفات (Expenses & Costs)',
    color: 'rose',
    badgeBg: 'bg-rose-500/10 text-rose-700 border-rose-300',
    border: 'border-r-4 border-r-rose-600',
    iconColor: 'text-rose-600',
  },
  '4': {
    label: 'الموارد / الإيرادات (Revenues)',
    color: 'blue',
    badgeBg: 'bg-blue-500/10 text-blue-700 border-blue-300',
    border: 'border-r-4 border-r-blue-600',
    iconColor: 'text-blue-600',
  },
};

export const VisualAccountTreeView: React.FC<VisualAccountTreeViewProps> = ({
  accounts = [],
  onSelectAccount,
  onEditAccount,
  onAddSubAccount,
  onViewStatement,
}) => {
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Expand all by default
    const set = new Set<string>();
    const collectAll = (nodes: AccountNode[]) => {
      nodes.forEach((n) => {
        set.add(n.id);
        if (n.children) collectAll(n.children);
      });
    };
    collectAll(accounts);
    return set;
  });

  const toggleNode = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const set = new Set<string>();
    const collect = (nodes: AccountNode[]) => {
      nodes.forEach((n) => {
        set.add(n.id);
        if (n.children) collect(n.children);
      });
    };
    collect(accounts);
    setExpandedIds(set);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  // Filter root classes
  const filteredRoots = useMemo(() => {
    if (!accounts) return [];
    let roots = accounts;
    if (selectedClass !== 'ALL') {
      roots = roots.filter((r) => r.code === selectedClass || r.code.startsWith(selectedClass));
    }
    return roots;
  }, [accounts, selectedClass]);

  const countTotalNodes = (node: AccountNode): number => {
    let count = 1;
    if (node.children) {
      node.children.forEach((c) => (count += countTotalNodes(c)));
    }
    return count;
  };

  const renderNodeCard = (node: AccountNode, depth: number = 0, rootCode: string = '1') => {
    const isExpanded = expandedIds.has(node.id) || search.length > 0;
    const hasChildren = node.children && node.children.length > 0;
    const totalDescendants = countTotalNodes(node) - 1;
    const config = CLASS_CONFIG[rootCode] || CLASS_CONFIG['1'];

    const matchesSearch =
      !search ||
      node.code.toLowerCase().includes(search.toLowerCase()) ||
      node.nameAr.toLowerCase().includes(search.toLowerCase()) ||
      (node.nameEn && node.nameEn.toLowerCase().includes(search.toLowerCase()));

    const isLeaf = !hasChildren;

    return (
      <div key={node.id} className="relative transition-all duration-200">
        {/* Card Row */}
        <div
          className={`group flex items-center justify-between p-2.5 rounded-lg border transition-all duration-150 mb-1.5 ${
            depth === 0
              ? `${config.border} bg-white shadow-xs border-slate-200 hover:border-slate-300`
              : depth === 1
              ? 'bg-slate-50/80 border-slate-200 hover:bg-white hover:shadow-2xs'
              : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50/50'
          } ${!matchesSearch && search ? 'opacity-40' : 'opacity-100'}`}
          style={{ marginRight: `${depth * 24}px` }}
        >
          {/* Right Section: Toggle, Code, Name */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Expand / Collapse Button */}
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleNode(node.id)}
                className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0 shadow-2xs border border-slate-200"
              >
                {isExpanded ? <IconChevronDown size={14} /> : <IconChevronLeft size={14} />}
              </button>
            ) : (
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                <span className="w-2 h-2 rounded-full bg-slate-300" />
              </div>
            )}

            {/* Account Code Badge */}
            <span
              className={`font-mono text-xs font-black px-2 py-0.5 rounded border tracking-wide ${
                depth === 0
                  ? config.badgeBg
                  : depth === 1
                  ? 'bg-slate-200 text-slate-800 border-slate-300'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {node.code}
            </span>

            {/* Folder / File Icon */}
            {hasChildren ? (
              isExpanded ? (
                <IconFolderOpen size={16} className={`${config.iconColor} shrink-0`} />
              ) : (
                <IconFolder size={16} className={`${config.iconColor} shrink-0`} />
              )
            ) : (
              <IconFileText size={15} className="text-slate-400 shrink-0" />
            )}

            {/* Account Name */}
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <span
                onClick={() => onSelectAccount && onSelectAccount(node)}
                className={`cursor-pointer hover:underline text-xs ${
                  depth === 0
                    ? 'font-black text-slate-900 text-sm'
                    : depth === 1
                    ? 'font-bold text-slate-800'
                    : 'font-semibold text-slate-700'
                }`}
              >
                {node.nameAr}
              </span>

              {node.nameEn && (
                <span className="text-[10px] font-mono text-slate-400 hidden md:inline">
                  ({node.nameEn})
                </span>
              )}
            </div>

            {/* Level & Children Count Badges */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge size="xs" variant="outline" color="gray" className="text-[9px] font-mono">
                مستوى {node.level || depth + 1}
              </Badge>

              {hasChildren && (
                <Badge size="xs" variant="light" color={config.color} className="text-[9px] font-bold">
                  {totalDescendants} فرع
                </Badge>
              )}

              {isLeaf && node.currency && (
                <Badge size="xs" variant="dot" color="teal" className="text-[9px] font-mono">
                  {node.currency}
                </Badge>
              )}
            </div>
          </div>

          {/* Left Section: Balance & Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Balances */}
            {(node.balanceIQD !== 0 || node.balanceUSD !== 0) && (
              <div className="flex items-center gap-2 font-mono text-[11px] font-bold bg-slate-100/70 px-2 py-0.5 rounded border border-slate-200">
                {node.balanceUSD !== 0 && (
                  <span className="text-emerald-700">
                    ${Number(node.balanceUSD || 0).toLocaleString()}
                  </span>
                )}
                {node.balanceIQD !== 0 && (
                  <span className="text-slate-700">
                    {Number(node.balanceIQD || 0).toLocaleString()} د.ع
                  </span>
                )}
              </div>
            )}

            {/* Actions Menu */}
            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              {onViewStatement && (
                <Tooltip label="كشف الحساب" position="top" withArrow>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="blue"
                    onClick={() => onViewStatement(node)}
                  >
                    <IconEye size={14} />
                  </ActionIcon>
                </Tooltip>
              )}

              {onAddSubAccount && (
                <Tooltip label="إضافة حساب فرعي" position="top" withArrow>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="emerald"
                    onClick={() => onAddSubAccount(node)}
                  >
                    <IconPlus size={14} />
                  </ActionIcon>
                </Tooltip>
              )}

              {onEditAccount && (
                <Tooltip label="تعديل الحساب" position="top" withArrow>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="gray"
                    onClick={() => onEditAccount(node)}
                  >
                    <IconEdit size={14} />
                  </ActionIcon>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        {/* Children Recursion */}
        {hasChildren && isExpanded && (
          <div className="relative pr-2 mr-2 border-r-2 border-slate-200/80 space-y-1 my-1">
            {node.children!.map((child) => renderNodeCard(child, depth + 1, rootCode))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3 w-full select-none text-xs">
      {/* Visual Controls Header */}
      <Paper p="xs" radius="sm" withBorder className="bg-white flex flex-wrap items-center justify-between gap-2 shadow-2xs border-slate-200">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* Quick Search */}
          <TextInput
            placeholder="بحث في الشجرة الهيكلية..."
            size="xs"
            className="w-60"
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />

          {/* Filter by Root Class */}
          <SegmentedControl
            size="xs"
            value={selectedClass}
            onChange={setSelectedClass}
            data={[
              { label: 'كافة الأبواب (1 - 4)', value: 'ALL' },
              { label: '1. الموجودات', value: '1' },
              { label: '2. المطلوبات والتمويل', value: '2' },
              { label: '3. الاستخدامات', value: '3' },
              { label: '4. الموارد', value: '4' },
            ]}
            className="bg-slate-100 font-bold"
          />
        </div>

        {/* Expand / Collapse Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="xs"
            variant="light"
            color="emerald"
            leftSection={<IconLayersSubtract size={13} />}
            onClick={expandAll}
          >
            توسيع كافة الفروع
          </Button>

          <Button
            size="xs"
            variant="subtle"
            color="gray"
            leftSection={<IconLayersLinked size={13} />}
            onClick={collapseAll}
          >
            طي المستويات
          </Button>
        </div>
      </Paper>

      {/* Main Visual Hierarchy Tree */}
      <div className="space-y-4">
        {filteredRoots.map((rootNode) => (
          <div key={rootNode.id} className="bg-slate-50/60 p-3 rounded-xl border border-slate-200/90 shadow-2xs">
            {renderNodeCard(rootNode, 0, rootNode.code)}
          </div>
        ))}
      </div>
    </div>
  );
};
