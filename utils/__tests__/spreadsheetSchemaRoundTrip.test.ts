import test from 'node:test';
import assert from 'node:assert/strict';

import { SAVING_GOALS_INVESTMENTS_SHEET_NAME, generateExportData } from '../exportUtils';
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
      budgetCategory: 'wants',
      paymentMethod: 'bca-wallet',
      hideFromCalendar: true,
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
      deepWorkTriggerPattern: 'research',
      deepWorkTriggerEvidence: ['needs sources', 'multiple steps'],
      deepWorkConfidence: 'high',
      deepWorkNextAction: 'Collect 3 references',
      deepWorkNextActionDurationMinutes: 30,
      deepWorkNextActionAcceptanceCheck: 'references are linked',
      deepWorkFinalOutput: 'Client-ready deck',
      deepWorkFinalOutputFormat: 'slides',
      deepWorkSessionEstimateMinutes: 90,
      deepWorkSessionEstimateConfidence: 'medium',
      deepWorkSessionEstimateReason: 'requires review pass',
      deepWorkBlockerStatus: 'needs_input',
      deepWorkBlockerCheck: 'Need latest KPI',
      deepWorkMissingInputs: ['KPI export'],
      deepWorkGeneratedAt: '2026-02-10T03:00:00.000Z',
      deepWorkAcceptedAt: '2026-02-10T04:00:00.000Z',
      deepWorkReason: 'multi-step follow-up',
      hideFromCalendar: true,
      isRoutine: true,
      routineInterval: 'monthly',
      routineDaysOfMonth: [18],
      recurrenceDays: 1,
      lastGeneratedHistoryId: 'journal-history-1',
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
      hideFromCalendar: true,
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
      dedicatedWalletId: 'bca-wallet',
      hideFromCalendar: true,
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

  const routineShopping: BrainDumpItem = {
    id: 'routine-1',
    type: ItemType.SHOPPING,
    content: 'Laundry',
    status: 'pending',
    created_at: '2026-02-13T03:00:00.000Z',
    meta: {
      amount: 36000,
      shoppingCategory: 'routine',
      isRoutine: true,
      routineInterval: 'weekly',
      routineDaysOfWeek: [1, 4],
      recurrenceDays: 3,
      lastGeneratedHistoryId: 'finance-history-1',
      paymentMethod: 'bca-wallet',
      budgetCategory: 'wants',
      date: '2026-02-14T03:00:00.000Z',
    },
  };

  const db: DbSchema = {
    data: [shopping, todo, event, investment, routineShopping],
    budgetConfig,
    skills: [],
    wallets: [],
    monthlyThemes: {},
    appSettings,
  };

  const sheets = generateExportData(db.data, [], [], budgetConfig, {}, appSettings);
  const todosSheet = sheets.find(sheet => sheet.name === 'Todos');
  assert.ok(todosSheet);
  assert.deepEqual(todosSheet!.data[0].slice(21, 40), ["Deep_Work_Trigger_Pattern", "Deep_Work_Trigger_Evidence", "Deep_Work_Confidence", "Next_Action", "Next_Action_Duration_Min", "Next_Action_Acceptance_Check", "Final_Output", "Final_Output_Format", "Session_Estimate_Min", "Session_Estimate_Confidence", "Session_Estimate_Reason", "Blocker_Status", "Blocker_Check", "Missing_Inputs", "Deep_Work_Generated_At", "Deep_Work_Accepted_At", "Deep_Work_Dismissed_At", "Deep_Work_Reason", "Subtasks"]);
  assert.deepEqual(todosSheet!.data[0].slice(40), ["Hide_From_Calendar", "Is_Routine", "Routine_Interval", "Routine_Days_Of_Week", "Routine_Days_Of_Month", "Routine_Months_Of_Year", "Recurrence_Days", "Last_Generated_History_ID"]);
  const shoppingSheet = sheets.find(sheet => sheet.name === 'Shopping');
  assert.ok(shoppingSheet);
  assert.deepEqual(shoppingSheet!.data[0], ["Status", "Item", "Amount", "Category", "Quantity", "Due_Date", "Created_At", "Tags", "Completed_At", "Investment_Type", "Investment_Code", "Investment_Units", "Investment_Avg_Buy", "Investment_Current_Price", "Investment_Platform", "ID", "Budget_Category", "Payment_Method", "Dedicated_Wallet_ID", "Hide_From_Calendar", "Routine_Interval", "Routine_Days_Of_Week", "Routine_Days_Of_Month", "Routine_Months_Of_Year", "Recurrence_Days", "Last_Generated_History_ID"]);
  const savingGoalsInvestmentsSheet = sheets.find(sheet => sheet.name === SAVING_GOALS_INVESTMENTS_SHEET_NAME);
  assert.ok(savingGoalsInvestmentsSheet);
  assert.deepEqual(savingGoalsInvestmentsSheet!.data[0], ["Kind", "Status", "Name", "Target_Amount", "Saved_Amount", "Dedicated_Wallet_ID", "Due_Date", "Created_At", "Completed_At", "Tags", "Hide_From_Calendar", "Investment_Type", "Investment_Code", "Investment_Units", "Investment_Avg_Buy", "Investment_Current_Price", "Investment_Platform", "ID"]);
  const investmentRow = savingGoalsInvestmentsSheet!.data.find(row => row.includes('investment-1'));
  assert.ok(investmentRow);
  assert.equal(investmentRow![savingGoalsInvestmentsSheet!.data[0].indexOf('Hide_From_Calendar')], 'TRUE');

  const valueRanges = sheets.map((sheet) => ({
    range: `'${sheet.name}'!A1`,
    values: sheet.data,
  }));

  const reconciled = reconcileSpreadsheetData(structuredClone(db), valueRanges);

  assert.equal(reconciled.data.length, 5);

  const reconciledShopping = reconciled.data.find((item) => item.id === 'shop-1');
  assert.ok(reconciledShopping);
  assert.equal(reconciledShopping?.created_at, '2026-02-04T12:03:55.738Z');
  assert.equal(reconciledShopping?.completed_at, '2026-02-15T14:01:52.000Z');
  assert.equal(reconciledShopping?.meta.date, '2026-02-14T11:45:00.000Z');
  assert.equal(reconciledShopping?.meta.budgetCategory, 'wants');
  assert.equal(reconciledShopping?.meta.paymentMethod, 'bca-wallet');
  assert.equal(reconciledShopping?.meta.hideFromCalendar, true);

  const reconciledTodo = reconciled.data.find((item) => item.id === 'todo-1');
  assert.ok(reconciledTodo);
  assert.equal(reconciledTodo?.meta.start, '2026-02-18T09:00:00.000Z');
  assert.equal(reconciledTodo?.meta.end, '2026-02-18T10:00:00.000Z');
  assert.equal(reconciledTodo?.meta.deepWorkTriggerPattern, 'research');
  assert.deepEqual(reconciledTodo?.meta.deepWorkTriggerEvidence, ['needs sources', 'multiple steps']);
  assert.equal(reconciledTodo?.meta.deepWorkConfidence, 'high');
  assert.equal(reconciledTodo?.meta.deepWorkNextAction, 'Collect 3 references');
  assert.equal(reconciledTodo?.meta.deepWorkNextActionDurationMinutes, 30);
  assert.equal(reconciledTodo?.meta.deepWorkNextActionAcceptanceCheck, 'references are linked');
  assert.equal(reconciledTodo?.meta.deepWorkFinalOutput, 'Client-ready deck');
  assert.equal(reconciledTodo?.meta.deepWorkFinalOutputFormat, 'slides');
  assert.equal(reconciledTodo?.meta.deepWorkSessionEstimateMinutes, 90);
  assert.equal(reconciledTodo?.meta.deepWorkSessionEstimateConfidence, 'medium');
  assert.equal(reconciledTodo?.meta.deepWorkSessionEstimateReason, 'requires review pass');
  assert.equal(reconciledTodo?.meta.deepWorkBlockerStatus, 'needs_input');
  assert.equal(reconciledTodo?.meta.deepWorkBlockerCheck, 'Need latest KPI');
  assert.deepEqual(reconciledTodo?.meta.deepWorkMissingInputs, ['KPI export']);
  assert.equal(reconciledTodo?.meta.deepWorkGeneratedAt, '2026-02-10T03:00:00.000Z');
  assert.equal(reconciledTodo?.meta.deepWorkAcceptedAt, '2026-02-10T04:00:00.000Z');
  assert.equal(reconciledTodo?.meta.deepWorkReason, 'multi-step follow-up');
  assert.equal(reconciledTodo?.meta.hideFromCalendar, true);
  assert.equal(reconciledTodo?.meta.isRoutine, true);
  assert.equal(reconciledTodo?.meta.routineInterval, 'monthly');
  assert.deepEqual(reconciledTodo?.meta.routineDaysOfMonth, [18]);
  assert.equal(reconciledTodo?.meta.lastGeneratedHistoryId, 'journal-history-1');

  const reconciledEvent = reconciled.data.find((item) => item.id === 'event-1');
  assert.ok(reconciledEvent);
  assert.equal(reconciledEvent?.meta.start, '2026-02-19T02:00:00.000Z');
  assert.equal(reconciledEvent?.meta.end, '2026-02-19T03:00:00.000Z');
  assert.equal(reconciledEvent?.meta.hideFromCalendar, true);

  const reconciledInvestment = reconciled.data.find((item) => item.id === 'investment-1');
  assert.ok(reconciledInvestment);
  assert.equal(reconciledInvestment?.meta.shoppingCategory, 'investment');
  assert.equal(reconciledInvestment?.meta.dedicatedWalletId, 'bca-wallet');
  assert.equal(reconciledInvestment?.meta.hideFromCalendar, true);
  assert.equal(reconciledInvestment?.meta.investmentAssetType, 'stock');
  assert.equal(reconciledInvestment?.meta.investmentSymbol, 'BBCA');
  assert.equal(reconciledInvestment?.meta.investmentUnits, 100);
  assert.equal(reconciledInvestment?.meta.investmentAveragePrice, 10_000);
  assert.equal(reconciledInvestment?.meta.investmentCurrentPrice, 10_500);
  assert.equal(reconciledInvestment?.meta.investmentPlatform, 'Ajaib');

  const reconciledRoutine = reconciled.data.find((item) => item.id === 'routine-1');
  assert.ok(reconciledRoutine);
  assert.equal(reconciledRoutine?.meta.isRoutine, true);
  assert.equal(reconciledRoutine?.meta.routineInterval, 'weekly');
  assert.deepEqual(reconciledRoutine?.meta.routineDaysOfWeek, [1, 4]);
  assert.equal(reconciledRoutine?.meta.recurrenceDays, 3);
  assert.equal(reconciledRoutine?.meta.lastGeneratedHistoryId, 'finance-history-1');
  assert.equal(reconciledRoutine?.meta.paymentMethod, 'bca-wallet');
  assert.equal(reconciledRoutine?.meta.budgetCategory, 'wants');
});

