import test from 'node:test';
import assert from 'node:assert/strict';

import { resetDueRoutineItems } from '../../hooks/useBrainDumpData';
import { BrainDumpItem, ItemType } from '../../types';

test('due todo routine reset clears completion side effects for the next cycle', () => {
  const routine: BrainDumpItem = {
    id: 'todo-routine-1',
    type: ItemType.TODO,
    content: 'Review budget',
    status: 'done',
    created_at: '2026-05-01T00:00:00.000Z',
    completed_at: '2026-05-01T00:00:00.000Z',
    meta: {
      isRoutine: true,
      routineInterval: 'daily',
      date: '2026-05-01T00:00:00.000Z',
      progress: 100,
      progressNotes: 'done today',
      lastGeneratedHistoryId: 'journal-history-1',
    },
  };

  const [reset] = resetDueRoutineItems([routine], new Date('2026-05-02T00:00:01.000Z'));

  assert.equal(reset.status, 'pending');
  assert.equal(reset.completed_at, undefined);
  assert.equal(reset.meta.date, '2026-05-02T00:00:00.000Z');
  assert.equal(reset.meta.progress, 0);
  assert.equal(reset.meta.progressNotes, undefined);
  assert.equal(reset.meta.lastGeneratedHistoryId, undefined);
});

test('shopping routine reset preserves history item but clears parent history pointer', () => {
  const routine: BrainDumpItem = {
    id: 'shopping-routine-1',
    type: ItemType.SHOPPING,
    content: 'Laundry',
    status: 'done',
    created_at: '2026-05-01T00:00:00.000Z',
    completed_at: '2026-05-01T00:00:00.000Z',
    meta: {
      shoppingCategory: 'routine',
      routineInterval: 'daily',
      lastGeneratedHistoryId: 'finance-history-1',
    },
  };
  const history: BrainDumpItem = {
    id: 'finance-history-1',
    type: ItemType.FINANCE,
    content: 'Laundry',
    status: 'done',
    created_at: '2026-05-01T00:00:00.000Z',
    completed_at: '2026-05-01T00:00:00.000Z',
    meta: { financeType: 'expense', amount: 36000 },
  };

  const resetItems = resetDueRoutineItems([routine, history], new Date('2026-05-02T00:00:01.000Z'));
  const resetRoutine = resetItems.find(item => item.id === 'shopping-routine-1');

  assert.equal(resetRoutine?.status, 'pending');
  assert.equal(resetRoutine?.meta.lastGeneratedHistoryId, undefined);
  assert.ok(resetItems.find(item => item.id === 'finance-history-1'));
});

test('routine reset uses scheduled due date instead of completion time', () => {
  const routine: BrainDumpItem = {
    id: 'late-completed-routine',
    type: ItemType.TODO,
    content: 'Daily review',
    status: 'done',
    created_at: '2026-05-01T00:00:00.000Z',
    completed_at: '2026-05-01T23:30:00.000Z',
    meta: {
      isRoutine: true,
      routineInterval: 'daily',
      date: '2026-05-01T00:00:00.000Z',
      progress: 100,
    },
  };

  const [reset] = resetDueRoutineItems([routine], new Date('2026-05-02T00:00:01.000Z'));

  assert.equal(reset.status, 'pending');
  assert.equal(reset.completed_at, undefined);
  assert.equal(reset.meta.date, '2026-05-02T00:00:00.000Z');
});

test('weekly routine reset follows selected schedule even when completed late in the day', () => {
  const routine: BrainDumpItem = {
    id: 'weekly-routine',
    type: ItemType.TODO,
    content: 'Weekly cleanup',
    status: 'done',
    created_at: '2026-05-11T00:00:00.000Z',
    completed_at: '2026-05-11T22:00:00.000Z',
    meta: {
      isRoutine: true,
      routineInterval: 'weekly',
      routineDaysOfWeek: [1, 4],
      date: '2026-05-11T00:00:00.000Z',
      progress: 100,
    },
  };

  const [reset] = resetDueRoutineItems([routine], new Date('2026-05-14T00:00:01.000Z'));

  assert.equal(reset.status, 'pending');
  assert.equal(reset.meta.date, '2026-05-14T00:00:00.000Z');
});
