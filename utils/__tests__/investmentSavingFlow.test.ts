import test from 'node:test';
import assert from 'node:assert/strict';
import { BrainDumpItem, ItemType, Wallet } from '../../types';
import { getWalletStats } from '../selectors/moneySelectors';
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