test('shopping spreadsheet category edits keep isRoutine in sync', () => {
  const routineShopping: BrainDumpItem = {
    id: 'routine-demote-1',
    type: ItemType.SHOPPING,
    content: 'Laundry',
    status: 'pending',
    created_at: '2026-02-13T03:00:00.000Z',
    meta: {
      amount: 36000,
      shoppingCategory: 'routine',
      isRoutine: true,
      routineInterval: 'weekly',
      routineDaysOfWeek: [1, 4],
      recurrenceDays: 3,
      date: '2026-02-14T03:00:00.000Z',
    },
  };
  const db: DbSchema = {
    data: [routineShopping],
    budgetConfig,
    skills: [],
    wallets: [],
    monthlyThemes: {},
    appSettings,
  };
  const sheets = generateExportData(db.data, [], [], budgetConfig, {}, appSettings);
  const shoppingSheet = sheets.find(sheet => sheet.name === 'Shopping');
  assert.ok(shoppingSheet);

  const values = structuredClone(shoppingSheet!.data);
  values[1][values[0].indexOf('Category')] = 'not_urgent';
  for (const name of ['Routine_Interval', 'Routine_Days_Of_Week', 'Routine_Days_Of_Month', 'Routine_Months_Of_Year', 'Recurrence_Days']) {
    values[1][values[0].indexOf(name)] = '';
  }

  const reconciled = reconcileSpreadsheetData(structuredClone(db), [{ range: "'Shopping'!A1:Z", values }]);
  const item = reconciled.data.find(i => i.id === 'routine-demote-1');
  assert.equal(item?.meta.shoppingCategory, 'not_urgent');
  assert.equal(item?.meta.isRoutine, undefined);
  assert.equal(item?.meta.routineInterval, undefined);
  assert.equal(item?.meta.routineDaysOfWeek, undefined);
  assert.equal(item?.meta.recurrenceDays, undefined);
});

