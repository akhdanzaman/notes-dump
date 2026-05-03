import test from 'node:test';
import assert from 'node:assert/strict';
import { BrainDumpItem, BudgetConfig, ItemType, Wallet } from '../../types';
import { generateExportData } from '../exportUtils';
import { getFinanceItems, getWalletStats } from '../selectors/moneySelectors';

const wallets: Wallet[] = [
  { id: 'bca-wallet', name: 'BCA', type: 'bank', initialBalance: 100_000, color: 'bg-blue-500' },
  { id: 'cash-wallet', name: 'Cash', type: 'cash', initialBalance: 50_000, color: 'bg-green-500' },
];

const budgetConfig: BudgetConfig = {
  monthlyIncome: 0,
  rules: [{ id: 'needs', name: 'Needs', percentage: 50, color: 'bg-emerald-500' }],
};

const makeFinanceItem = (
  id: string,
  amount: number,
  rawPaymentMethod: string,
  rawMerchant: string,
  canonicalMerchant = 'Mie Gacoan'
): BrainDumpItem => ({
  id,
  type: ItemType.FINANCE,
  content: `expense ${rawMerchant}`,
  status: 'done',
  created_at: '2026-05-01T08:00:00.000Z',
  completed_at: '2026-05-01T08:00:00.000Z',
  meta: {
    date: '2026-05-01T08:00:00.000Z',
    amount,
    financeType: 'expense',
    budgetCategory: 'needs',
    paymentMethod: rawPaymentMethod,
    merchant: rawMerchant,
    commodity: 'makanan',
    subcommodity: 'sarapan pedas',
    tags: ['food'],
    canonical: {
      paymentMethod: { rawValue: rawPaymentMethod, value: 'bca-wallet', confidence: 0.95, source: 'system_rule' },
      merchant: { rawValue: rawMerchant, value: canonicalMerchant, confidence: 0.94, source: 'learned_rule' },
      commodity: { rawValue: 'makanan', value: 'food', confidence: 0.9, source: 'manual_review' },
      subcommodity: { rawValue: 'sarapan pedas', value: 'breakfast', confidence: 0.9, source: 'system_rule' },
    },
  },
});

const canonicalItems = [
  makeFinanceItem('txn-1', 10_000, 'qris bca', 'gacoan jakal'),
  makeFinanceItem('txn-2', 15_000, 'debit bca', 'gacoan seturan'),
];

test('money wallet balances and wallet filters collapse paymentMethod aliases through canonical wallet IDs', () => {
  const { walletStats } = getWalletStats(canonicalItems, wallets);
  assert.equal(walletStats.find(wallet => wallet.id === 'bca-wallet')?.currentBalance, 75_000);

  const filtered = getFinanceItems(
    canonicalItems,
    new Date('2026-05-15T00:00:00.000Z'),
    budgetConfig,
    'BCA',
    '',
    '',
    '',
    '',
    '',
    '',
    'newest',
    'monthly',
    wallets
  );

  assert.deepEqual(filtered.list.map(item => item.id).sort(), ['txn-1', 'txn-2']);
  assert.equal(filtered.totalExpense, 25_000);
});

test('wallet balances use wallet IDs from new manual transactions and keep legitimate zero balances', () => {
  const manualById: BrainDumpItem = {
    id: 'txn-manual-id',
    type: ItemType.FINANCE,
    content: 'manual expense',
    status: 'done',
    created_at: '2026-05-01T08:00:00.000Z',
    completed_at: '2026-05-01T08:00:00.000Z',
    meta: {
      date: '2026-05-01T08:00:00.000Z',
      amount: 100_000,
      financeType: 'expense',
      paymentMethod: 'bca-wallet',
    },
  };

  const { walletStats } = getWalletStats([manualById], wallets);
  assert.equal(walletStats.find(wallet => wallet.id === 'bca-wallet')?.currentBalance, 0);
});

