import assert from 'node:assert/strict';
import test from 'node:test';

import { ItemType, type BrainDumpItem } from '../../types';
import { buildSubtaskDraft, cleanSubtaskDraft, getDefaultTaskPanel } from '../useTaskWorkspace';

const task = (meta: BrainDumpItem['meta'] = {}): BrainDumpItem => ({
  id: 'parent',
  type: ItemType.TODO,
  content: 'Prepare report',
  status: 'pending',
  created_at: '2026-09-16T00:00:00.000Z',
  meta,
});

test('task workspace defaults deep-work items with saved children to the subtask panel', () => {
  assert.equal(getDefaultTaskPanel([task()], true), 'subtasks');
  assert.equal(getDefaultTaskPanel([], true), 'none');
  assert.equal(getDefaultTaskPanel([task()], false), 'none');
});

test('subtask draft keeps edit state before metadata and child fallbacks', () => {
  const item = task({ subtasks: ['metadata step'] });
  const children = [{ ...task(), id: 'child', content: 'child step' }];

  assert.deepEqual(buildSubtaskDraft(item, children, ['edited step']), ['edited step']);
  assert.deepEqual(buildSubtaskDraft(item, children), ['metadata step']);
  assert.deepEqual(buildSubtaskDraft(task(), children), ['child step']);
});

test('empty deep-work drafts remain bounded and accepted steps are trimmed', () => {
  assert.deepEqual(buildSubtaskDraft(task({ deepWorkStepCount: 8 }), []), ['', '', '', '', '']);
  assert.deepEqual(cleanSubtaskDraft(['  first  ', '', ' second ']), ['first', 'second']);
});