test('stale shopping sheets with drifted IDs keep existing routine recurrence metadata', () => {
  const existingRoutine: BrainDumpItem = {
    id: 'old-routine-id',
    type: ItemType.SHOPPING,
    content: 'Bensin',
    status: 'pending',
    created_at: '2026-03-11T11:40:20.000Z',
    meta: {
      amount: 25000,
      shoppingCategory: 'routine',
      isRoutine: true,
      routineInterval: 'monthly',
      routineDaysOfMonth: [11, 25],
      date: '2026-05-11T00:58:39.000Z',
      lastGeneratedHistoryId: 'history-bensin-1',
    },
  };
  const db: DbSchema = {
    data: [existingRoutine],
    budgetConfig,
    skills: [],
    wallets: [],
    monthlyThemes: {},
    appSettings,
  };

  const staleShoppingValues = [
    ['Status', 'Item', 'Amount', 'Category', 'Quantity', 'Due_Date', 'Created_At', 'Tags', 'Completed_At', 'Investment_Type', 'Investment_Code', 'Investment_Units', 'Investment_Avg_Buy', 'Investment_Current_Price', 'Investment_Platform', 'ID'],
    ['pending', 'Bensin', '25000', 'routine', '', '2026-05-11T00:58:39.000Z', '2026-03-11T11:40:20.000Z', '', '', '', '', '', '', '', '', 'new-drifted-row-id'],
  ];

  const reconciled = reconcileSpreadsheetData(structuredClone(db), [{ range: "'Shopping'!A1:P", values: staleShoppingValues }]);

  const routines = reconciled.data.filter(item => item.type === ItemType.SHOPPING && item.content === 'Bensin');
  assert.equal(routines.length, 1);
  assert.equal(routines[0].id, 'old-routine-id');
  assert.equal(routines[0].meta.routineInterval, 'monthly');
  assert.deepEqual(routines[0].meta.routineDaysOfMonth, [11, 25]);
  assert.equal(routines[0].meta.lastGeneratedHistoryId, 'history-bensin-1');
});

