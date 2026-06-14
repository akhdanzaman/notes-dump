import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { BrainDumpItem, ItemType, ItemMeta } from '../types';
import { applyDeepWorkChildProgress, applyDeepWorkCompletionSemantics, normalizeDeepWorkTodoMeta, supportsNestedTodoSubtasks } from '../utils/deepWorkTodoModel';
import { buildDeepWorkSuggestionMeta, createDeepWorkSubtaskItems } from '../services/deepWorkTransformer';
import { stripDeepWorkFieldsFromMeta } from '../utils/stripDeepWorkFields';
import type { BrainDumpContext } from './brainDumpContext';

export const useDeepWork = (ctx: BrainDumpContext) => {
  const saveDeepWorkItems = useCallback((nextItems: BrainDumpItem[]) => {
    const normalized = applyDeepWorkCompletionSemantics(applyDeepWorkChildProgress(nextItems));
    ctx.itemsRef.current = normalized;
    ctx.setItems(normalized);
    ctx.saveAndSync(normalized);
  }, [ctx]);

  const handleKeepRawTodo = useCallback(async (id: string) => {
    const target = ctx.itemsRef.current.find(item => item.id === id);
    const childIds = new Set(target?.meta.childTodoIds || []);
    const updatedItems = ctx.itemsRef.current
      .filter(item => item.id === id || (item.meta.parentTodoId !== id && !childIds.has(item.id)))
      .map(item => {
        if (item.id !== id) return item;
        return {
          ...item,
          meta: {
            ...stripDeepWorkFieldsFromMeta(item.meta),
            progress: item.meta.progress,
            progressNotes: item.meta.progressNotes,
          }
        };
      });
    saveDeepWorkItems(updatedItems);
  }, [ctx, saveDeepWorkItems]);

  const handleUpdateDeepWorkTodo = useCallback(async (id: string, changes: Partial<ItemMeta>) => {
    const updatedItems = ctx.itemsRef.current.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        meta: normalizeDeepWorkTodoMeta({
          ...item.meta,
          ...changes,
          deepWorkPlanId: item.meta.deepWorkPlanId || item.id,
        })
      };
    });
    saveDeepWorkItems(updatedItems);
  }, [ctx, saveDeepWorkItems]);

  const handleRetriggerDeepWorkTodo = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    const target = ctx.itemsRef.current.find(item => item.id === id);
    const childIds = new Set(target?.meta.childTodoIds || []);
    const updatedItems = ctx.itemsRef.current
      .filter(item => item.id === id || (item.meta.parentTodoId !== id && !childIds.has(item.id)))
      .map(item => {
        if (item.id !== id || !supportsNestedTodoSubtasks(item)) return item;
        const baseMeta = stripDeepWorkFieldsFromMeta(item.meta);
        const regeneratedMeta = buildDeepWorkSuggestionMeta(item.content, {
          ...baseMeta,
          deepWorkGeneratedAt: now,
        });
        return {
          ...item,
          meta: normalizeDeepWorkTodoMeta({
            ...regeneratedMeta,
            deepWorkPlanId: item.id,
            progress: regeneratedMeta.progress ?? item.meta.progress ?? 0,
          })
        };
      });
    saveDeepWorkItems(updatedItems);
  }, [ctx, saveDeepWorkItems]);

  const handleAcceptDeepWorkTodo = useCallback(async (id: string, subtasks?: string[]) => {
    const now = new Date().toISOString();
    const parentItem = ctx.itemsRef.current.find(item => item.id === id);
    const previousChildIds = new Set(parentItem?.meta.childTodoIds || []);
    const existingChildren = ctx.itemsRef.current
      .filter(item => item.meta.parentTodoId === id || previousChildIds.has(item.id))
      .sort((a, b) => (a.meta.deepWorkStepIndex || 0) - (b.meta.deepWorkStepIndex || 0));
    const existingByTitle = new Map(
      existingChildren.map(child => [child.content.trim().toLowerCase(), child])
    );

    let childItems: BrainDumpItem[] = [];
    const updatedParents = ctx.itemsRef.current.map(item => {
      if (item.id !== id || !supportsNestedTodoSubtasks(item)) return item;
      const parentForChildren: BrainDumpItem = {
        ...item,
        meta: normalizeDeepWorkTodoMeta({
          ...item.meta,
          childTodoIds: undefined,
          deepWorkPlanId: item.meta.deepWorkPlanId || item.id,
          subtasks: subtasks?.length ? subtasks : item.meta.subtasks,
        })
      };
      childItems = createDeepWorkSubtaskItems(parentForChildren, uuidv4, now).map((child, index) => {
        const titleKey = child.content.trim().toLowerCase();
        const existing = existingByTitle.get(titleKey) || existingChildren[index];
        if (!existing) return child;
        return {
          ...child,
          id: existing.id,
          status: existing.status,
          created_at: existing.created_at,
          completed_at: existing.completed_at,
          meta: {
            ...child.meta,
            progress: existing.meta.progress,
            progressNotes: existing.meta.progressNotes,
          }
        };
      });
      const childIds = childItems.map(child => child.id);
      return {
        ...parentForChildren,
        meta: normalizeDeepWorkTodoMeta({
          ...parentForChildren.meta,
          childTodoIds: childIds.length ? childIds : parentForChildren.meta.childTodoIds,
          deepWorkParent: true,
          deepWorkPlanId: parentForChildren.meta.deepWorkPlanId || parentForChildren.id,
          deepWorkStatus: childIds.length ? 'active' : 'accepted',
          deepWorkCompletionMode: parentForChildren.meta.deepWorkCompletionMode || 'final_output_check',
          progress: parentForChildren.meta.progress ?? 0,
          subtasks: subtasks?.length ? subtasks : parentForChildren.meta.subtasks,
        })
      };
    });

    const withoutExistingChildren = updatedParents.filter(
      item => item.id === id || (item.meta.parentTodoId !== id && !previousChildIds.has(item.id))
    );
    saveDeepWorkItems([...childItems, ...withoutExistingChildren]);
  }, [ctx, saveDeepWorkItems]);

  const handleAcceptDeepWorkPlan = useCallback((id: string) => {
    const currentItems = ctx.itemsRef.current;
    const parent = currentItems.find(item => item.id === id && item.type === ItemType.TODO);
    if (!parent) return;

    const parentWithSuggestion: BrainDumpItem = {
      ...parent,
      meta: normalizeDeepWorkTodoMeta(buildDeepWorkSuggestionMeta(parent.content, parent.meta))
    };
    const now = new Date().toISOString();
    const childItems = createDeepWorkSubtaskItems(parentWithSuggestion, uuidv4, now);
    if (childItems.length === 0) return;

    const childIds = childItems.map(child => child.id);
    const updatedParent: BrainDumpItem = {
      ...parentWithSuggestion,
      meta: normalizeDeepWorkTodoMeta({
        ...parentWithSuggestion.meta,
        deepWorkStatus: 'active',
        childTodoIds: childIds,
        deepWorkPlanId: parentWithSuggestion.meta.deepWorkPlanId || parentWithSuggestion.id,
        deepWorkAcceptedAt: now,
        progress: 0,
      })
    };

    const withoutParent = currentItems.filter(item => item.id !== id);
    const updated = applyDeepWorkCompletionSemantics(applyDeepWorkChildProgress([updatedParent, ...childItems, ...withoutParent]));
    ctx.itemsRef.current = updated;
    ctx.setItems(updated);
    ctx.saveAndSync(updated);
  }, [ctx]);

  const handleDismissDeepWorkPlan = useCallback((id: string) => {
    const updated = ctx.itemsRef.current.map(item => {
      if (item.id !== id || !supportsNestedTodoSubtasks(item)) return item;
      return {
        ...item,
        meta: normalizeDeepWorkTodoMeta({
          ...item.meta,
          deepWorkParent: false,
          deepWorkStatus: 'dismissed',
          deepWorkDismissedAt: new Date().toISOString(),
          subtasks: undefined,
        })
      };
    });
    ctx.itemsRef.current = updated;
    ctx.setItems(updated);
    ctx.saveAndSync(updated);
  }, [ctx]);

  return {
    handleKeepRawTodo,
    handleUpdateDeepWorkTodo,
    handleRetriggerDeepWorkTodo,
    handleAcceptDeepWorkTodo,
    handleAcceptDeepWorkPlan,
    handleDismissDeepWorkPlan,
  };
};
