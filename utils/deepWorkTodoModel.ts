import { BrainDumpItem, DeepWorkBlockerStatus, DeepWorkCompletionMode, DeepWorkConfidence, DeepWorkOutputFormat, DeepWorkPattern, ItemMeta, ItemType } from '../types';

export const DEEP_WORK_DEFAULT_COMPLETION_MODE: DeepWorkCompletionMode = 'final_output_check';

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const cleanOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const cleaned = normalizeWhitespace(value);
  return cleaned || undefined;
};

const cleanStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value
    .map(cleanOptionalText)
    .filter((v): v is string => Boolean(v));
  return cleaned.length > 0 ? Array.from(new Set(cleaned)) : undefined;
};

const cleanPositiveInteger = (value: unknown): number | undefined => {
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.replace(/[^\d.-]/g, ''))
      : NaN;
  if (!Number.isFinite(numberValue) || numberValue <= 0) return undefined;
  return Math.round(numberValue);
};

const isCompletionMode = (value: unknown): value is DeepWorkCompletionMode =>
  value === 'manual' || value === 'all_subtasks' || value === 'final_output_check';

const isBlockerStatus = (value: unknown): value is DeepWorkBlockerStatus =>
  value === 'clear' || value === 'blocked' || value === 'needs_input' || value === 'unknown';

const isConfidence = (value: unknown): value is DeepWorkConfidence =>
  value === 'low' || value === 'medium' || value === 'high';

const isPattern = (value: unknown): value is DeepWorkPattern =>
  value === 'summary' || value === 'regulation' || value === 'research' || value === 'review' || value === 'continuation' || value === 'artifact' || value === 'decision';

const isOutputFormat = (value: unknown): value is DeepWorkOutputFormat =>
  value === 'bullet_summary' || value === 'brief' || value === 'table' || value === 'decision_memo' || value === 'slides' || value === 'email_draft' || value === 'notes' || value === 'unknown';

export const normalizeDeepWorkTodoMeta = (meta: ItemMeta = {}): ItemMeta => {
  const subtasks = cleanStringArray(meta.subtasks);
  const childTodoIds = cleanStringArray(meta.childTodoIds);
  const hasDeepWorkShape = Boolean(
    meta.deepWorkParent
    || meta.parentTodoId
    || meta.deepWorkPlanId
    || meta.deepWorkStatus
    || meta.deepWorkTriggerPattern
    || meta.deepWorkTriggerEvidence
    || meta.deepWorkConfidence
    || meta.deepWorkNextAction
    || meta.deepWorkNextActionDurationMinutes
    || meta.deepWorkNextActionAcceptanceCheck
    || meta.deepWorkFinalOutputFormat
    || meta.deepWorkFinalOutput
    || meta.deepWorkSessionEstimateMinutes
    || meta.deepWorkSessionEstimateConfidence
    || meta.deepWorkSessionEstimateReason
    || meta.deepWorkBlockerCheck
    || meta.deepWorkBlockerStatus
    || meta.deepWorkMissingInputs
    || meta.deepWorkCompletionMode
    || meta.deepWorkStepIndex
    || meta.deepWorkStepCount
    || meta.deepWorkGeneratedAt
    || meta.deepWorkAcceptedAt
    || meta.deepWorkDismissedAt
    || meta.deepWorkReason
    || childTodoIds
    || subtasks
  );

  if (!hasDeepWorkShape) return meta;

  const normalized: ItemMeta = {
    ...meta,
    parentTodoId: cleanOptionalText(meta.parentTodoId),
    childTodoIds,
    deepWorkParent: !meta.parentTodoId && (meta.deepWorkParent === true || childTodoIds !== undefined || meta.deepWorkNextAction !== undefined || meta.deepWorkFinalOutput !== undefined) ? true : undefined,
    deepWorkPlanId: cleanOptionalText(meta.deepWorkPlanId),
    deepWorkStatus: meta.deepWorkStatus,
    deepWorkTriggerPattern: isPattern(meta.deepWorkTriggerPattern) ? meta.deepWorkTriggerPattern : undefined,
    deepWorkTriggerEvidence: cleanStringArray(meta.deepWorkTriggerEvidence),
    deepWorkConfidence: isConfidence(meta.deepWorkConfidence) ? meta.deepWorkConfidence : undefined,
    deepWorkNextAction: cleanOptionalText(meta.deepWorkNextAction),
    deepWorkNextActionDurationMinutes: cleanPositiveInteger(meta.deepWorkNextActionDurationMinutes),
    deepWorkNextActionAcceptanceCheck: cleanOptionalText(meta.deepWorkNextActionAcceptanceCheck),
    deepWorkFinalOutputFormat: isOutputFormat(meta.deepWorkFinalOutputFormat) ? meta.deepWorkFinalOutputFormat : undefined,
    deepWorkFinalOutput: cleanOptionalText(meta.deepWorkFinalOutput),
    deepWorkSessionEstimateMinutes: cleanPositiveInteger(meta.deepWorkSessionEstimateMinutes),
    deepWorkSessionEstimateConfidence: isConfidence(meta.deepWorkSessionEstimateConfidence) ? meta.deepWorkSessionEstimateConfidence : undefined,
    deepWorkSessionEstimateReason: cleanOptionalText(meta.deepWorkSessionEstimateReason),
    deepWorkBlockerCheck: cleanOptionalText(meta.deepWorkBlockerCheck),
    deepWorkBlockerStatus: isBlockerStatus(meta.deepWorkBlockerStatus) ? meta.deepWorkBlockerStatus : undefined,
    deepWorkMissingInputs: cleanStringArray(meta.deepWorkMissingInputs),
    deepWorkCompletionMode: isCompletionMode(meta.deepWorkCompletionMode) ? meta.deepWorkCompletionMode : (meta.deepWorkParent ? DEEP_WORK_DEFAULT_COMPLETION_MODE : undefined),
    deepWorkStepIndex: cleanPositiveInteger(meta.deepWorkStepIndex),
    deepWorkStepCount: cleanPositiveInteger(meta.deepWorkStepCount),
    deepWorkGeneratedAt: cleanOptionalText(meta.deepWorkGeneratedAt),
    deepWorkAcceptedAt: cleanOptionalText(meta.deepWorkAcceptedAt),
    deepWorkDismissedAt: cleanOptionalText(meta.deepWorkDismissedAt),
    deepWorkReason: cleanOptionalText(meta.deepWorkReason),
    subtasks,
  };

  for (const key of Object.keys(normalized) as Array<keyof ItemMeta>) {
    if (normalized[key] === undefined) delete normalized[key];
  }

  return normalized;
};