test('event spreadsheet export preserves dateTime-only events', () => {
  const event: BrainDumpItem = {
    id: 'event-datetime-1',
    type: ItemType.EVENT,
    content: 'Strategy sync',
    status: 'pending',
    created_at: '2026-05-01T08:00:00.000Z',
    meta: {
      dateTime: '2026-05-10T10:00:00.000Z',
      priority: 'normal',
    },
  };
  const db: DbSchema = {
    data: [event],
    budgetConfig,
    skills: [],
    wallets: [],
    monthlyThemes: {},
    appSettings,
  };
  const sheets = generateExportData(db.data, [], [], budgetConfig, {}, appSettings);
  const eventSheet = sheets.find(sheet => sheet.name === 'Events');
  assert.ok(eventSheet);
  assert.equal(eventSheet!.data[1][eventSheet!.data[0].indexOf('Date')], '2026-05-10T10:00:00.000Z');

  const reconciled = reconcileSpreadsheetData(structuredClone(db), [{ range: "'Events'!A1:J", values: eventSheet!.data }]);
  const item = reconciled.data.find(i => i.id === 'event-datetime-1');
  assert.equal(item?.meta.date, '2026-05-10T10:00:00.000Z');
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
      savingGoalId: 'goal-1',
      investmentUnits: 2,
      investmentAveragePrice: 12_500,
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
  assert.equal(transactionsSheet!.data[0].indexOf('ID'), 18);
  assert.deepEqual(transactionsSheet!.data[0].slice(19), ['Saving_Goal_ID', 'Investment_Units', 'Investment_Avg_Buy', 'Line_Items', 'Receipt_Capture', 'Loan_Counterparty', 'Loan_Account_ID', 'Loan_Due_Date']);

  const reconciled = reconcileSpreadsheetData(structuredClone(db), [{
    range: "'Transactions'!A1:AA",
    values: transactionsSheet!.data,
  }]);

  assert.equal(reconciled.data.length, 1);
  assert.equal(reconciled.data[0].id, 'txn-1');
  assert.equal(reconciled.data[0].meta.paymentMethod, 'bca-wallet');
  assert.equal(reconciled.data[0].meta.savingGoalId, 'goal-1');
  assert.equal(reconciled.data[0].meta.investmentUnits, 2);
  assert.equal(reconciled.data[0].meta.investmentAveragePrice, 12_500);

  const { walletStats } = getWalletStats(reconciled.data, wallets);
  assert.equal(walletStats.find(wallet => wallet.id === 'bca-wallet')?.currentBalance, 75_000);
});

