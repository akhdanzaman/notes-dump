import test from 'node:test';
import assert from 'node:assert/strict';

import { generateExportData } from '../exportUtils';
import { reconcileSpreadsheetData } from '../../services/spreadsheetReconciler';
import { AppSettings, BrainDumpItem, BudgetConfig, DbSchema, ItemType, Wallet } from '../../types';
import { getWalletStats } from '../selectors/moneySelectors';

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

const wallets: Wallet[] = [
  { id: 'bca-wallet', name: 'BCA', type: 'bank', initialBalance: 100_000, color: 'bg-blue-500' },
];

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

  const investment: BrainDumpItem = {
    id: 'investment-1',
    type: ItemType.SHOPPING,
    content: 'BBCA long-term position',
    status: 'pending',
    created_at: '2026-02-12T03:00:00.000Z',
    meta: {
      amount: 1_000_000,
      shoppingCategory: 'investment',
      date: '2026-02-12T03:00:00.000Z',
      investmentAssetType: 'stock',
      investmentSymbol: 'BBCA',
      investmentUnits: 100,
      investmentAveragePrice: 10_000,
      investmentCurrentPrice: 10_500,
      investmentPlatform: 'Ajaib',
      tags: ['portfolio'],
    },
  };

  const db: DbSchema = {
    data: [shopping, todo, event, investment],
    budgetConfig,
    skills: [],
    wallets: [],
    monthlyThemes: {},
    appSettings,
  };

  const sheets = generateExportData(db.data, [], [], budgetConfig, {}, appSettings);
  const shoppingSheet = sheets.find(sheet => sheet.name === 'Shopping');
  assert.ok(shoppingSheet);
  assert.deepEqual(shoppingSheet!.data[0], ["Status", "Item", "Amount", "Category", "Quantity", "Due_Date", "Created_At", "Tags", "Completed_At", "Investment_Type", "Investment_Code", "Investment_Units", "Investment_Avg_Buy", "Investment_Current_Price", "Investment_Platform", "ID"]);

  const valueRanges = sheets.map((sheet) => ({
    range: `'${sheet.name}'!A1`,
    values: sheet.data,
  }));

  const reconciled = reconcileSpreadsheetData(structuredClone(db), valueRanges);

  assert.equal(reconciled.data.length, 4);

  const reconciledShopping = reconciled.data.find((item) => item.id === 'shop-1');
  assert.ok(reconciledShopping);
  assert.equal(reconciledShopping?.created_at, '2026-02-04T12:03:55.738Z');
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

  const reconciledInvestment = reconciled.data.find((item) => item.id === 'investment-1');
  assert.ok(reconciledInvestment);
  assert.equal(reconciledInvestment?.meta.shoppingCategory, 'investment');
  assert.equal(reconciledInvestment?.meta.investmentAssetType, 'stock');
  assert.equal(reconciledInvestment?.meta.investmentSymbol, 'BBCA');
  assert.equal(reconciledInvestment?.meta.investmentUnits, 100);
  assert.equal(reconciledInvestment?.meta.investmentAveragePrice, 10_000);
  assert.equal(reconciledInvestment?.meta.investmentCurrentPrice, 10_500);
  assert.equal(reconciledInvestment?.meta.investmentPlatform, 'Ajaib');
});

test('transaction spreadsheet export round-trips ID after canonical columns and keeps wallet balance effective', () => {
  const transaction: BrainDumpItem = {
    id: 'txn-1',
    type: ItemType.FINANCE,
    content: 'makan gacoan',
    status: 'done',
    created_at: '2026-05-01T08:00:00.000Z',
    completed_at: '2026-05-01T08:00:00.000Z',
    meta: {
      date: '2026-05-01T08:00:00.000Z',
      amount: 25_000,
      financeType: 'expense',
      budgetCategory: 'wants',
      paymentMethod: 'bca-wallet',
      canonical: {
        merchant: { rawValue: 'gacoan', value: 'Mie Gacoan', confidence: 0.95, source: 'learned_rule' },
      },
      tags: ['food'],
    },
  };

  const db: DbSchema = {
    data: [transaction],
    budgetConfig,
    skills: [],
    wallets,
    monthlyThemes: {},
    appSettings,
  };

  const sheets = generateExportData(db.data, [], wallets, budgetConfig, {}, appSettings);
  const transactionsSheet = sheets.find(sheet => sheet.name === 'Transactions');
  assert.ok(transactionsSheet);
  assert.equal(transactionsSheet!.data[0].indexOf('ID'), 10);

  const reconciled = reconcileSpreadsheetData(structuredClone(db), [{
    range: "'Transactions'!A1:K",
    values: transactionsSheet!.data,
  }]);

  assert.equal(reconciled.data.length, 1);
  assert.equal(reconciled.data[0].id, 'txn-1');
  assert.equal(reconciled.data[0].meta.paymentMethod, 'bca-wallet');

  const { walletStats } = getWalletStats(reconciled.data, wallets);
  assert.equal(walletStats.find(wallet => wallet.id === 'bca-wallet')?.currentBalance, 75_000);
});

