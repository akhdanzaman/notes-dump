import test from 'node:test';
import assert from 'node:assert/strict';

import { ItemType } from '../../types';
import { recoverMisclassifiedJournalNotes, upsertDailyJournalEntry } from '../journalUtils';
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

test('recoverMisclassifiedJournalNotes restores legacy journal rows that were saved back as notes', () => {
  const recovered = recoverMisclassifiedJournalNotes([
    {
      id: 'legacy-journal-note',
      type: ItemType.NOTE,
      content: 'Morning note\n\nNight reflection',
      status: 'done' as const,
      created_at: '2026-05-02T01:00:00.000Z',
      completed_at: '2026-05-02T12:00:00.000Z',
      meta: { date: '2026-05-02T01:00:00.000Z', tags: ['mood', 'gratitude'] },
    },
  ]);

  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].type, ItemType.JOURNAL);
  assert.equal(recovered[0].status, 'done');
  assert.equal(recovered[0].completed_at, '2026-05-02T12:00:00.000Z');
});

test('recoverMisclassifiedJournalNotes leaves real notes alone', () => {
  const original = {
    id: 'note-1',
    type: ItemType.NOTE,
    content: 'Remember to ask about pricing',
    status: 'pending' as const,
    created_at: '2026-05-02T01:00:00.000Z',
    meta: { tags: ['work'] },
  };

  const recovered = recoverMisclassifiedJournalNotes([original]);

  assert.equal(recovered[0], original);
  assert.equal(recovered[0].type, ItemType.NOTE);
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