export const getDeepWorkChildren = (items: BrainDumpItem[], parentId: string): BrainDumpItem[] => {
  const parent = items.find(item => item.id === parentId);
  const childIds = new Set(parent?.meta.childTodoIds || []);
  return items
    .filter(item => item.type === ItemType.TODO && (item.meta.parentTodoId === parentId || childIds.has(item.id)))
    .sort((a, b) => (a.meta.deepWorkStepIndex || 0) - (b.meta.deepWorkStepIndex || 0));
};

export const deriveDeepWorkChildProgress = (items: BrainDumpItem[], parentId: string): number | undefined => {
  const children = getDeepWorkChildren(items, parentId);
  if (children.length === 0) return undefined;
  const done = children.filter(child => child.status === 'done').length;
  return Math.round((done / children.length) * 100);
};

export const applyDeepWorkChildProgress = (items: BrainDumpItem[]): BrainDumpItem[] => {
  let changed = false;
  const next = items.map(item => {
    if (item.type !== ItemType.TODO || (!item.meta.deepWorkParent && !item.meta.childTodoIds?.length)) return item;
    const childProgress = deriveDeepWorkChildProgress(items, item.id);
    if (childProgress === undefined || item.meta.progress === childProgress) return item;
    changed = true;
    return {
      ...item,
      meta: {
        ...item.meta,
        progress: childProgress,
      },
    };
  });
  return changed ? next : items;
};

export const shouldAutoCompleteDeepWorkParent = (parent: BrainDumpItem, children: BrainDumpItem[]): boolean => {
  if (parent.type !== ItemType.TODO) return false;
  if (parent.status === 'done') return false;
  if (parent.meta.deepWorkCompletionMode !== 'all_subtasks') return false;
  return children.length > 0 && children.every(child => child.status === 'done');
};

export const applyDeepWorkCompletionSemantics = (items: BrainDumpItem[], now = new Date().toISOString()): BrainDumpItem[] => {
  let changed = false;
  const next = items.map(item => {
    if (item.type !== ItemType.TODO) return item;
    const children = getDeepWorkChildren(items, item.id);
    if (!shouldAutoCompleteDeepWorkParent(item, children)) return item;
    changed = true;
    return {
      ...item,
      status: 'done' as const,
      completed_at: now,
      meta: {
        ...item.meta,
        progress: 100,
      },
    };
  });
  return changed ? next : items;
};

export const encodeSubtasksForSheet = (subtasks?: string[]): string =>
  (cleanStringArray(subtasks) || []).join('\n');

export const parseSubtasksFromSheet = (value: unknown): string[] | undefined => {
  if (typeof value !== 'string') return undefined;
  return cleanStringArray(value.split(/\r?\n|\s*;\s*/));
};
