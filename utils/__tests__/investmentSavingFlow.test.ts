import test from 'node:test';
import assert from 'node:assert/strict';
import { BrainDumpItem, BudgetConfig, ItemType, Wallet } from '../../types';
import { getFinanceItems, getWalletStats } from '../selectors/moneySelectors';
import { getShoppingItems } from '../selectors/shoppingSelectors';

const wallets: Wallet[] = [
  { id: 'bca-wallet', name: 'BCA', type: 'bank', initialBalance: 1_000_000, color: 'bg-blue-500' },
  { id: 'bibit-wallet', name: 'Bibit', type: 'investment', initialBalance: 0, color: 'bg-emerald-500' },
];

const investment: BrainDumpItem = {
  id: 'investment-bbca',
  type: ItemType.SHOPPING,
  content: 'BBCA',
  status: 'pending',
  created_at: '2026-05-01T08:00:00.000Z',
  meta: {
    tags: [],
    shoppingCategory: 'investment',
    date: '2026-05-01T08:00:00.000Z',
    dedicatedWalletId: 'bibit-wallet',
    investmentAssetType: 'stock',
    investmentSymbol: 'BBCA',
    investmentUnits: 10,
    investmentAveragePrice: 25_000,
    investmentCurrentPrice: 10_000,
    investmentPlatform: 'Bibit',
  },
};

const savingIntoInvestment: BrainDumpItem = {
  id: 'txn-invest-bbca',
  type: ItemType.FINANCE,
  content: 'Invested into: BBCA',
  status: 'done',
  created_at: '2026-05-02T08:00:00.000Z',
  completed_at: '2026-05-02T08:00:00.000Z',
  meta: {
    tags: [],
    date: '2026-05-02T08:00:00.000Z',
    amount: 250_000,
    financeType: 'saving',
    paymentMethod: 'bca-wallet',
    toWallet: 'bibit-wallet',
    savingGoalId: 'investment-bbca',
  },
};

test('investment saved amount comes from linked saving transactions', () => {
  const { investments } = getShoppingItems([investment, savingIntoInvestment]);
  assert.equal(investments[0].meta.savedAmount, 250_000);
});

test('saving into investment moves balance from source wallet to investment wallet', () => {
  const { walletStats } = getWalletStats([savingIntoInvestment], wallets);
  assert.equal(walletStats.find(wallet => wallet.id === 'bca-wallet')?.currentBalance, 750_000);
  assert.equal(walletStats.find(wallet => wallet.id === 'bibit-wallet')?.currentBalance, 250_000);
});

test('investment wallet balance includes linked investment P/L after transfer-like saving', () => {
  const { walletStats } = getWalletStats([investment, savingIntoInvestment], wallets);
  assert.equal(walletStats.find(wallet => wallet.id === 'bca-wallet')?.currentBalance, 750_000);
  assert.equal(walletStats.find(wallet => wallet.id === 'bibit-wallet')?.currentBalance, 100_000);
});

const withdrawalFromInvestment: BrainDumpItem = {
  id: 'txn-withdraw-bbca',
  type: ItemType.FINANCE,
  content: 'Withdraw from: BBCA',
  status: 'done',
  created_at: '2026-05-03T08:00:00.000Z',
  completed_at: '2026-05-03T08:00:00.000Z',
  meta: {
    tags: ['saving-withdrawal'],
    date: '2026-05-03T08:00:00.000Z',
    amount: 50_000,
    financeType: 'saving_withdrawal',
    paymentMethod: 'bibit-wallet',
    toWallet: 'bca-wallet',
    savingGoalId: 'investment-bbca',
  },
};

test('investment withdrawal reduces linked saved amount', () => {
  const { investments } = getShoppingItems([investment, savingIntoInvestment, withdrawalFromInvestment]);
  assert.equal(investments[0].meta.savedAmount, 200_000);
});

test('investment withdrawal reverses wallet movement into the receiving wallet', () => {
  const { walletStats } = getWalletStats([savingIntoInvestment, withdrawalFromInvestment], wallets);
  assert.equal(walletStats.find(wallet => wallet.id === 'bca-wallet')?.currentBalance, 800_000);
  assert.equal(walletStats.find(wallet => wallet.id === 'bibit-wallet')?.currentBalance, 200_000);
});

test('loan accounting keeps lending as an asset allocation and borrowed balance inside total debt', () => {
  const loanItems: BrainDumpItem[] = [
    { id: 'loan-out', type: ItemType.FINANCE, content: 'Money lent to Budi', status: 'done', created_at: '2026-05-01T00:00:00.000Z', meta: { amount: 300_000, financeType: 'loan_out', paymentMethod: 'bca-wallet', loanCounterparty: 'Budi' } },
    { id: 'repay-in', type: ItemType.FINANCE, content: 'Loan repayment from Budi', status: 'done', created_at: '2026-05-02T00:00:00.000Z', meta: { amount: 100_000, financeType: 'loan_repayment_in', paymentMethod: 'bca-wallet', loanCounterparty: 'Budi' } },
    { id: 'loan-in', type: ItemType.FINANCE, content: 'Money borrowed from Sari', status: 'done', created_at: '2026-05-03T00:00:00.000Z', meta: { amount: 500_000, financeType: 'loan_in', paymentMethod: 'bca-wallet', loanCounterparty: 'Sari' } },
    { id: 'repay-out', type: ItemType.FINANCE, content: 'Loan repayment to Sari', status: 'done', created_at: '2026-05-04T00:00:00.000Z', meta: { amount: 200_000, financeType: 'loan_repayment_out', paymentMethod: 'bca-wallet', loanCounterparty: 'Sari' } },
  ];

  const { walletStats, totalAssets, totalDebt, totalLoanDebt, totalLent, totalNetWorth } = getWalletStats(loanItems, wallets);
  const bca = walletStats.find(wallet => wallet.id === 'bca-wallet');
  assert.equal(bca?.currentBalance, 1_300_000);
  assert.equal(bca?.lentAmount, 200_000);
  assert.equal(totalAssets, 1_300_000);
  assert.equal(totalLoanDebt, 300_000);
  assert.equal(totalDebt, 300_000);
  assert.equal(totalLent, 200_000);
  assert.equal(totalNetWorth, 1_000_000);
});


test('money lent is included in period total expense without reducing total assets', () => {
  const budgetConfig: BudgetConfig = { monthlyIncome: 0, rules: [] };
  const lent: BrainDumpItem = {
    id: 'loan-expense',
    type: ItemType.FINANCE,
    content: 'Money lent to Budi',
    status: 'done',
    created_at: '2026-05-05T00:00:00.000Z',
    completed_at: '2026-05-05T00:00:00.000Z',
    meta: {
      date: '2026-05-05T00:00:00.000Z',
      amount: 300_000,
      financeType: 'loan_out',
      paymentMethod: 'bca-wallet',
      loanCounterparty: 'Budi',
    },
  };

  const finance = getFinanceItems(
    [lent],
    new Date('2026-05-15T00:00:00.000Z'),
    budgetConfig,
    '', '', '', '', '', '', '',
    'newest',
    'monthly',
    wallets,
  );
  const wallet = getWalletStats([lent], wallets);

  assert.equal(finance.totalExpense, 300_000);
  assert.equal(wallet.totalAssets, 1_000_000);
  assert.equal(wallet.walletStats.find(item => item.id === 'bca-wallet')?.lentAmount, 300_000);
});