test('wallet balances fall back to raw paymentMethod when canonical value is not a registered wallet', () => {
  const itemWithBadCanonicalWallet: BrainDumpItem = {
    id: 'txn-bad-canonical-wallet',
    type: ItemType.FINANCE,
    content: 'expense with stale canonical wallet',
    status: 'done',
    created_at: '2026-05-01T08:00:00.000Z',
    completed_at: '2026-05-01T08:00:00.000Z',
    meta: {
      date: '2026-05-01T08:00:00.000Z',
      amount: 12_000,
      financeType: 'expense',
      paymentMethod: 'BCA',
      canonical: {
        paymentMethod: { rawValue: 'BCA', value: 'not-a-wallet', confidence: 0.9, source: 'learned_rule' },
      },
    },
  };

  const { walletStats } = getWalletStats([itemWithBadCanonicalWallet], wallets);
  assert.equal(walletStats.find(wallet => wallet.id === 'bca-wallet')?.currentBalance, 88_000);
});

test('wallet balances follow edited raw wallet instead of stale canonical paymentMethod', () => {
  const editedTransaction: BrainDumpItem = {
    id: 'txn-edited-wallet',
    type: ItemType.FINANCE,
    content: 'expense moved from BCA to Cash',
    status: 'done',
    created_at: '2026-05-01T08:00:00.000Z',
    completed_at: '2026-05-01T08:00:00.000Z',
    meta: {
      date: '2026-05-01T08:00:00.000Z',
      amount: 10_000,
      financeType: 'expense',
      paymentMethod: 'cash-wallet',
      canonical: {
        paymentMethod: { rawValue: 'bca-wallet', value: 'bca-wallet', confidence: 0.95, source: 'system_rule' },
      },
    },
  };

  const { walletStats } = getWalletStats([editedTransaction], wallets);
  assert.equal(walletStats.find(wallet => wallet.id === 'bca-wallet')?.currentBalance, 100_000);
  assert.equal(walletStats.find(wallet => wallet.id === 'cash-wallet')?.currentBalance, 40_000);
});

test('money search matches canonical clusters and raw aliases without rewriting original fields', () => {
  const canonicalSearch = getFinanceItems(
    canonicalItems,
    new Date('2026-05-15T00:00:00.000Z'),
    budgetConfig,
    '',
    '',
    '',
    '',
    '',
    '',
    'mie gacoan',
    'newest'
  );
  assert.deepEqual(canonicalSearch.list.map(item => item.id).sort(), ['txn-1', 'txn-2']);

  const rawSearch = getFinanceItems(
    canonicalItems,
    new Date('2026-05-15T00:00:00.000Z'),
    budgetConfig,
    '',
    '',
    '',
    '',
    '',
    '',
    'gacoan seturan',
    'newest'
  );
  assert.deepEqual(rawSearch.list.map(item => item.id), ['txn-2']);
  assert.equal(rawSearch.list[0].meta.merchant, 'gacoan seturan');
  assert.equal(rawSearch.list[0].meta.paymentMethod, 'debit bca');
});

test('exports expose canonical grouping columns while preserving raw item values', () => {
  const sheets = generateExportData(canonicalItems, [], wallets, budgetConfig, {}, { defaultCollapsed: false, hideMoney: false });
  const transactions = sheets.find(sheet => sheet.name === 'Transactions');
  const allItems = sheets.find(sheet => sheet.name === 'All Items (Raw)');

  assert.ok(transactions);
  assert.ok(allItems);

  const transactionsHeader = transactions!.data[0];
  const firstTransaction = transactions!.data[1];
  assert.equal(firstTransaction[transactionsHeader.indexOf('Wallet')], 'BCA');
  assert.equal(firstTransaction[transactionsHeader.indexOf('Canonical_Merchant')], 'Mie Gacoan');
  assert.equal(firstTransaction[transactionsHeader.indexOf('Canonical_Subcommodity')], 'breakfast');

  const allItemsHeader = allItems!.data[0];
  const firstRawRow = allItems!.data.find(row => row[allItemsHeader.indexOf('ID')] === 'txn-1');
  assert.ok(firstRawRow);
  assert.equal(firstRawRow![allItemsHeader.indexOf('Payment_Method')], 'qris bca');
  assert.equal(firstRawRow![allItemsHeader.indexOf('Canonical_Payment_Method')], 'bca-wallet');
  assert.equal(firstRawRow![allItemsHeader.indexOf('Merchant')], 'gacoan jakal');
  assert.equal(firstRawRow![allItemsHeader.indexOf('Canonical_Merchant')], 'Mie Gacoan');
  assert.equal(firstRawRow![allItemsHeader.indexOf('Commodity')], 'makanan');
  assert.equal(firstRawRow![allItemsHeader.indexOf('Canonical_Commodity')], 'food');
});
