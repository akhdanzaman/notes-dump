import test from 'node:test';
import assert from 'node:assert/strict';

import { reconcileSpreadsheetData } from '../spreadsheetReconciler';
import { ItemType, type DbSchema } from '../../types';

test('notes sheet keeps uppercase JOURNAL rows as journal items after refresh', () => {
  const db: DbSchema = {
    data: [
      {
        id: 'journal-1',
        type: ItemType.JOURNAL,
        content: 'Morning note',
        status: 'done',
        created_at: '2026-05-02T01:00:00.000Z',
        completed_at: '2026-05-02T01:00:00.000Z',
        meta: { date: '2026-05-02T01:00:00.000Z', tags: ['mood'] },
      },
    ],
  };

  const result = reconcileSpreadsheetData(db, [
    {
      range: 'Notes & Journals!A:E',
      values: [
        ['Date', 'Type', 'Content', 'Tags', 'ID'],
        ['5/2/2026 8:00:00 AM', 'JOURNAL', 'Morning note\n\nNight reflection', 'mood, gratitude', 'journal-1'],
      ],
    },
  ]);

  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].type, ItemType.JOURNAL);
  assert.equal(result.data[0].status, 'done');
  assert.equal(result.data[0].content, 'Morning note\n\nNight reflection');
  assert.deepEqual(result.data[0].meta.tags, ['mood', 'gratitude']);
});

test('notes sheet creates new journal rows with sheet id and done status', () => {
  const db: DbSchema = { data: [] };

  const result = reconcileSpreadsheetData(db, [
    {
      range: 'Notes & Journals!A:E',
      values: [
        ['Date', 'Type', 'Content', 'Tags', 'ID'],
        ['5/2/2026 8:00:00 PM', 'JOURNAL', 'Late reflection', 'night', 'journal-2'],
      ],
    },
  ]);

  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].id, 'journal-2');
  assert.equal(result.data[0].type, ItemType.JOURNAL);
  assert.equal(result.data[0].status, 'done');
  assert.equal(result.data[0].completed_at, result.data[0].created_at);
});
