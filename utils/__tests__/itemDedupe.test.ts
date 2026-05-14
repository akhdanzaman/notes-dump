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

test('dedupeBrainDumpItems collapses exact duplicate routine shopping entries', () => {
  const duplicates: BrainDumpItem[] = [
    {
      id: 'laundry-1',
      type: ItemType.SHOPPING,
      content: 'Laundry',
      status: 'pending',
      created_at: '2026-03-08T08:29:26.000Z',
      meta: { shoppingCategory: 'routine', date: '2026-01-01T19:00:00.000Z', amount: 36000, tags: ['routine'] },
    },
    {
      id: 'laundry-2',
      type: ItemType.SHOPPING,
      content: 'Laundry',
      status: 'pending',
      created_at: '2026-03-08T08:29:26.450Z',
      meta: { shoppingCategory: 'routine', date: '2026-01-01T19:00:00.000Z', amount: 36000, tags: ['routine'] },
    },
    {
      id: 'internet',
      type: ItemType.SHOPPING,
      content: 'Internet',
      status: 'pending',
      created_at: '2026-03-08T08:30:18.000Z',
      meta: { shoppingCategory: 'routine', date: '2026-04-13T12:57:00.000Z', amount: 70000 },
    },
  ];

  const { items, removedCount } = dedupeBrainDumpItems(duplicates);

  assert.equal(removedCount, 1);
  assert.equal(items.length, 2);
  const laundry = items.find(item => item.content === 'Laundry');
  assert.equal(laundry?.id, 'laundry-1');
  assert.equal(laundry?.status, 'pending');
});

test('dedupeBrainDumpItems does not collapse shopping items with different due dates', () => {
  const items: BrainDumpItem[] = [
    {
      id: 'makan-1',
      type: ItemType.SHOPPING,
      content: 'Makan',
      status: 'pending',
      created_at: '2026-04-14T23:49:26.000Z',
      meta: { shoppingCategory: 'routine', date: '2026-04-14T01:00:00.000Z', amount: 30000 },
    },
    {
      id: 'makan-2',
      type: ItemType.SHOPPING,
      content: 'Makan',
      status: 'pending',
      created_at: '2026-04-15T23:49:26.000Z',
      meta: { shoppingCategory: 'routine', date: '2026-04-15T01:00:00.000Z', amount: 30000 },
    },
  ];

  const result = dedupeBrainDumpItems(items);

  assert.equal(result.removedCount, 0);
  assert.deepEqual(result.items.map(item => item.id), ['makan-1', 'makan-2']);
});

test('dedupeBrainDumpItems collapses exact duplicate finance transactions', () => {
  const items: BrainDumpItem[] = [
    {
      id: 'tx-1',
      type: ItemType.FINANCE,
      content: 'beli vitamin c',
      status: 'done',
      created_at: '2026-03-09T11:10:07.871Z',
      completed_at: '2026-03-09T13:10:07.000Z',
      meta: { financeType: 'expense', date: '2026-03-09T13:10:07.000Z', amount: 12000, paymentMethod: 'cash' },
    },
    {
      id: 'tx-2',
      type: ItemType.FINANCE,
      content: 'beli vitamin c',
      status: 'done',
      created_at: '2026-03-09T11:13:01.265Z',
      completed_at: '2026-03-09T13:10:07.000Z',
      meta: { financeType: 'expense', date: '2026-03-09T13:10:07.000Z', amount: 12000, paymentMethod: 'cash' },
    },
  ];

  const result = dedupeBrainDumpItems(items);

  assert.equal(result.removedCount, 1);
  assert.equal(result.items.length, 1);
});
