import assert from 'node:assert/strict';
import test from 'node:test';
import { HistoricalCanonicalReview } from '../../services/canonicalizerService';
import { mergeAsyncEnrichmentReviews, removeResolvedReviewActivity } from '../useEnrichment';
import { EnrichmentTask, ParsingTask } from '../../types';

const review = (id: string): HistoricalCanonicalReview => ({
  id,
  text: id,
  results: [],
  originalResults: [],
});

test('resolved parser review removes its parser and enrichment activity cards', () => {
  const parsingTasks: ParsingTask[] = [
    { id: 'draft-1', text: 'expense lunch', status: 'success', createdAt: 1 },
    { id: 'draft-2', text: 'other', status: 'failed', createdAt: 2 },
  ];
  const enrichmentTasks: EnrichmentTask[] = [
    { id: 'enrich-draft-1-item-a', itemId: 'item-a', parserTaskId: 'draft-1', status: 'review', attempts: 1, createdAt: 1 },
    { id: 'enrich-draft-2-item-b', itemId: 'item-b', parserTaskId: 'draft-2', status: 'failed', attempts: 1, createdAt: 2 },
  ];

  const resolved = removeResolvedReviewActivity('draft-1', parsingTasks, enrichmentTasks);
  assert.deepEqual(resolved.parsingTasks.map(task => task.id), ['draft-2']);
  assert.deepEqual(resolved.enrichmentTasks.map(task => task.id), ['enrich-draft-2-item-b']);
});

test('resolved enrichment review removes the matching enrichment activity card', () => {
  const enrichmentTasks: EnrichmentTask[] = [
    { id: 'enrich-manual-item-a', itemId: 'item-a', status: 'review', attempts: 1, createdAt: 1 },
    { id: 'enrich-manual-item-b', itemId: 'item-b', status: 'failed', attempts: 1, createdAt: 2 },
  ];

  const resolved = removeResolvedReviewActivity('canonical-enrichment-item-a', [], enrichmentTasks);
  assert.deepEqual(resolved.enrichmentTasks.map(task => task.itemId), ['item-b']);
});

test('an enrichment pass with no new reviews clears obsolete enrichment review drafts', () => {
  const previous = [review('canonical-enrichment-item-a'), review('normal-review')];
  assert.deepEqual(
    mergeAsyncEnrichmentReviews([], previous).map(item => item.id),
    ['normal-review'],
  );
});
