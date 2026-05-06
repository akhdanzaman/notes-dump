import test from 'node:test';
import assert from 'node:assert/strict';

import { ItemType, BrainDumpItem } from '../../types';
import { buildMixedTodayFocusItems, buildSummaryFocusDisplay } from '../summaryFocusUtils';

const makeItem = (id: string, type: ItemType): BrainDumpItem => ({
  id,
  type,
  content: id,
  status: 'pending',
  created_at: '2026-05-06T00:00:00.000Z',
  meta: type === ItemType.SHOPPING ? { shoppingCategory: 'urgent' } : { date: '2026-05-06T09:00:00.000Z' },
});

const emptyGroups = {
  today: [] as BrainDumpItem[],
  tomorrow: [] as BrainDumpItem[],
  later: [] as BrainDumpItem[],
  routines: [] as BrainDumpItem[],
};

test('summary today focus mixes shopping and focus items instead of letting shopping fill every slot', () => {
  const shopping = ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5'].map(id => makeItem(id, ItemType.SHOPPING));
  const focus = [makeItem('focus-1', ItemType.TODO), makeItem('focus-2', ItemType.EVENT)];

  const mixed = buildMixedTodayFocusItems(shopping, focus, 5);

  assert.deepEqual(mixed.map(item => item.id), ['shop-1', 'shop-2', 'shop-3', 'focus-1', 'focus-2']);
});

test('summary display keeps Today’s Focus when both urgent shopping and focus tasks exist', () => {
  const shopping = ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5'].map(id => makeItem(id, ItemType.SHOPPING));
  const focus = [makeItem('focus-1', ItemType.TODO)];

  const display = buildSummaryFocusDisplay([], { ...emptyGroups, today: focus }, shopping, 5);

  assert.equal(display.displayTitle, "Today's Focus");
  assert.equal(display.isDoneState, false);
  assert.ok(display.displayItems.some(item => item.type === ItemType.SHOPPING));
  assert.ok(display.displayItems.some(item => item.id === 'focus-1'));
});
