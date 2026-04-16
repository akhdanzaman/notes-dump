import test from 'node:test';
import assert from 'node:assert/strict';

import { getEffectiveInsightTime } from '../insightService';
import { ItemType } from '../../types';

test('getEffectiveInsightTime prefers semantic dates over created_at', () => {
  const withMetaDate = {
    id: 'journal-1',
    type: ItemType.JOURNAL,
    content: 'Backfilled journal',
    status: 'done' as const,
    created_at: '2026-04-15T10:00:00.000Z',
    meta: { date: '2026-04-14T09:00:00.000Z' },
  };

  assert.equal(getEffectiveInsightTime(withMetaDate), new Date('2026-04-14T09:00:00.000Z').getTime());

  const withCompletedAt = {
    id: 'finance-1',
    type: ItemType.FINANCE,
    content: 'Lunch',
    status: 'done' as const,
    created_at: '2026-04-15T10:00:00.000Z',
    completed_at: '2026-04-13T12:00:00.000Z',
    meta: { date: '2026-04-14T09:00:00.000Z' },
  };

  assert.equal(getEffectiveInsightTime(withCompletedAt), new Date('2026-04-13T12:00:00.000Z').getTime());
});