test('loan counterparty round-trips through the Transactions sheet', () => {
  const loan: BrainDumpItem = {
    id: 'loan-1',
    type: ItemType.FINANCE,
    content: 'Money lent to Budi',
    status: 'done',
    created_at: '2026-07-19T08:00:00.000Z',
    completed_at: '2026-07-19T08:00:00.000Z',
    meta: {
      date: '2026-07-19T08:00:00.000Z',
      amount: 20_000,
      financeType: 'loan_out',
      paymentMethod: 'bca-wallet',
      loanCounterparty: 'Budi',
      loanAccountId: 'loan-account-1',
      loanDueDate: '2026-08-01T12:00:00.000Z',
    },
  };
  const db: DbSchema = {
    data: [loan],
    budgetConfig,
    skills: [],
    wallets,
    monthlyThemes: {},
    appSettings,
  };

  const sheets = generateExportData(db.data, [], wallets, budgetConfig, {}, appSettings);
  const transactionsSheet = sheets.find(sheet => sheet.name === 'Transactions');
  assert.ok(transactionsSheet);
  const counterpartyIndex = transactionsSheet!.data[0].indexOf('Loan_Counterparty');
  const accountIdIndex = transactionsSheet!.data[0].indexOf('Loan_Account_ID');
  const dueDateIndex = transactionsSheet!.data[0].indexOf('Loan_Due_Date');
  assert.equal(transactionsSheet!.data[1][counterpartyIndex], 'Budi');
  assert.equal(transactionsSheet!.data[1][accountIdIndex], 'loan-account-1');
  assert.equal(transactionsSheet!.data[1][dueDateIndex], '2026-08-01T12:00:00.000Z');

  const reconciled = reconcileSpreadsheetData(structuredClone(db), [{
    range: "'Transactions'!A1:AA",
    values: transactionsSheet!.data,
  }]);
  assert.equal(reconciled.data[0].meta.financeType, 'loan_out');
  assert.equal(reconciled.data[0].meta.loanCounterparty, 'Budi');
  assert.equal(reconciled.data[0].meta.loanAccountId, 'loan-account-1');
  assert.equal(reconciled.data[0].meta.loanDueDate, '2026-08-01T12:00:00.000Z');
});

