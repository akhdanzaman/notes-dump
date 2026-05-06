import test from 'node:test';
import assert from 'node:assert/strict';

import { ItemType, BrainDumpItem } from '../../types';
import { buildMixedTodayFocusItems, buildSummaryFocusDisplay } from '../summaryFocusUtils';

const makeItem = (id: string, type: ItemType, date = '2026-05-06T09:00:00.000Z'): BrainDumpItem => ({
  id,
  type,
  content: id,
  status: 'pending',
  created_at: '2026-05-06T00:00:00.000Z',
  meta: type === ItemType.SHOPPING ? { shoppingCategory: 'urgent', date } : { date },
});

const emptyGroups = {
  today: [] as BrainDumpItem[],
  tomorrow: [] as BrainDumpItem[],
  later: [] as BrainDumpItem[],
  routines: [] as BrainDumpItem[],
};

test('summary today focus is date-aware and keeps focus visible before later urgent shopping', () => {
  const shopping = ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5']
    .map(id => makeItem(id, ItemType.SHOPPING, '2026-05-10T00:00:00.000Z'));
  const focus = [makeItem('focus-1', ItemType.TODO, '2026-05-07T09:00:00.000Z')];

  const mixed = buildMixedTodayFocusItems(shopping, [], 5, focus);

  assert.equal(mixed[0].id, 'focus-1');
  assert.ok(mixed.some(item => item.type === ItemType.SHOPPING));
  assert.ok(mixed.some(item => item.id === 'focus-1'));
});

test('summary today focus mixes shopping and focus items instead of letting shopping fill every slot', () => {
  const shopping = ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5'].map(id => makeItem(id, ItemType.SHOPPING, '2026-05-08T00:00:00.000Z'));
  const focus = [makeItem('focus-1', ItemType.TODO, '2026-05-08T00:00:00.000Z'), makeItem('focus-2', ItemType.EVENT, '2026-05-08T00:00:00.000Z')];

  const mixed = buildMixedTodayFocusItems(shopping, focus, 5);

  assert.deepEqual(mixed.map(item => item.id), ['focus-1', 'focus-2', 'shop-1', 'shop-2', 'shop-3']);
});

test('summary display keeps Today’s Focus when urgent shopping exists and pulls the next focus task into view', () => {
  const shopping = ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5']
    .map(id => makeItem(id, ItemType.SHOPPING, '2026-05-10T00:00:00.000Z'));
  const focus = [makeItem('focus-1', ItemType.TODO, '2026-05-07T09:00:00.000Z')];

  const display = buildSummaryFocusDisplay([], { ...emptyGroups, tomorrow: focus }, shopping, 5);

  assert.equal(display.displayTitle, "Today's Focus");
  assert.equal(display.isDoneState, false);
  assert.equal(display.displayItems[0].id, 'focus-1');
  assert.ok(display.displayItems.some(item => item.type === ItemType.SHOPPING));
});

test('summary display preserves Tomorrow fallback when there is no today focus or urgent shopping', () => {
  const focus = [makeItem('focus-1', ItemType.TODO, '2026-05-07T09:00:00.000Z')];

  const display = buildSummaryFocusDisplay([], { ...emptyGroups, tomorrow: focus }, [], 5);

  assert.equal(display.displayTitle, 'Tomorrow');
  assert.deepEqual(display.displayItems.map(item => item.id), ['focus-1']);
});

test('summary focus excludes child subtasks from top-level Today’s Focus lists', () => {
  const parent = makeItem('parent-focus', ItemType.TODO, '2026-05-07T09:00:00.000Z');
  const child = {
    ...makeItem('child-subtask', ItemType.TODO, '2026-05-07T10:00:00.000Z'),
    meta: { date: '2026-05-07T10:00:00.000Z', parentTodoId: 'parent-focus' },
  };

  const mixed = buildMixedTodayFocusItems([], [child, parent], 5);
  assert.deepEqual(mixed.map(item => item.id), ['parent-focus']);

  const display = buildSummaryFocusDisplay([], { ...emptyGroups, tomorrow: [child] }, [], 5);
  assert.notEqual(display.displayTitle, 'Tomorrow');
  assert.deepEqual(display.displayItems, []);
});
