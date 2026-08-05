import assert from 'node:assert/strict';
import test from 'node:test';
import { ItemType } from '../../types';
import type { ArkaivWorkbookInput } from '../exportService';
import { buildArkaivWorkbookBuffer } from '../exportService';

const fixture: ArkaivWorkbookInput = {
  now: new Date('2026-08-05T09:30:00+07:00'),
  wallets: [{ id: 'wallet-bca', name: 'BCA', type: 'bank', initialBalance: 2_500_000, color: '#123456' }],
  budgetConfig: {
    monthlyIncome: 10_000_000,
    rules: [{ id: 'food', name: 'Food', percentage: 25, color: '#16a34a' }],
  },
  monthlyThemes: { '2026-08': 'Ship the important work' },
  appSettings: { defaultCollapsed: false, hideMoney: false, theme: 'light' },
  skills: [{
    id: 'skill-design',
    name: 'Product Design',
    description: 'Practice product design',
    color: '#2563eb',
    created_at: '2026-01-01T08:00:00+07:00',
    weeklyTargetMinutes: 180,
    schedule: {
      enabled: true,
      interval: 'weekly',
      daysOfWeek: [1, 3],
      startTime: '19:00',
      endTime: '20:00',
    },
  }],
  items: [
    {
      id: 'tx-income',
      type: ItemType.FINANCE,
      content: 'Client payment',
      status: 'done',
      created_at: '2026-08-04T10:30:00+07:00',
      completed_at: '2026-08-04T10:31:00+07:00',
      meta: {
        date: '2026-08-04T10:30:00+07:00',
        financeType: 'income',
        amount: 125_000,
        paymentMethod: 'wallet-bca',
        budgetCategory: 'food',
        merchant: 'Client A',
        tags: ['work'],
      },
    },
    {
      id: 'task-1',
      type: ItemType.TODO,
      content: 'Review prototype',
      status: 'pending',
      created_at: '2026-08-01T09:00:00+07:00',
      meta: {
        date: '2026-08-07',
        priority: 'high',
        progress: 40,
        isRoutine: true,
        deepWorkNextAction: 'Open the prototype',
      },
    },
    {
      id: 'shopping-1',
      type: ItemType.SHOPPING,
      content: 'Coffee beans',
      status: 'pending',
      created_at: '2026-08-02T08:00:00+07:00',
      meta: {
        shoppingCategory: 'urgent',
        quantity: '2',
        amount: 95_000,
        budgetCategory: 'food',
        paymentMethod: 'wallet-bca',
        targetDay: '2026-08-06',
      },
    },
    {
      id: 'event-1',
      type: ItemType.EVENT,
      content: 'Design review',
      status: 'pending',
      created_at: '2026-08-01T08:00:00+07:00',
      meta: {
        date: '2026-08-08',
        start: '2026-08-08T13:00:00+07:00',
        end: '2026-08-08T14:00:00+07:00',
        priority: 'normal',
        hideFromCalendar: false,
      },
    },
    {
      id: 'note-1',
      type: ItemType.NOTE,
      content: 'Keep exports readable.',
      status: 'pending',
      created_at: '2026-08-03T11:00:00+07:00',
      meta: { title: 'Export notes', tags: ['xlsx'] },
    },
    {
      id: 'log-1',
      type: ItemType.SKILL_LOG,
      content: 'Practiced layout critique',
      status: 'done',
      created_at: '2026-08-03T19:00:00+07:00',
      completed_at: '2026-08-03T20:00:00+07:00',
      meta: { skillId: 'skill-design', skillName: 'Product Design', durationMinutes: 60 },
    },
    {
      id: 'goal-1',
      type: ItemType.SHOPPING,
      content: 'Emergency fund',
      status: 'pending',
      created_at: '2026-07-01T08:00:00+07:00',
      meta: {
        shoppingCategory: 'saving',
        amount: 12_000_000,
        savedAmount: 3_000_000,
        dedicatedWalletId: 'wallet-bca',
        targetDay: '2026-12-31',
      },
    },
  ],
};

const loadWorkbook = async () => {
  const buffer = await buildArkaivWorkbookBuffer(fixture);
  const excelJsModule = await import('exceljs');
  const workbook = new excelJsModule.default.Workbook();
  await workbook.xlsx.load(buffer);
  return { buffer, workbook };
};

test('builds a genuine multi-sheet XLSX without technical tabs', async () => {
  const { buffer, workbook } = await loadWorkbook();
  assert.deepEqual(Array.from(new Uint8Array(buffer).slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);

  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), [
    'Overview',
    'Transactions',
    'Tasks',
    'Shopping',
    'Calendar',
    'Notes',
    'Skills',
    'Goals',
  ]);
  assert.equal(
    workbook.worksheets.some(sheet => /snapshot|history|raw|backup|do.not.edit|migration|event log|data quality/i.test(sheet.name)),
    false,
  );
});

test('preserves typed values and workbook usability metadata', async () => {
  const { workbook } = await loadWorkbook();
  const transactions = workbook.getWorksheet('Transactions');
  const tasks = workbook.getWorksheet('Tasks');
  const goals = workbook.getWorksheet('Goals');
  assert.ok(transactions);
  assert.ok(tasks);
  assert.ok(goals);

  assert.ok(transactions.getCell('A2').value instanceof Date);
  assert.equal(transactions.getCell('E2').value, 125_000);
  assert.equal(typeof transactions.getCell('E2').value, 'number');
  assert.equal(transactions.getCell('J2').value, true);
  assert.equal(typeof transactions.getCell('J2').value, 'boolean');
  assert.match(transactions.getCell('E2').numFmt, /Rp/);
  assert.match(transactions.getCell('A2').numFmt, /dd mmm yyyy/);

  assert.ok(tasks.getCell('D2').value instanceof Date);
  assert.equal(tasks.getCell('E2').value, 0.4);
  assert.equal(tasks.getCell('I2').value, true);
  assert.equal(tasks.getCell('A2').dataValidation.type, 'list');

  assert.equal(goals.getCell('D2').value, 12_000_000);
  assert.equal(goals.getCell('F2').value, 0.25);

  assert.equal(transactions.views[0]?.state, 'frozen');
  assert.equal(transactions.views[0]?.ySplit, 1);
  assert.ok(transactions.autoFilter);
  assert.equal(transactions.getTable('TransactionsTable').name, 'TransactionsTable');
  assert.ok(transactions.getColumn(4).width && transactions.getColumn(4).width! <= 40);
});

test('keeps the core workbook readable when there are no records yet', async () => {
  const buffer = await buildArkaivWorkbookBuffer({
    ...fixture,
    items: [],
    skills: [],
  });
  const excelJsModule = await import('exceljs');
  const workbook = new excelJsModule.default.Workbook();
  await workbook.xlsx.load(buffer);

  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), [
    'Overview',
    'Transactions',
    'Tasks',
    'Shopping',
  ]);
  assert.equal(workbook.getWorksheet('Transactions')?.rowCount, 1);
  assert.equal(workbook.getWorksheet('Tasks')?.rowCount, 1);
  assert.equal(workbook.getWorksheet('Shopping')?.rowCount, 1);
});
