import test from 'node:test';
import assert from 'node:assert/strict';

import { generateExportData } from '../exportUtils';
import { applyDeepWorkChildProgress, applyDeepWorkCompletionSemantics, normalizeDeepWorkTodoMeta, parseSubtasksFromSheet } from '../deepWorkTodoModel';
import { createDeepWorkSubtaskItems } from '../../services/deepWorkTransformer';
import { reconcileSpreadsheetData } from '../../services/spreadsheetReconciler';
import { AppSettings, BrainDumpItem, BudgetConfig, DbSchema, ItemType } from '../../types';

const budgetConfig: BudgetConfig = {
  monthlyIncome: 0,
  rules: [],
};

const appSettings: AppSettings = {
  defaultCollapsed: false,
  hideMoney: false,
};

const makeDeepWorkItems = (): BrainDumpItem[] => ([
  {
    id: 'parent-1',
    type: ItemType.TODO,
    content: 'summary IIMS 2026',
    status: 'pending',
    created_at: '2026-05-01T01:00:00.000Z',
    meta: {
      tags: ['work'],
      priority: 'high',
      deepWorkParent: true,
      deepWorkPlanId: 'parent-1',
      deepWorkStatus: 'suggested',
      childTodoIds: ['child-1', 'child-2'],
      deepWorkCompletionMode: 'final_output_check',
      deepWorkNextAction: 'Open the IIMS source notes',
      deepWorkFinalOutput: 'A concise IIMS summary with key points and follow-up questions',
      deepWorkSessionEstimateMinutes: 60,
      deepWorkBlockerStatus: 'clear',
      deepWorkBlockerCheck: 'Confirm source notes are available',
      subtasks: ['Open the source notes', 'Draft the final summary'],
    },
  },
  {
    id: 'child-1',
    type: ItemType.TODO,
    content: 'Open the source notes',
    status: 'done',
    created_at: '2026-05-01T01:01:00.000Z',
    completed_at: '2026-05-01T01:25:00.000Z',
    meta: {
      tags: ['work'],
      parentTodoId: 'parent-1',
      deepWorkPlanId: 'parent-1',
      deepWorkStatus: 'active',
      deepWorkStepIndex: 1,
      deepWorkStepCount: 2,
    },
  },
  {
    id: 'child-2',
    type: ItemType.TODO,
    content: 'Draft the final summary',
    status: 'pending',
    created_at: '2026-05-01T01:02:00.000Z',
    meta: {
      tags: ['work'],
      parentTodoId: 'parent-1',
      deepWorkPlanId: 'parent-1',
      deepWorkStatus: 'active',
      deepWorkStepIndex: 2,
      deepWorkStepCount: 2,
    },
  },
]);

test('deep work metadata is optional and cache normalization is backward-compatible', () => {
  const plainMeta = { tags: ['personal'], priority: 'normal' as const };
  assert.deepEqual(normalizeDeepWorkTodoMeta(plainMeta), plainMeta);

  const messyMeta = normalizeDeepWorkTodoMeta({
    deepWorkParent: true,
    childTodoIds: [' child-1 ', '', 'child-1'],
    deepWorkCompletionMode: 'final_output_check',
    deepWorkSessionEstimateMinutes: '60 minutes' as unknown as number,
    deepWorkBlockerStatus: 'clear',
    subtasks: [' First step ', '', 'First step'],
  });

  assert.deepEqual(messyMeta.childTodoIds, ['child-1']);
  assert.equal(messyMeta.deepWorkSessionEstimateMinutes, 60);
  assert.deepEqual(messyMeta.subtasks, ['First step']);
});


test('parseSubtasksFromSheet accepts JSON arrays and human edited lists', () => {
  assert.deepEqual(parseSubtasksFromSheet('["First", "Second"]'), ['First', 'Second']);
  assert.deepEqual(parseSubtasksFromSheet('1. First step\n- Second step; Third step'), ['First step', 'Second step', 'Third step']);
});

