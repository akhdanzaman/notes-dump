import { ItemMeta } from '../types';

/** Strips deep-work planning fields from item metadata, keeping only user-authored fields. */
export const stripDeepWorkFieldsFromMeta = (meta: ItemMeta = {}): ItemMeta => {
    const {
        parentTodoId,
        childTodoIds,
        deepWorkParent,
        deepWorkPlanId,
        deepWorkStatus,
        deepWorkTriggerPattern,
        deepWorkTriggerEvidence,
        deepWorkConfidence,
        deepWorkNextAction,
        deepWorkNextActionDurationMinutes,
        deepWorkNextActionAcceptanceCheck,
        deepWorkFinalOutputFormat,
        deepWorkFinalOutput,
        deepWorkSessionEstimateMinutes,
        deepWorkSessionEstimateConfidence,
        deepWorkSessionEstimateReason,
        deepWorkBlockerCheck,
        deepWorkBlockerStatus,
        deepWorkMissingInputs,
        deepWorkCompletionMode,
        deepWorkStepIndex,
        deepWorkStepCount,
        deepWorkGeneratedAt,
        deepWorkAcceptedAt,
        deepWorkDismissedAt,
        deepWorkReason,
        subtasks,
        ...rest
    } = meta;
    return rest;
};