test('header-only spreadsheet ranges do not delete local shopping, transactions, or config', () => {
  const doneShopping: BrainDumpItem = {
    id: 'shop-done-1',
    type: ItemType.SHOPPING,
    content: 'sabun mandi',
    status: 'done',
    created_at: '2026-05-01T08:00:00.000Z',
    completed_at: '2026-05-01T09:00:00.000Z',
    meta: {
      amount: 18_000,
      shoppingCategory: 'urgent',
      paymentMethod: 'bca-wallet',
    },
  };

  const finance: BrainDumpItem = {
    id: 'txn-local-1',
    type: ItemType.FINANCE,
    content: 'kopi',
    status: 'done',
    created_at: '2026-05-01T10:00:00.000Z',
    completed_at: '2026-05-01T10:00:00.000Z',
    meta: {
      date: '2026-05-01T10:00:00.000Z',
      amount: 20_000,
      financeType: 'expense',
      paymentMethod: 'bca-wallet',
    },
  };

  const db: DbSchema = {
    data: [doneShopping, finance],
    budgetConfig,
    skills: [{ id: 'skill-1', name: 'Coding', weeklyTargetMinutes: 120, created_at: '2026-05-01T00:00:00.000Z', color: 'bg-blue-500' }],
    wallets,
    monthlyThemes: { '2026-05': 'Focus' },
    appSettings: { defaultCollapsed: true, hideMoney: true },
  };

  const reconciled = reconcileSpreadsheetData(structuredClone(db), [
    { range: "'Transactions'!A1:K", values: [["Date", "Type", "Category", "Description", "Amount", "Wallet", "To_Wallet", "Tags", "Canonical_Merchant", "Canonical_Subcommodity", "ID"]] },
    { range: "'Shopping'!A1:I", values: [["Status", "Item", "Amount", "Category", "Quantity", "Due_Date", "Tags", "Completed_At", "ID"]] },
    { range: "'Wallets Config'!A1:E", values: [["ID", "Name", "Type", "Initial_Balance", "Color"]] },
    { range: "'Skills Config'!A1:E", values: [["ID", "Name", "Weekly_Target_Minutes", "Created_At", "Color"]] },
    { range: "'Themes & Settings'!A1:C", values: [["Type", "Key", "Value"]] },
  ]);

  assert.deepEqual(reconciled.data.map(item => item.id).sort(), ['shop-done-1', 'txn-local-1']);
  assert.equal(reconciled.wallets?.length, 1);
  assert.equal(reconciled.skills?.length, 1);
  assert.equal(reconciled.monthlyThemes?.['2026-05'], 'Focus');
  assert.equal(reconciled.appSettings?.hideMoney, true);
});

test('transaction reconciliation parses Indonesian currency strings without shrinking amounts', () => {
  const transaction: BrainDumpItem = {
    id: 'txn-rp-1',
    type: ItemType.FINANCE,
    content: 'belanja bulanan',
    status: 'done',
    created_at: '2026-05-01T08:00:00.000Z',
    completed_at: '2026-05-01T08:00:00.000Z',
    meta: {
      date: '2026-05-01T08:00:00.000Z',
      amount: 75_000,
      financeType: 'expense',
      paymentMethod: 'bca-wallet',
    },
  };

  const db: DbSchema = {
    data: [transaction],
    budgetConfig,
    skills: [],
    wallets,
    monthlyThemes: {},
    appSettings,
  };

  const reconciled = reconcileSpreadsheetData(structuredClone(db), [{
    range: "'Transactions'!A1:K",
    values: [
      ["Date", "Type", "Category", "Description", "Amount", "Wallet", "To_Wallet", "Tags", "Canonical_Merchant", "Canonical_Subcommodity", "ID"],
      ["5/1/2026 3:00:00 PM", "expense", "Wants", "belanja bulanan", "Rp75.000", "BCA", "", "", "", "", "txn-rp-1"],
    ],
  }]);

  assert.equal(reconciled.data[0].meta.amount, 75_000);
  assert.equal(reconciled.data[0].meta.paymentMethod, 'bca-wallet');
});
