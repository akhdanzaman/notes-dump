import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDeepWorkPlan, buildDeepWorkSuggestionMeta, createDeepWorkSubtaskItems } from '../deepWorkTransformer';
import { normalizeDeepWorkTodoMeta } from '../../utils/deepWorkTodoModel';
import { generateExportData } from '../../utils/exportUtils';
import { reconcileSpreadsheetData } from '../spreadsheetReconciler';
import { AppSettings, BrainDumpItem, BudgetConfig, DbSchema, ItemType } from '../../types';

const budgetConfig: BudgetConfig = {
  monthlyIncome: 0,
  rules: [],
};

const appSettings: AppSettings = {
  defaultCollapsed: false,
  hideMoney: false,
};

const makeTodo = (content: string): BrainDumpItem => ({
  id: 'todo-parent',
  type: ItemType.TODO,
  content,
  status: 'pending',
  created_at: '2026-05-03T00:00:00.000Z',
  meta: {
    tags: ['work'],
    priority: 'high',
    date: '2026-05-03T09:00:00.000Z',
  },
});

test('buildDeepWorkPlan transforms abstract work and skips concrete errands', () => {
  const abstractPlan = buildDeepWorkPlan('Selesaiin summary IIMS 2026');
  assert.equal(abstractPlan.shouldTransform, true);
  assert.ok(abstractPlan.steps.length >= 3);

  const explicitPlan = buildDeepWorkPlan('Lanjut summary regulasi', {
    subtasks: ['Identify regulation source', 'Extract obligations', 'Draft final summary'],
  });
  assert.deepEqual(explicitPlan.steps, ['Identify regulation source', 'Extract obligations', 'Draft final summary']);

  const errandPlan = buildDeepWorkPlan('buy milk');
  assert.equal(errandPlan.shouldTransform, false);
});

test('deep work todos save nested steps and reload from spreadsheet rows', () => {
  const baseTodo = makeTodo('Lanjut summary regulasi');
  const suggestedParent: BrainDumpItem = {
    ...baseTodo,
    meta: normalizeDeepWorkTodoMeta({
      ...buildDeepWorkSuggestionMeta(baseTodo.content, {
        ...baseTodo.meta,
        subtasks: ['Identify regulation and source', 'Extract obligations and deadlines', 'Draft the final regulation summary'],
      }),
      deepWorkPlanId: baseTodo.id,
    }),
  };
  let next = 1;
  const generatedChildren = createDeepWorkSubtaskItems(suggestedParent, () => `todo-child-${next++}`, '2026-05-03T01:00:00.000Z');
  const expanded = [{
    ...suggestedParent,
    meta: normalizeDeepWorkTodoMeta({
      ...suggestedParent.meta,
      childTodoIds: generatedChildren.map(child => child.id),
    }),
  }, ...generatedChildren];

  assert.equal(expanded.length, 4);
  const [parent, ...children] = expanded;
  assert.equal(parent.meta.deepWorkParent, true);
  assert.deepEqual(parent.meta.childTodoIds, ['todo-child-1', 'todo-child-2', 'todo-child-3']);
  assert.match(parent.meta.deepWorkNextAction || '', /regulation source/i);
  assert.equal(children[0].meta.parentTodoId, parent.id);
  assert.equal(children[0].meta.deepWorkStepIndex, 1);

  const sourceDb: DbSchema = {
    data: expanded,
    budgetConfig,
    skills: [],
    wallets: [],
    monthlyThemes: {},
    appSettings,
  };

  const sheets = generateExportData(sourceDb.data, [], [], budgetConfig, {}, appSettings);
  const todosSheet = sheets.find(sheet => sheet.name === 'Todos');
  assert.ok(todosSheet);
  assert.ok(todosSheet!.data[0].includes('Parent_ID'));
  assert.ok(todosSheet!.data[0].includes('Child_IDs'));
  assert.ok(todosSheet!.data[0].includes('Subtasks'));

  const valueRanges = sheets.map(sheet => ({ range: `'${sheet.name}'!A1`, values: sheet.data }));
  const reloaded = reconcileSpreadsheetData({
    data: [],
    budgetConfig,
    skills: [],
    wallets: [],
    monthlyThemes: {},
    appSettings,
  }, valueRanges);

  const reloadedParent = reloaded.data.find(item => item.id === 'todo-parent');
  const reloadedChildren = reloaded.data
    .filter(item => item.meta.parentTodoId === 'todo-parent')
    .sort((a, b) => (a.meta.deepWorkStepIndex || 0) - (b.meta.deepWorkStepIndex || 0));

  assert.ok(reloadedParent);
  assert.equal(reloadedParent!.meta.deepWorkParent, true);
  assert.deepEqual(reloadedParent!.meta.childTodoIds, ['todo-child-1', 'todo-child-2', 'todo-child-3']);
  assert.equal(reloadedParent!.meta.deepWorkCompletionMode, 'final_output_check');
  assert.match(reloadedParent!.meta.deepWorkNextAction || '', /regulation source/i);
  assert.equal(reloadedChildren.length, 3);
  assert.equal(reloadedChildren[2].content, 'Draft the final regulation summary');
  assert.equal(reloadedChildren[2].meta.deepWorkStepCount, 3);
});
