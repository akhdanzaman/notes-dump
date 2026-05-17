import test from 'node:test';
import assert from 'node:assert/strict';

import { BrainDumpItem, ItemType } from '../../types';
import { getFocusMonthData } from '../selectors/focusSelectors';

const makeTodo = (id: string, status: 'pending' | 'done', meta: BrainDumpItem['meta'] = {}): BrainDumpItem => ({
  id,
  type: ItemType.TODO,
  content: id,
  status,
  created_at: '2099-01-01T00:00:00.000Z',
  completed_at: status === 'done' ? '2099-01-15T10:00:00.000Z' : undefined,
  meta: {
    date: '2099-01-15T09:00:00.000Z',
    priority: 'normal',
    ...meta,
  },
});

test('focus month summary counts top-level tasks instead of double-counting child subtasks', () => {
  const parent = makeTodo('parent', 'pending', {
    childTodoIds: ['child-pending', 'child-done'],
    deepWorkParent: true,
    deepWorkCompletionMode: 'final_output_check',
  });
  const childPending = makeTodo('child-pending', 'pending', {
    parentTodoId: 'parent',
    deepWorkStepIndex: 1,
  });
  const childDone = makeTodo('child-done', 'done', {
    parentTodoId: 'parent',
    deepWorkStepIndex: 2,
  });
  const standaloneDone = makeTodo('standalone-done', 'done');

  const data = getFocusMonthData(
    [parent, childPending, childDone, standaloneDone],
    new Date('2099-01-01T00:00:00.000Z'),
    '',
    ''
  );

  assert.equal(data.summary.todo, 1);
  assert.equal(data.summary.done, 1);
  assert.deepEqual(data.doneList.map(item => item.id), ['standalone-done']);
});