test('spreadsheet reconciliation treats blank trailing schema cells as user clears', () => {
  const transaction: BrainDumpItem = {
    id: 'txn-clear-1',
    type: ItemType.FINANCE,
    content: 'fund investment',
    status: 'done',
    created_at: '2026-05-01T08:00:00.000Z',
    completed_at: '2026-05-01T08:00:00.000Z',
    meta: {
      date: '2026-05-01T08:00:00.000Z',
      amount: 100_000,
      financeType: 'saving',
      paymentMethod: 'bca-wallet',
      savingGoalId: 'goal-old',
      investmentUnits: 10,
      investmentAveragePrice: 10_000,
    },
  };
  const investment: BrainDumpItem = {
    id: 'shop-clear-1',
    type: ItemType.SHOPPING,
    content: 'BBCA position',
    status: 'pending',
    created_at: '2026-05-01T08:00:00.000Z',
    meta: {
      amount: 1_000_000,
      shoppingCategory: 'investment',
      dedicatedWalletId: 'bca-wallet',
      hideFromCalendar: true,
      routineInterval: 'weekly',
      routineDaysOfWeek: [1],
      recurrenceDays: 7,
      investmentUnits: 100,
      investmentAveragePrice: 10_000,
      investmentCurrentPrice: 12_000,
      investmentPlatform: 'Ajaib',
    },
  };
  const db: DbSchema = {
    data: [transaction, investment],
    budgetConfig,
    skills: [],
    wallets,
    monthlyThemes: {},
    appSettings,
  };
  const sheets = generateExportData(db.data, [], wallets, budgetConfig, {}, appSettings);
  const txSheet = sheets.find(sheet => sheet.name === 'Transactions');
  const savingGoalsInvestmentsSheet = sheets.find(sheet => sheet.name === SAVING_GOALS_INVESTMENTS_SHEET_NAME);
  assert.ok(txSheet);
  assert.ok(savingGoalsInvestmentsSheet);

  const txValues = structuredClone(txSheet!.data);
  txValues[1] = txValues[1].slice(0, txValues[0].indexOf('ID') + 1);

  const goalValues = structuredClone(savingGoalsInvestmentsSheet!.data);
  const goalHeader = goalValues[0];
  const goalRow = goalValues[1];
  ['Dedicated_Wallet_ID', 'Hide_From_Calendar', 'Investment_Units', 'Investment_Avg_Buy', 'Investment_Current_Price', 'Investment_Platform'].forEach((name) => {
    goalRow[goalHeader.indexOf(name)] = '';
  });
  goalValues[1] = goalRow.slice(0, goalHeader.indexOf('ID') + 1);

  const reconciled = reconcileSpreadsheetData(structuredClone(db), [
    { range: "'Transactions'!A1:V", values: txValues },
    { range: `'${SAVING_GOALS_INVESTMENTS_SHEET_NAME}'!A1:R`, values: goalValues },
  ]);
  const reconciledTransaction = reconciled.data.find(item => item.id === 'txn-clear-1');
  assert.ok(reconciledTransaction);
  assert.equal(reconciledTransaction?.meta.savingGoalId, undefined);
  assert.equal(reconciledTransaction?.meta.investmentUnits, undefined);
  assert.equal(reconciledTransaction?.meta.investmentAveragePrice, undefined);

  const reconciledInvestment = reconciled.data.find(item => item.id === 'shop-clear-1');
  assert.ok(reconciledInvestment);
  assert.equal(reconciledInvestment?.meta.dedicatedWalletId, undefined);
  assert.equal(reconciledInvestment?.meta.hideFromCalendar, undefined);
  assert.equal(reconciledInvestment?.meta.routineInterval, undefined);
  assert.equal(reconciledInvestment?.meta.routineDaysOfWeek, undefined);
  assert.equal(reconciledInvestment?.meta.recurrenceDays, undefined);
  assert.equal(reconciledInvestment?.meta.investmentUnits, undefined);
  assert.equal(reconciledInvestment?.meta.investmentAveragePrice, undefined);
  assert.equal(reconciledInvestment?.meta.investmentCurrentPrice, undefined);
  assert.equal(reconciledInvestment?.meta.investmentPlatform, undefined);
});

