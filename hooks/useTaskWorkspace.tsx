import React, { useState } from 'react';
import { X } from 'lucide-react';

import type { BrainDumpItem } from '../types';

export type TaskPanel = 'edit' | 'subtasks' | 'editSubtasks' | 'none';

export const getDefaultTaskPanel = (children: BrainDumpItem[], isDeepWork: boolean): TaskPanel =>
  isDeepWork && children.length > 0 ? 'subtasks' : 'none';

export const buildSubtaskDraft = (
  item: BrainDumpItem,
  children: BrainDumpItem[],
  storedDraft?: string[],
) => {
  if (storedDraft !== undefined) return storedDraft;
  if (item.meta.subtasks?.length) return item.meta.subtasks;
  if (children.length > 0) return children.map(child => child.content);
  const emptyStepCount = Math.min(item.meta.deepWorkStepCount || 0, 5);
  return emptyStepCount > 0 ? Array.from({ length: emptyStepCount }, () => '') : [];
};

export const cleanSubtaskDraft = (draft: string[]) => draft.map(step => step.trim()).filter(Boolean);

export const taskPanelButtonClass = (active: boolean, tone: 'edit' | 'subtasks' = 'edit') => {
  if (active && tone === 'subtasks') return 'px-3 py-2 rounded-xl bg-purple-500 text-white text-xs font-bold hover:bg-purple-600 transition-colors flex items-center gap-1';
  if (tone === 'subtasks') return 'px-3 py-2 rounded-xl bg-purple-500/10 text-purple-500 text-xs font-bold hover:bg-purple-500/20 transition-colors flex items-center gap-1';
  if (active) return 'px-3 py-2 rounded-xl bg-primary text-background text-xs font-bold hover:opacity-90 transition-colors flex items-center gap-1';
  return 'px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-muted hover:text-primary hover:bg-black/10 dark:hover:bg-white/[0.09] text-xs font-bold transition-colors flex items-center gap-1';
};

export const renderDeepWorkDetail = (
  icon: React.ReactNode,
  label: string,
  value?: string | number,
  tone = 'text-purple-500',
) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/70 px-3 py-2">
      <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}>
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-primary leading-snug break-words">{value}</div>
    </div>
  );
};

type TaskWorkspaceOptions = {
  defaultCollapsed: boolean;
  onAcceptSubtasks: (itemId: string, subtasks: string[]) => void;
};

export const useTaskWorkspace = ({ defaultCollapsed, onAcceptSubtasks }: TaskWorkspaceOptions) => {
  const [cardCollapsed, setCardCollapsed] = useState<Record<string, boolean>>({});
  const [activePanels, setActivePanels] = useState<Record<string, TaskPanel | undefined>>({});
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string[]>>({});

  const isTaskCardExpanded = (id: string) => {
    const collapsed = cardCollapsed[id];
    return collapsed === undefined ? !defaultCollapsed : !collapsed;
  };

  const setTaskPanel = (id: string, panel: TaskPanel) => {
    setActivePanels(previous => ({ ...previous, [id]: panel }));
  };

  const toggleTaskPanel = (id: string, panel: Exclude<TaskPanel, 'none'>, activePanel: TaskPanel) => {
    setTaskPanel(id, activePanel === panel ? 'none' : panel);
  };

  const resetTaskPanel = (id: string) => {
    setActivePanels(previous => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  };

  const getActiveTaskPanel = (item: BrainDumpItem, children: BrainDumpItem[], isDeepWork: boolean) =>
    activePanels[item.id] || getDefaultTaskPanel(children, isDeepWork);

  function getTaskCardProps<T extends object>(
    baseProps: T,
    activePanel: TaskPanel,
    editPanelControls: React.ReactNode,
    extraExpandedContent?: React.ReactNode,
  ) {
    return {
      ...baseProps,
      collapsibleEditPanel: true as const,
      editPanelExpanded: activePanel === 'edit',
      editPanelControls,
      extraExpandedContent,
      onEditPanelExpandedChange: (id: string, expanded: boolean) => {
        if (expanded) setTaskPanel(id, 'edit');
      },
      onCollapseChange: (id: string, collapsed: boolean) => {
        setCardCollapsed(previous => ({ ...previous, [id]: collapsed }));
        if (collapsed) resetTaskPanel(id);
      },
    };
  }

  const getSubtaskDraft = (item: BrainDumpItem, children: BrainDumpItem[]) =>
    buildSubtaskDraft(item, children, subtaskDrafts[item.id]);

  const updateSubtaskDraft = (itemId: string, index: number, value: string, fallback: string[]) => {
    const next = [...fallback];
    next[index] = value;
    setSubtaskDrafts(previous => ({ ...previous, [itemId]: next }));
  };

  const acceptDeepWorkPlan = (item: BrainDumpItem, children: BrainDumpItem[]) => {
    const draft = cleanSubtaskDraft(getSubtaskDraft(item, children));
    if (draft.length === 0) return;
    onAcceptSubtasks(item.id, draft);
    setSubtaskDrafts(previous => {
      const next = { ...previous };
      delete next[item.id];
      return next;
    });
    setTaskPanel(item.id, 'subtasks');
  };

  const openManualSubtaskDraft = (item: BrainDumpItem, children: BrainDumpItem[] = []) => {
    const draft = getSubtaskDraft(item, children);
    setSubtaskDrafts(previous => ({ ...previous, [item.id]: draft.length ? draft : [''] }));
    setTaskPanel(item.id, 'editSubtasks');
  };

  const renderSubtaskDraftEditor = (item: BrainDumpItem, children: BrainDumpItem[], saveLabel: string) => {
    const draft = getSubtaskDraft(item, children);
    return (
      <div className="space-y-2">
        {draft.map((step, index) => (
          <div key={`${item.id}-draft-${index}`} className="flex gap-2">
            <div className="mt-3 h-5 w-5 shrink-0 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-bold flex items-center justify-center">
              {index + 1}
            </div>
            <textarea
              value={step}
              onChange={event => updateSubtaskDraft(item.id, index, event.target.value, draft)}
              className="min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-primary outline-none focus:border-purple-500/60"
              placeholder="Subtask..."
            />
            <button
              onClick={() => setSubtaskDrafts(previous => ({
                ...previous,
                [item.id]: draft.filter((_, draftIndex) => draftIndex !== index),
              }))}
              className="self-center p-2 rounded-full text-muted hover:bg-red-500/10 hover:text-red-500 transition-colors"
              aria-label="Remove subtask"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => setSubtaskDrafts(previous => ({ ...previous, [item.id]: [...draft, ''] }))}
            className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-muted text-xs font-bold hover:bg-black/10 dark:hover:bg-white/[0.09] transition-colors"
          >
            Add step
          </button>
          <button
            onClick={() => acceptDeepWorkPlan(item, children)}
            className="px-3 py-2 rounded-xl bg-purple-500 text-white text-xs font-bold hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={cleanSubtaskDraft(draft).length === 0}
          >
            {saveLabel}
          </button>
        </div>
      </div>
    );
  };

  return {
    isTaskCardExpanded,
    setTaskPanel,
    toggleTaskPanel,
    getActiveTaskPanel,
    getTaskCardProps,
    getSubtaskDraft,
    acceptDeepWorkPlan,
    openManualSubtaskDraft,
    renderSubtaskDraftEditor,
  };
};
