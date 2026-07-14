import { useCallback } from 'react';
import { BrainDumpItem, CanonicalRule, EnrichmentTask, ParserResultV2, ParsingTask } from '../types';
import { HistoricalCanonicalReview, learnCanonicalRulesFromReview, sweepHistoricalCanonicalMeta } from '../services/canonicalizerService';
import { ASYNC_ENRICHMENT_REVIEW_PREFIX, queueCanonicalEnrichmentTasks, runCanonicalEnrichmentTasks } from '../services/asyncEnrichmentService';
import { getSystemCanonicalRules } from '../utils/canonicalization/systemRules';
import { guardParserResultMultiplicity } from '../utils/parserResultGuards';


export const mergeAsyncEnrichmentReviews = (
  reviews: HistoricalCanonicalReview[],
  previous: HistoricalCanonicalReview[],
): HistoricalCanonicalReview[] => {
  const reviewIds = new Set(reviews.map(review => review.id));
  return [
    ...reviews,
    ...previous.filter(review => !reviewIds.has(review.id) && !review.id.startsWith(ASYNC_ENRICHMENT_REVIEW_PREFIX)),
  ];
};

export const removeResolvedReviewActivity = (
  id: string,
  parsingTasks: ParsingTask[],
  enrichmentTasks: EnrichmentTask[],
) => ({
  parsingTasks: parsingTasks.filter(task => task.id !== id),
  enrichmentTasks: enrichmentTasks.filter(task => {
    const enrichmentReviewId = `${ASYNC_ENRICHMENT_REVIEW_PREFIX}${task.itemId}`;
    return task.id !== id && task.parserTaskId !== id && enrichmentReviewId !== id;
  }),
});

type EnrichmentDeps = {
  itemsRef: { current: BrainDumpItem[] };
  setItems: (items: BrainDumpItem[] | ((prev: BrainDumpItem[]) => BrainDumpItem[])) => void;
  saveAndSync: (items: BrainDumpItem[], ...rest: any[]) => Promise<void>;
  canonicalRulesRef: { current: CanonicalRule[] };
  setCanonicalRules: (rules: CanonicalRule[]) => void;
  walletsRef: { current: any[] };
  budgetConfigRef: { current: any };
  enrichmentTasksRef: { current: any[] };
  setEnrichmentTasks: (updater: any) => void;
  setParsingTasks: (updater: any) => void;
  setPendingReviews: (updater: any) => void;
  pendingReviews: any[];
  executeParserResults: (results: ParserResultV2[], text: string, id: string, rules?: CanonicalRule[]) => void;
  replaceHistoricalCanonicalReviews: (reviews: HistoricalCanonicalReview[]) => void;
};