test('spreadsheet export/import preserves nested todo structure and keeps parent completion intentional', () => {
  const items = makeDeepWorkItems();
  const db: DbSchema = {
    data: [],
    budgetConfig,
    skills: [],
    wallets: [],
    monthlyThemes: {},
    appSettings,
  };

  const sheets = generateExportData(items, [], [], budgetConfig, {}, appSettings);
  const todosSheet = sheets.find(sheet => sheet.name === 'Todos');
  assert.ok(todosSheet);
  const headers = todosSheet.data[0];
  assert.ok(headers.includes('Next_Action'));
  assert.ok(headers.includes('Final_Output'));
  assert.ok(headers.includes('Session_Estimate_Min'));
  assert.ok(headers.includes('Blocker_Check'));
  assert.ok(headers.includes('Subtasks'));

  const valueRanges = sheets.map(sheet => ({ range: `'${sheet.name}'!A1`, values: sheet.data }));
  const reconciled = reconcileSpreadsheetData(db, valueRanges);

  const parent = reconciled.data.find(item => item.id === 'parent-1');
  const child = reconciled.data.find(item => item.id === 'child-1');

  assert.ok(parent);
  assert.ok(child);
  assert.equal(parent?.status, 'pending');
  assert.equal(parent?.meta.progress, 50);
  assert.equal(parent?.meta.deepWorkNextAction, 'Open the IIMS source notes');
  assert.equal(parent?.meta.deepWorkFinalOutput, 'A concise IIMS summary with key points and follow-up questions');
  assert.equal(parent?.meta.deepWorkSessionEstimateMinutes, 60);
  assert.equal(parent?.meta.deepWorkBlockerCheck, 'Confirm source notes are available');
  assert.deepEqual(parent?.meta.childTodoIds, ['child-1', 'child-2']);
  assert.deepEqual(parent?.meta.subtasks, ['Open the source notes', 'Draft the final summary']);
  assert.equal(child?.meta.parentTodoId, 'parent-1');
});

test('child completion updates progress but parent only auto-completes when explicitly configured', () => {
  const items = makeDeepWorkItems();
  const halfway = applyDeepWorkCompletionSemantics(applyDeepWorkChildProgress(items));
  const halfwayParent = halfway.find(item => item.id === 'parent-1');
  assert.equal(halfwayParent?.meta.progress, 50);
  assert.equal(halfwayParent?.status, 'pending');

  const allSubtasksMode = items.map(item => item.id === 'parent-1'
    ? { ...item, meta: { ...item.meta, deepWorkCompletionMode: 'all_subtasks' as const } }
    : item.id === 'child-2'
      ? { ...item, status: 'done' as const, completed_at: '2026-05-01T02:00:00.000Z' }
      : item);

  const completed = applyDeepWorkCompletionSemantics(applyDeepWorkChildProgress(allSubtasksMode), '2026-05-01T03:00:00.000Z');
  const completedParent = completed.find(item => item.id === 'parent-1');
  assert.equal(completedParent?.meta.progress, 100);
  assert.equal(completedParent?.status, 'done');
  assert.equal(completedParent?.completed_at, '2026-05-01T03:00:00.000Z');
});

test('all-subtasks deep work parent reopens when a child step is undone', () => {
  const allDoneItems = makeDeepWorkItems().map(item => {
    if (item.id === 'parent-1') {
      return { ...item, meta: { ...item.meta, deepWorkCompletionMode: 'all_subtasks' as const } };
    }
    if (item.id === 'child-2') {
      return { ...item, status: 'done' as const, completed_at: '2026-05-01T02:00:00.000Z' };
    }
    return item;
  });

  const completed = applyDeepWorkCompletionSemantics(applyDeepWorkChildProgress(allDoneItems), '2026-05-01T03:00:00.000Z');
  assert.equal(completed.find(item => item.id === 'parent-1')?.status, 'done');

  const childUndone = completed.map(item => item.id === 'child-2'
    ? { ...item, status: 'pending' as const, completed_at: undefined }
    : item);
  const reopened = applyDeepWorkCompletionSemantics(applyDeepWorkChildProgress(childUndone), '2026-05-01T04:00:00.000Z');
  const reopenedParent = reopened.find(item => item.id === 'parent-1');

  assert.equal(reopenedParent?.status, 'pending');
  assert.equal(reopenedParent?.completed_at, undefined);
  assert.equal(reopenedParent?.meta.progress, 50);
});

