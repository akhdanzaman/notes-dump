import test from 'node:test';
import assert from 'node:assert/strict';

import { ItemType, BrainDumpItem } from '../../types';
import { dedupeBrainDumpItems } from '../itemDedupe';

test('dedupeBrainDumpItems collapses obvious duplicate events and keeps completed state', () => {
  const duplicateEvents: BrainDumpItem[] = [
    {
      id: 'pending-copy-1',
      type: ItemType.EVENT,
      content: 'Event di SCBD buat bikin relasi',
      status: 'pending',
      created_at: '2026-05-13T01:00:00.000Z',
      meta: { date: '2026-05-02T00:00:00.000Z', tags: ['event', 'business'], priority: 'normal' },
    },
    {
      id: 'pending-copy-2',
      type: ItemType.EVENT,
      content: 'Event di SCBD buat bikin relasi',
      status: 'pending',
      created_at: '2026-05-13T02:00:00.000Z',
      meta: { date: '2026-05-02T00:00:00.000Z', tags: ['business', 'event'], priority: 'high' },
    },
    {
      id: 'done-copy',
      type: ItemType.EVENT,
      content: 'Event di SCBD buat bikin relasi',
      status: 'done',
      created_at: '2026-05-13T03:00:00.000Z',
      completed_at: '2026-05-13T04:00:00.000Z',
      meta: { date: '2026-05-02T00:00:00.000Z', tags: ['event', 'business'], priority: 'normal' },
    },
  ];

  const { items, removedCount } = dedupeBrainDumpItems(duplicateEvents);

  assert.equal(removedCount, 2);
  assert.equal(items.length, 1);
  assert.equal(items[0].status, 'done');
  assert.equal(items[0].id, 'done-copy');
  assert.equal(items[0].meta.priority, 'high');
  assert.deepEqual(new Set(items[0].meta.tags), new Set(['event', 'business']));
});

test('dedupeBrainDumpItems does not collapse separate events on different dates', () => {
  const events: BrainDumpItem[] = [
    {
      id: 'event-1',
      type: ItemType.EVENT,
      content: 'Event di SCBD buat bikin relasi',
      status: 'pending',
      created_at: '2026-05-13T01:00:00.000Z',
      meta: { date: '2026-05-02T00:00:00.000Z' },
    },
    {
      id: 'event-2',
      type: ItemType.EVENT,
      content: 'Event di SCBD buat bikin relasi',
      status: 'pending',
      created_at: '2026-05-13T02:00:00.000Z',
      meta: { date: '2026-05-03T00:00:00.000Z' },
    },
  ];

  const { items, removedCount } = dedupeBrainDumpItems(events);

  assert.equal(removedCount, 0);
  assert.deepEqual(items.map(item => item.id), ['event-1', 'event-2']);
});