export const useEnrichment = (deps: EnrichmentDeps) => {
  const {
    itemsRef, setItems, saveAndSync,
    canonicalRulesRef, setCanonicalRules,
    walletsRef, budgetConfigRef,
    enrichmentTasksRef, setEnrichmentTasks, setParsingTasks,
    setPendingReviews, pendingReviews,
    executeParserResults, replaceHistoricalCanonicalReviews,
  } = deps;

  const replaceAsyncEnrichmentReviews = useCallback((reviews: HistoricalCanonicalReview[]) => {
    setPendingReviews((prev: HistoricalCanonicalReview[]) => mergeAsyncEnrichmentReviews(reviews, prev));
  }, [setPendingReviews]);

  const processEnrichmentTasks = useCallback(async (tasks: any[]) => {
    if (tasks.length === 0) return;

    setEnrichmentTasks((prev: any[]) => prev.map((task: any) =>
      tasks.some((nextTask: any) => nextTask.id === task.id)
        ? { ...task, status: 'running', attempts: task.attempts + 1 }
        : task
    ));

    try {
      const result = runCanonicalEnrichmentTasks({
        items: itemsRef.current,
        tasks,
        ctx: {
          existingItems: itemsRef.current,
          wallets: walletsRef.current,
          budgetRules: budgetConfigRef.current?.rules || [],
          rules: [...getSystemCanonicalRules(walletsRef.current), ...canonicalRulesRef.current],
        },
      });

      replaceAsyncEnrichmentReviews(result.reviews);

      if (result.changedItemIds.length > 0) {
        itemsRef.current = result.items;
        setItems(result.items);
        saveAndSync(result.items, undefined, undefined, undefined, undefined, undefined, undefined, canonicalRulesRef.current);
      }

      setEnrichmentTasks((prev: any[]) => {
        const resultsById = new Map(result.taskResults.map((task: any) => [task.id, task]));
        return prev.map((task: any) => resultsById.get(task.id) || task);
      });
    } catch (err: any) {
      setEnrichmentTasks((prev: any[]) => prev.map((task: any) =>
        tasks.some((nextTask: any) => nextTask.id === task.id)
          ? { ...task, status: 'failed', error: err?.message || 'Async enrichment failed', completedAt: Date.now() }
          : task
      ));
    }
  }, [itemsRef, setItems, saveAndSync, canonicalRulesRef, walletsRef, budgetConfigRef, setEnrichmentTasks, replaceAsyncEnrichmentReviews]);

  const enqueueEnrichmentForParserTask = useCallback((parserTaskId: string, sourceText: string) => {
    const targetItemIds = itemsRef.current
      .filter(item => item.meta?.parserTaskId === parserTaskId)
      .map(item => item.id);

    const queuedTasks = queueCanonicalEnrichmentTasks({
      items: itemsRef.current,
      itemIds: targetItemIds,
      parserTaskId,
      sourceText,
    }).filter((task: any) => !enrichmentTasksRef.current.some((existing: any) => existing.id === task.id));

    if (queuedTasks.length === 0) return;

    setEnrichmentTasks((prev: any[]) => [...queuedTasks, ...prev]);
    enrichmentTasksRef.current = [...queuedTasks, ...enrichmentTasksRef.current];
    Promise.resolve().then(() => processEnrichmentTasks(queuedTasks));
  }, [itemsRef, enrichmentTasksRef, setEnrichmentTasks, processEnrichmentTasks]);

  const runCanonicalBackfill = useCallback(() => {
    const sweep = sweepHistoricalCanonicalMeta(itemsRef.current, {
      existingItems: itemsRef.current,
      wallets: walletsRef.current,
      budgetRules: budgetConfigRef.current?.rules || [],
      rules: [...getSystemCanonicalRules(walletsRef.current), ...canonicalRulesRef.current],
    });

    replaceHistoricalCanonicalReviews(sweep.reviews);

    if (sweep.changedItemIds.length > 0) {
      itemsRef.current = sweep.items;
      setItems(sweep.items);
      saveAndSync(sweep.items, undefined, undefined, undefined, undefined, undefined, undefined, canonicalRulesRef.current);
    }

    return sweep;
  }, [itemsRef, setItems, saveAndSync, walletsRef, budgetConfigRef, canonicalRulesRef, replaceHistoricalCanonicalReviews]);

  const toggleCanonicalRuleDisabled = useCallback((ruleId: string) => {
    const timestamp = new Date().toISOString();
    const nextRules = canonicalRulesRef.current.map(rule => {
      if (rule.id !== ruleId || rule.source !== 'learned') return rule;
      const nextDisabled = !rule.disabled;
      return {
        ...rule,
        disabled: nextDisabled,
        autoApplyDisabled: nextDisabled ? true : rule.rejectionCount >= 2,
        disabledReason: nextDisabled ? 'manually disabled in Control Center' : undefined,
        updatedAt: timestamp,
      };
    });

    canonicalRulesRef.current = nextRules;
    setCanonicalRules(nextRules);
    saveAndSync(undefined, undefined, undefined, undefined, undefined, undefined, undefined, nextRules);
  }, [canonicalRulesRef, setCanonicalRules, saveAndSync]);

  const clearResolvedReviewActivity = (id: string) => {
    setParsingTasks((prev: ParsingTask[]) => removeResolvedReviewActivity(id, prev, []).parsingTasks);
    setEnrichmentTasks((prev: EnrichmentTask[]) => removeResolvedReviewActivity(id, [], prev).enrichmentTasks);
  };

  const handleApproveReview = (id: string, updatedResults: ParserResultV2[]) => {
    const review = pendingReviews.find((r: any) => r.id === id);
    if (!review) {
      setPendingReviews((prev: any[]) => prev.filter((r: any) => r.id !== id));
      clearResolvedReviewActivity(id);
      return;
    }

    const nextCanonicalRules = learnCanonicalRulesFromReview({
      originalResults: review.originalResults,
      approvedResults: updatedResults,
      existingRules: canonicalRulesRef.current
    });

    canonicalRulesRef.current = nextCanonicalRules;
    setCanonicalRules(nextCanonicalRules);
    const guardedResults = guardParserResultMultiplicity(updatedResults, review.text).results;
    executeParserResults(guardedResults, review.text, id, nextCanonicalRules);
    setPendingReviews((prev: any[]) => prev.filter((r: any) => r.id !== id));
    clearResolvedReviewActivity(id);
  };

  const handleRejectReview = (id: string) => {
    setPendingReviews((prev: any[]) => prev.filter((r: any) => r.id !== id));
    clearResolvedReviewActivity(id);
  };

  return {
    processEnrichmentTasks,
    enqueueEnrichmentForParserTask,
    runCanonicalBackfill,
    toggleCanonicalRuleDisabled,
    handleApproveReview,
    handleRejectReview,
  };
};
