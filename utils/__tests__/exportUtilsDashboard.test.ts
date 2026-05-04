import test from 'node:test';
import assert from 'node:assert/strict';

import { generateExportData, DASHBOARD_SHEET_NAME, DATA_QUALITY_SHEET_NAME } from '../exportUtils';
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
  assert.match(String(sheets[0].data[2][0]), /Generated-only/);
  assert.match(String(sheets[0].data[3][0]), /SYNC HEALTH/);
  assert.equal(sheets[0].data[25][0], 'ANALYTICS DECK');
  assert.ok(typeof sheets[0].data[1][7] === 'number');
  const dataQualitySheet = sheets.find(sheet => sheet.name === DATA_QUALITY_SHEET_NAME);
  assert.ok(dataQualitySheet);
  assert.equal(dataQualitySheet!.data[0][0], 'DATA QUALITY');
  assert.ok(sheets.some(sheet => sheet.name === 'All Items (Raw)'));
});

test('dashboard helper chart series respects injected export date', () => {
  const now = new Date('2026-05-04T12:00:00.000Z');
  const sheets = generateExportData([], [], [], { monthlyIncome: 0, rules: [] }, {}, { defaultCollapsed: false, hideMoney: false }, now);
  const dashboard = sheets.find(sheet => sheet.name === DASHBOARD_SHEET_NAME);
  assert.ok(dashboard);

  const expectedLastLabel = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  assert.equal(dashboard!.data[0][20], expectedLastLabel);
});
