import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeFetchedItemsPreservingUnsavedLocal } from '../../hooks/useBrainDumpData';
import { BrainDumpItem, ItemType } from '../../types';

const item = (id: string, content: string, status: 'pending' | 'done' = 'pending'): BrainDumpItem => ({
  id,
  type: ItemType.TODO,
  content,
  status,
  created_at: '2026-05-01T00:00:00.000Z',
  meta: { date: '2026-05-02T00:00:00.000Z' },
});

test('fetch merge accepts remote edits when local item has not changed since last sync', () => {
  const lastSynced = [item('todo-1', 'old')];
  const current = [item('todo-1', 'old')];
  const fetched = [item('todo-1', 'remote edit')];

  const merged = mergeFetchedItemsPreservingUnsavedLocal(fetched, current, lastSynced);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].content, 'remote edit');
});

test('fetch merge preserves local unsaved edits over fetched data', () => {
  const lastSynced = [item('todo-1', 'old')];
  const current = [item('todo-1', 'local unsaved', 'done')];
  const fetched = [item('todo-1', 'remote edit')];

  const merged = mergeFetchedItemsPreservingUnsavedLocal(fetched, current, lastSynced);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].content, 'local unsaved');
  assert.equal(merged[0].status, 'done');
});

test('fetch merge respects remote deletions unless local item changed after last sync', () => {
  const lastSynced = [item('todo-1', 'old'), item('todo-2', 'keep local base')];
  const current = [item('todo-1', 'old'), item('todo-2', 'local changed')];
  const fetched: BrainDumpItem[] = [];

  const merged = mergeFetchedItemsPreservingUnsavedLocal(fetched, current, lastSynced);

  assert.deepEqual(merged.map(i => i.id), ['todo-2']);
  assert.equal(merged[0].content, 'local changed');
});

test('fetch merge keeps locally-created items that have never been synced', () => {
  const lastSynced: BrainDumpItem[] = [];
  const current = [item('todo-local', 'new local')];
  const fetched: BrainDumpItem[] = [];

  const merged = mergeFetchedItemsPreservingUnsavedLocal(fetched, current, lastSynced);

  assert.deepEqual(merged.map(i => i.id), ['todo-local']);
});
