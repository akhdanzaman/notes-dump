import test from 'node:test';
import assert from 'node:assert/strict';

import { ItemType } from '../../types';
import { upsertDailyJournalEntry } from '../journalUtils';
import { getJournalDayGroups } from '../selectors/noteSelectors';

test('same-day journal entries append into one daily item', () => {
  const existing = {
    id: 'journal-1',
    type: ItemType.JOURNAL,
    content: 'Morning thoughts',
    status: 'done' as const,
    created_at: '2026-05-03T01:00:00.000Z',
    completed_at: '2026-05-03T01:00:00.000Z',
    meta: { date: '2026-05-03T01:00:00.000Z', tags: ['mood'] },
  };

  const incoming = {
    id: 'journal-2',
    type: ItemType.JOURNAL,
    content: 'Night reflection',
    status: 'done' as const,
    created_at: '2026-05-03T12:00:00.000Z',
    completed_at: '2026-05-03T12:00:00.000Z',
    meta: { date: '2026-05-03T12:00:00.000Z', tags: ['gratitude'] },
  };

  const result = upsertDailyJournalEntry([existing], incoming);

  assert.equal(result.length, 1);
  assert.equal(result[0].content, 'Morning thoughts\n\nNight reflection');
  assert.deepEqual(result[0].meta.tags, ['mood', 'gratitude']);
});

test('journal day groups merge todos shopping events and transactions into day sections', () => {
  const items = [
    {
      id: 'journal-1',
      type: ItemType.JOURNAL,
      content: 'Felt better after shipping.',
      status: 'done' as const,
      created_at: '2026-05-03T01:00:00.000Z',
      completed_at: '2026-05-03T01:00:00.000Z',
      meta: { date: '2026-05-03T01:00:00.000Z', tags: ['work'] },
    },
    {
      id: 'todo-1',
      type: ItemType.TODO,
      content: 'Ship release',
      status: 'done' as const,
      created_at: '2026-05-03T02:00:00.000Z',
      completed_at: '2026-05-03T03:00:00.000Z',
      meta: {},
    },
    {
      id: 'shopping-1',
      type: ItemType.SHOPPING,
      content: 'Buy coffee beans',
      status: 'done' as const,
      created_at: '2026-05-03T04:00:00.000Z',
      completed_at: '2026-05-03T05:00:00.000Z',
      meta: { amount: 120000, shoppingCategory: 'not_urgent' as const },
    },
    {
      id: 'event-1',
      type: ItemType.EVENT,
      content: 'Demo call',
      status: 'pending' as const,
      created_at: '2026-05-03T06:00:00.000Z',
      meta: { start: '2026-05-03T07:00:00.000Z' },
    },
    {
      id: 'finance-1',
      type: ItemType.FINANCE,
      content: 'Team lunch',
      status: 'done' as const,
      created_at: '2026-05-03T08:00:00.000Z',
      completed_at: '2026-05-03T08:00:00.000Z',
      meta: { amount: 85000, financeType: 'expense' as const, paymentMethod: 'BCA' },
    }
  ];

  const groups = getJournalDayGroups(items, '', '', '', '', 'newest');

  assert.equal(groups.length, 1);
  assert.equal(groups[0].journalEntries.length, 1);
  assert.equal(groups[0].todos.length, 1);
  assert.equal(groups[0].shopping.length, 1);
  assert.equal(groups[0].events.length, 1);
  assert.equal(groups[0].transactions.length, 1);
});
