import { useMemo, useState } from 'react';
import type { ReceiptProcessingTask, ReceiptReviewDraft } from '../types';
import type { useBrainDumpData } from './useBrainDumpData';
type ReviewCenterOptions = Pick<ReturnType<typeof useBrainDumpData>, 'parsingTasks' | 'enrichmentTasks' | 'pendingCount' | 'pendingReviews' | 'saveStatus' | 'fetchStatus'> & {
  receiptTasks: ReceiptProcessingTask[]; receiptReviews: ReceiptReviewDraft[];
};
export function useReviewCenter({ parsingTasks, enrichmentTasks, pendingCount, pendingReviews, saveStatus, fetchStatus, receiptTasks, receiptReviews }: ReviewCenterOptions) {
  const [isReviewCenterOpen, setIsReviewCenterOpen] = useState(false);
  const [lastReviewCenterOpenedAt, setLastReviewCenterOpenedAt] = useState(0);
  const latestParsingTaskAt = useMemo(() => {
    const latestParsing = parsingTasks.reduce(
      (latest, task) =>
        Math.max(latest, task.createdAt || 0, task.completedAt || 0),
      0,
    );
    return enrichmentTasks.reduce(
      (latest, task) =>
        Math.max(latest, task.createdAt || 0, task.completedAt || 0),
      latestParsing,
    );
  }, [enrichmentTasks, parsingTasks]);

  const latestReceiptReviewAt = useMemo(() => receiptReviews.reduce(
    (latest, review) => Math.max(latest, new Date(review.createdAt).getTime() || 0),
    0,
  ), [receiptReviews]);

  const latestReceiptTaskAt = useMemo(() => receiptTasks.reduce(
    (latest, task) => Math.max(latest, task.createdAt || 0, task.completedAt || 0),
    0,
  ), [receiptTasks]);

  const hasRunningProcess = useMemo(() => {
    return (
      pendingCount > 0 ||
      parsingTasks.some((task) => task.status === "pending") ||
      enrichmentTasks.some(
        (task) => task.status === "pending" || task.status === "running",
      ) ||
      receiptTasks.some((task) => task.status === 'pending') ||
      saveStatus === "saving" ||
      fetchStatus === "syncing"
    );
  }, [enrichmentTasks, fetchStatus, parsingTasks, pendingCount, receiptTasks, saveStatus]);

  const unresolvedParsingCount = parsingTasks.filter(
    (task) => task.status === 'pending' || task.status === 'failed',
  ).length;
  const unresolvedEnrichmentCount = enrichmentTasks.filter(
    (task) => task.status === 'pending' || task.status === 'running' || task.status === 'failed',
  ).length;
  const unresolvedReceiptTaskCount = receiptTasks.filter(
    (task) => task.status === 'pending' || task.status === 'failed',
  ).length;
  const reviewCenterBadgeCount =
    receiptReviews.length
    + pendingReviews.length
    + unresolvedParsingCount
    + unresolvedEnrichmentCount
    + unresolvedReceiptTaskCount;
  const showReviewCenterNudge =
    reviewCenterBadgeCount > 0
    && Math.max(latestParsingTaskAt, latestReceiptReviewAt, latestReceiptTaskAt) > lastReviewCenterOpenedAt;

  const openReviewCenterFromInput = () => {
    setLastReviewCenterOpenedAt(Date.now());
    setIsReviewCenterOpen(true);
  };

  const closeReviewCenterFromInput = () => {
    setIsReviewCenterOpen(false);
  };


  return { isReviewCenterOpen, setIsReviewCenterOpen, reviewCenterBadgeCount, showReviewCenterNudge, hasRunningProcess, unresolvedReceiptTaskCount, openReviewCenterFromInput, closeReviewCenterFromInput };
}
