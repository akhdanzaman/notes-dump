import test from 'node:test';
import assert from 'node:assert/strict';

import { generateExportData, DASHBOARD_SHEET_NAME } from '../exportUtils';
import { ItemType } from '../../types';

test('export data starts with premium Sheet1 dashboard and helper analytics data', () => {
  const sheets = generateExportData(
    [
      {
        id: 'finance-1',
        type: ItemType.FINANCE,
        content: 'Salary',
        status: 'done',
        created_at: '2026-05-01T08:00:00.000Z',
        completed_at: '2026-05-01T08:00:00.000Z',
        meta: { financeType: 'income', amount: 10000000, date: '2026-05-01T08:00:00.000Z' }
      },
      {
        id: 'todo-1',
        type: ItemType.TODO,
        content: 'Ship release',
        status: 'pending',
        created_at: '2026-05-02T08:00:00.000Z',
        meta: { date: '2026-05-03T08:00:00.000Z' }
      }
    ],
    [],
    [],
    { monthlyIncome: 10000000, rules: [] },
    {},
    { defaultCollapsed: false, hideMoney: false }
  );

  assert.equal(sheets[0].name, DASHBOARD_SHEET_NAME);
  assert.equal(sheets[0].inputOption, 'USER_ENTERED');
  assert.equal(sheets[0].data[0][0], 'BRAINDUMP HQ');
  assert.equal(sheets[0].data[25][0], 'ANALYTICS DECK');
  assert.ok(typeof sheets[0].data[1][7] === 'number');
  assert.ok(sheets.some(sheet => sheet.name === 'All Items (Raw)'));
});
