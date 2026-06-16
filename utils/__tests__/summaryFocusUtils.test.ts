import test from 'node:test';
import assert from 'node:assert/strict';

import { ItemType, BrainDumpItem } from '../../types';
import { buildMixedTodayFocusItems, buildSummaryFocusDisplay } from '../summaryFocusUtils';

const referenceDate = new Date('2026-05-06T10:00:00.000Z');
const today = '2026-05-06T09:00:00.000Z';
const tomorrow = '2026-05-07T09:00:00.000Z';
const later = '2026-05-10T09:00:00.000Z';
const yesterday = '2026-05-05T09:00:00.000Z';

const makeItem = (id: string, type: ItemType, date = today): BrainDumpItem => ({
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

test('summary today focus excludes later urgent shopping and keeps tomorrow focus visible', () => {
  const shopping = ['shop-1', 'shop-2', 'shop-3']
    .map(id => makeItem(id, ItemType.SHOPPING, later));
  const focus = [makeItem('focus-1', ItemType.TODO, tomorrow)];

  const mixed = buildMixedTodayFocusItems(shopping, [], 5, focus, referenceDate);

  assert.deepEqual(mixed.map(item => item.id), ['focus-1']);
  assert.ok(mixed.every(item => item.type !== ItemType.SHOPPING));
});

test('summary today focus mixes only today and tomorrow shopping and focus items', () => {
  const shopping = [
    makeItem('shop-today', ItemType.SHOPPING, today),
    makeItem('shop-tomorrow', ItemType.SHOPPING, tomorrow),
    makeItem('shop-later', ItemType.SHOPPING, later),
    makeItem('shop-yesterday', ItemType.SHOPPING, yesterday),
  ];
  const focus = [
    makeItem('focus-today', ItemType.TODO, today),
    makeItem('focus-tomorrow', ItemType.EVENT, tomorrow),
    makeItem('focus-later', ItemType.TODO, later),
  ];

  const mixed = buildMixedTodayFocusItems(shopping, focus, 10, [], referenceDate);

  assert.deepEqual(mixed.map(item => item.id), [
    'focus-today',
    'shop-today',
    'focus-tomorrow',
    'shop-tomorrow',
  ]);
});

test('summary display ignores later urgent shopping and preserves Tomorrow fallback', () => {
  const shopping = ['shop-1', 'shop-2', 'shop-3']
    .map(id => makeItem(id, ItemType.SHOPPING, later));
  const focus = [makeItem('focus-1', ItemType.TODO, tomorrow)];

  const display = buildSummaryFocusDisplay([], { ...emptyGroups, tomorrow: focus }, shopping, 5, referenceDate);

  assert.equal(display.displayTitle, 'Tomorrow');
  assert.equal(display.isDoneState, false);
  assert.deepEqual(display.displayItems.map(item => item.id), ['focus-1']);
});

test('summary display keeps Today’s Focus when today shopping exists and pulls tomorrow focus into view', () => {
  const shopping = [makeItem('shop-1', ItemType.SHOPPING, today)];
  const focus = [makeItem('focus-1', ItemType.TODO, tomorrow)];

  const display = buildSummaryFocusDisplay([], { ...emptyGroups, tomorrow: focus }, shopping, 5, referenceDate);

  assert.equal(display.displayTitle, "Today's Focus");
  assert.equal(display.isDoneState, false);
  assert.deepEqual(display.displayItems.map(item => item.id), ['shop-1', 'focus-1']);
});

test('summary display preserves Tomorrow fallback when there is no today focus or urgent shopping', () => {
  const focus = [makeItem('focus-1', ItemType.TODO, tomorrow)];

  const display = buildSummaryFocusDisplay([], { ...emptyGroups, tomorrow: focus }, [], 5, referenceDate);

  assert.equal(display.displayTitle, 'Tomorrow');
  assert.deepEqual(display.displayItems.map(item => item.id), ['focus-1']);
});

test('summary display keeps only today/tomorrow done tasks and events in Today’s Focus when nothing is active', () => {
  const doneTask = {
    ...makeItem('cek-artland-mkg', ItemType.EVENT, today),
    status: 'done' as const,
    completed_at: '2026-05-06T12:00:00.000Z',
  };
  const olderDoneTask = {
    ...makeItem('older-done-task', ItemType.TODO, '2026-05-03T09:00:00.000Z'),
    status: 'done' as const,
    completed_at: '2026-05-03T12:00:00.000Z',
  };

  const display = buildSummaryFocusDisplay([olderDoneTask, doneTask], emptyGroups, [], 5, referenceDate);

  assert.equal(display.displayTitle, "Today's Focus");
  assert.equal(display.isDoneState, true);
  assert.deepEqual(display.displayItems.map(item => item.id), ['cek-artland-mkg']);
});

test('summary focus excludes child subtasks from top-level Today’s Focus lists', () => {
  const parent = makeItem('parent-focus', ItemType.TODO, tomorrow);
  const child = {
    ...makeItem('child-subtask', ItemType.TODO, tomorrow),
    meta: { date: tomorrow, parentTodoId: 'parent-focus' },
  };

  const mixed = buildMixedTodayFocusItems([], [child, parent], 5, [], referenceDate);
  assert.deepEqual(mixed.map(item => item.id), ['parent-focus']);

  const display = buildSummaryFocusDisplay([], { ...emptyGroups, tomorrow: [child] }, [], 5, referenceDate);
  assert.notEqual(display.displayTitle, 'Tomorrow');
  assert.deepEqual(display.displayItems, []);
});
