import test from 'node:test';
import assert from 'node:assert/strict';

import { generateExportData } from '../exportUtils';
import { reconcileSpreadsheetData } from '../../services/spreadsheetReconciler';
import { AppSettings, BrainDumpItem, BudgetConfig, DbSchema, ItemType } from '../../types';

const budgetConfig: BudgetConfig = {
  monthlyIncome: 0,
  rules: [
    { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-blue-500' },
  ],
};

const appSettings: AppSettings = {
  defaultCollapsed: false,
  hideMoney: false,
};

test('shopping/todo/event spreadsheet export round-trips without recreating items', () => {
  const shopping: BrainDumpItem = {
    id: 'shop-1',
    type: ItemType.SHOPPING,
    content: 'shoe cleaning',
    status: 'done',
    created_at: '2026-02-04T12:03:55.738Z',
    completed_at: '2026-02-15T14:01:52.000Z',
    meta: {
      amount: 75000,
      shoppingCategory: 'urgent',
      date: '2026-02-14T11:45:00.000Z',
      tags: ['errand'],
    },
  };

  const todo: BrainDumpItem = {
    id: 'todo-1',
    type: ItemType.TODO,
    content: 'follow up deck',
    status: 'pending',
    created_at: '2026-02-10T02:00:00.000Z',
    meta: {
      priority: 'high',
      date: '2026-02-18T09:00:00.000Z',
      start: '2026-02-18T09:00:00.000Z',
      end: '2026-02-18T10:00:00.000Z',
      progress: 25,
      progressNotes: 'waiting on revision',
      tags: ['work'],
    },
  };

  const event: BrainDumpItem = {
    id: 'event-1',
    type: ItemType.EVENT,
    content: 'client review',
    status: 'pending',
    created_at: '2026-02-11T03:00:00.000Z',
    meta: {
      date: '2026-02-19T02:00:00.000Z',
      start: '2026-02-19T02:00:00.000Z',
      end: '2026-02-19T03:00:00.000Z',
      priority: 'normal',
      tags: ['meeting'],
    },
  };

  const db: DbSchema = {
    data: [shopping, todo, event],
    budgetConfig,
    skills: [],
    wallets: [],
    monthlyThemes: {},
    appSettings,
  };

  const sheets = generateExportData(db.data, [], [], budgetConfig, {}, appSettings);
  const valueRanges = sheets.map((sheet) => ({
    range: `'${sheet.name}'!A1`,
    values: sheet.data,
  }));

  const reconciled = reconcileSpreadsheetData(structuredClone(db), valueRanges);

  assert.equal(reconciled.data.length, 3);

  const reconciledShopping = reconciled.data.find((item) => item.id === 'shop-1');
  assert.ok(reconciledShopping);
  assert.equal(reconciledShopping?.completed_at, '2026-02-15T14:01:52.000Z');
  assert.equal(reconciledShopping?.meta.date, '2026-02-14T11:45:00.000Z');

  const reconciledTodo = reconciled.data.find((item) => item.id === 'todo-1');
  assert.ok(reconciledTodo);
  assert.equal(reconciledTodo?.meta.start, '2026-02-18T09:00:00.000Z');
  assert.equal(reconciledTodo?.meta.end, '2026-02-18T10:00:00.000Z');

  const reconciledEvent = reconciled.data.find((item) => item.id === 'event-1');
  assert.ok(reconciledEvent);
  assert.equal(reconciledEvent?.meta.start, '2026-02-19T02:00:00.000Z');
  assert.equal(reconciledEvent?.meta.end, '2026-02-19T03:00:00.000Z');
});