test('monthly theme hero image URLs round-trip beside theme rows', () => {
  const sheets = generateExportData([], [], [], budgetConfig, { '2026-06': 'Reset month' }, appSettings, new Date('2026-06-01T00:00:00.000Z'), {
    monthlyThemeImages: { '2026-06': 'https://example.com/hero.jpg' },
  });

  const themesSheet = sheets.find(sheet => sheet.name === 'Themes & Settings');
  assert.ok(themesSheet);
  assert.deepEqual(themesSheet!.data[0], ['Type', 'Key', 'Value', 'Hero_Image_URL']);
  const themeRow = themesSheet!.data.find(row => row[0] === 'Theme' && row[1] === '2026-06');
  assert.deepEqual(themeRow, ['Theme', '2026-06', 'Reset month', 'https://example.com/hero.jpg']);

  const reconciled = reconcileSpreadsheetData({ data: [], monthlyThemes: {}, monthlyThemeImages: {}, appSettings }, [{
    range: "'Themes & Settings'!A1:D",
    values: themesSheet!.data,
  }]);

  assert.equal(reconciled.monthlyThemes?.['2026-06'], 'Reset month');
  assert.equal(reconciled.monthlyThemeImages?.['2026-06'], 'https://example.com/hero.jpg');
});

test('saving goals and investments can be added, edited, and deleted from dedicated spreadsheet sheet', () => {
  const existing: BrainDumpItem = {
    id: 'goal-keep',
    type: ItemType.SHOPPING,
    content: 'Emergency Fund',
    status: 'pending',
    created_at: '2026-06-01T00:00:00.000Z',
    meta: { amount: 1_000_000, savedAmount: 100_000, shoppingCategory: 'saving' },
  };
  const deleted: BrainDumpItem = {
    id: 'goal-delete',
    type: ItemType.SHOPPING,
    content: 'Old Goal',
    status: 'pending',
    created_at: '2026-06-01T00:00:00.000Z',
    meta: { amount: 500_000, shoppingCategory: 'saving' },
  };

  const reconciled = reconcileSpreadsheetData({ data: [existing, deleted], budgetConfig, skills: [], wallets, monthlyThemes: {}, appSettings }, [{
    range: `'${SAVING_GOALS_INVESTMENTS_SHEET_NAME}'!A1:R`,
    values: [
      ['Kind', 'Status', 'Name', 'Target_Amount', 'Saved_Amount', 'Dedicated_Wallet_ID', 'Due_Date', 'Created_At', 'Completed_At', 'Tags', 'Hide_From_Calendar', 'Investment_Type', 'Investment_Code', 'Investment_Units', 'Investment_Avg_Buy', 'Investment_Current_Price', 'Investment_Platform', 'ID'],
      ['saving', 'pending', 'Emergency Fund Updated', '1500000', '250000', 'bca-wallet', '', '2026-06-01T00:00:00.000Z', '', 'cash', 'TRUE', '', '', '', '', '', '', 'goal-keep'],
      ['investment', 'pending', 'BBCA Position', '2000000', '', 'bca-wallet', '', '2026-06-02T00:00:00.000Z', '', 'portfolio', '', 'stock', 'BBCA', '100', '10000', '10500', 'Ajaib', 'goal-new'],
    ],
  }]);

  assert.equal(reconciled.data.some(item => item.id === 'goal-delete'), false);
  const edited = reconciled.data.find(item => item.id === 'goal-keep');
  assert.equal(edited?.content, 'Emergency Fund Updated');
  assert.equal(edited?.meta.amount, 1_500_000);
  assert.equal(edited?.meta.savedAmount, 250_000);
  assert.equal(edited?.meta.hideFromCalendar, true);

  const added = reconciled.data.find(item => item.id === 'goal-new');
  assert.equal(added?.meta.shoppingCategory, 'investment');
  assert.equal(added?.meta.investmentSymbol, 'BBCA');
  assert.equal(added?.meta.investmentUnits, 100);
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
    { range: "'Transactions'!A1:K", values: [["Date", "Type", "Category", "Description", "Amount", "Wallet", "To_Wallet", "Tags", "Canonical_Commodity", "Canonical_Subcommodity", "ID"]] },
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
      ["Date", "Type", "Category", "Description", "Amount", "Wallet", "To_Wallet", "Tags", "Canonical_Commodity", "Canonical_Subcommodity", "ID"],
      ["5/1/2026 3:00:00 PM", "expense", "Wants", "belanja bulanan", "Rp75.000", "BCA", "", "", "", "", "txn-rp-1"],
    ],
  }]);

  assert.equal(reconciled.data[0].meta.amount, 75_000);
  assert.equal(reconciled.data[0].meta.paymentMethod, 'bca-wallet');
});