test('manual focus subtasks create child todos and roll up parent progress', () => {
  const parent: BrainDumpItem = {
    id: 'focus-1',
    type: ItemType.TODO,
    content: 'Prepare board deck',
    status: 'pending',
    created_at: '2026-05-06T09:00:00.000Z',
    meta: normalizeDeepWorkTodoMeta({
      date: '2026-05-07T09:00:00.000Z',
      priority: 'high',
      deepWorkParent: true,
      deepWorkPlanId: 'focus-1',
      deepWorkStatus: 'active',
      subtasks: ['Collect numbers', 'Draft slides'],
    }),
  };

  let counter = 0;
  const children = createDeepWorkSubtaskItems(parent, () => `child-${++counter}`, '2026-05-06T10:00:00.000Z');

  assert.deepEqual(children.map(child => child.content), ['Collect numbers', 'Draft slides']);
  assert.equal(children[0].meta.parentTodoId, 'focus-1');
  assert.equal(children[1].meta.deepWorkStepIndex, 2);

  const withOneDone = [parent, { ...children[0], status: 'done' as const }, children[1]];
  const rolledUp = applyDeepWorkChildProgress(withOneDone);
  const updatedParent = rolledUp.find(item => item.id === 'focus-1');

  assert.equal(updatedParent?.meta.progress, 50);
  assert.equal(updatedParent?.status, 'pending');
});

test('skill routine parents can roll up manual subtask progress', () => {
  const skillParent: BrainDumpItem = {
    id: 'skill-routine-1',
    type: ItemType.SKILLS,
    content: 'English practice',
    status: 'pending',
    created_at: '2026-05-06T09:00:00.000Z',
    meta: normalizeDeepWorkTodoMeta({
      isRoutine: true,
      tags: ['skills', 'routine'],
      skillId: 'skill-1',
      skillName: 'English practice',
      childTodoIds: ['skill-step-1', 'skill-step-2'],
      deepWorkParent: true,
      deepWorkPlanId: 'skill-routine-1',
      deepWorkStatus: 'active',
      subtasks: ['Review vocabulary', 'Record speaking drill'],
    }),
  };
  const children: BrainDumpItem[] = [
    {
      id: 'skill-step-1',
      type: ItemType.TODO,
      content: 'Review vocabulary',
      status: 'done',
      created_at: '2026-05-06T09:01:00.000Z',
      completed_at: '2026-05-06T09:15:00.000Z',
      meta: { parentTodoId: 'skill-routine-1', deepWorkStepIndex: 1, deepWorkStepCount: 2 },
    },
    {
      id: 'skill-step-2',
      type: ItemType.TODO,
      content: 'Record speaking drill',
      status: 'pending',
      created_at: '2026-05-06T09:02:00.000Z',
      meta: { parentTodoId: 'skill-routine-1', deepWorkStepIndex: 2, deepWorkStepCount: 2 },
    },
  ];

  const rolledUp = applyDeepWorkChildProgress([skillParent, ...children]);
  const updatedParent = rolledUp.find(item => item.id === 'skill-routine-1');

  assert.equal(updatedParent?.meta.progress, 50);
  assert.equal(updatedParent?.status, 'pending');
});

test('legacy Todos sheet refresh does not erase existing nested metadata columns absent from old exports', () => {
  const existing = makeDeepWorkItems()[0];
  const db: DbSchema = {
    data: [existing],
    budgetConfig,
    skills: [],
    wallets: [],
    monthlyThemes: {},
    appSettings,
  };

  const legacyTodosSheet = {
    range: `'Todos'!A1`,
    values: [
      ['Type', 'Status', 'Priority', 'Content', 'Due_Date', 'Start_Date', 'End_Date', 'Tags', 'Created_At', 'Completed_At', 'Progress', 'Progress_Notes', 'ID'],
      ['TODO', 'pending', 'high', 'summary IIMS 2026 updated', '', '', '', 'work', '2026-05-01', '', '', '', 'parent-1'],
    ],
  };

  const reconciled = reconcileSpreadsheetData(db, [legacyTodosSheet]);
  const parent = reconciled.data.find(item => item.id === 'parent-1');
  assert.equal(parent?.content, 'summary IIMS 2026 updated');
  assert.equal(parent?.meta.deepWorkNextAction, 'Open the IIMS source notes');
  assert.deepEqual(parent?.meta.childTodoIds, ['child-1', 'child-2']);
});
