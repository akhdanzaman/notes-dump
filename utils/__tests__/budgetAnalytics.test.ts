import test from 'node:test';
import assert from 'node:assert/strict';

import { BrainDumpItem, BudgetConfig, ItemType } from '../../types';
import { getBudgetCategoryAnalytics, getBudgetTrendAnalytics } from '../budgetAnalytics';

const budgetConfig: BudgetConfig = {
  monthlyIncome: 10_000_000,
  rules: [
    { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-emerald-500' },
    { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-purple-500' },
  ],
};

const income = (id: string, amount: number, date = '2026-05-01T08:00:00.000Z'): BrainDumpItem => ({
  id,
  type: ItemType.FINANCE,
  content: id,
  status: 'done',
  created_at: date,
  completed_at: date,
  meta: {
    date,
    amount,
    financeType: 'income',
  },
});

const expense = (
  id: string,
  amount: number,
  budgetCategory: string,
  commodity?: string,
  subcommodity?: string,
  merchant?: string,
  date = '2026-05-01T08:00:00.000Z'
): BrainDumpItem => ({
  id,
  type: ItemType.FINANCE,
  content: id,
  status: 'done',
  created_at: date,
  completed_at: date,
  meta: {
    date,
    amount,
    financeType: 'expense',
    budgetCategory,
    commodity,
    subcommodity,
    merchant,
    canonical: {
      commodity: commodity ? { rawValue: commodity, value: commodity, confidence: 0.9, source: 'context_inference' } : undefined,
      subcommodity: subcommodity ? { rawValue: subcommodity, value: subcommodity, confidence: 0.9, source: 'context_inference' } : undefined,
    },
  },
});

test('budget trend analytics groups month days and yearly YoY buckets', () => {
  const items = [
    income('salary', 100_000),
    income('last-year-salary', 90_000, '2025-05-10T08:00:00.000Z'),
    expense('may-1', 10_000, 'needs', 'food', 'breakfast'),
    expense('may-2', 20_000, 'wants', 'food', 'lunch', undefined, '2026-05-02T08:00:00.000Z'),
    expense('last-year', 30_000, 'needs', 'transport', 'fuel', undefined, '2025-05-10T08:00:00.000Z'),
  ];

  const monthly = getBudgetTrendAnalytics(items, new Date('2026-05-15T00:00:00.000Z'), 'monthly', budgetConfig);
  assert.equal(monthly.length, 31);
  assert.equal(monthly[0].total, 10_000);
  assert.equal(monthly[0].income, 100_000);
  assert.deepEqual(monthly[0].categories.map(category => category.name), ['Needs']);
  assert.equal(monthly[1].total, 20_000);
  assert.deepEqual(monthly[1].categories.map(category => category.name), ['Wants']);

  const yearly = getBudgetTrendAnalytics(items, new Date('2026-05-15T00:00:00.000Z'), 'yearly', budgetConfig);
  assert.equal(yearly.length, 12);
  assert.equal(yearly[4].total, 30_000);
  assert.equal(yearly[4].income, 100_000);
  assert.equal(yearly[4].previousTotal, 30_000);
  assert.equal(yearly[4].previousIncome, 90_000);
  assert.deepEqual(yearly[4].categories.map(category => category.name), ['Wants', 'Needs']);
});

test('budget category analytics groups category to commodity to subcommodity with merchant drilldown', () => {
  const analytics = getBudgetCategoryAnalytics([
    expense('breakfast', 20_000, 'needs', 'food', 'breakfast', 'warung'),
    expense('dinner', 40_000, 'needs', 'food', 'dinner', 'gacoan'),
    expense('parking', 10_000, 'needs', 'transport', 'parking'),
    expense('unknown', 5_000, 'wants'),
  ], new Date('2026-05-15T00:00:00.000Z'), budgetConfig, 'monthly');

  const needs = analytics.find(category => category.categoryId === 'needs');
  assert.ok(needs);
  assert.equal(needs!.total, 70_000);
  assert.deepEqual(needs!.commodities.map(commodity => commodity.name), ['food', 'transport']);
  assert.equal(needs!.commodities[0].percentage.toFixed(0), '86');
  assert.deepEqual(needs!.commodities[0].subcommodities.map(sub => sub.name), ['dinner', 'breakfast']);
  assert.deepEqual(needs!.commodities[0].merchants.map(merchant => merchant.name), ['gacoan', 'warung']);

  const wants = analytics.find(category => category.categoryId === 'wants');
  assert.equal(wants!.commodities[0].name, 'others');
  assert.equal(wants!.commodities[0].subcommodities[0].name, 'others');
});

test('budget category analytics infers commodity when stale canonical others would dominate', () => {
  const staleOtherExpense: BrainDumpItem = {
    id: 'airbrush',
    type: ItemType.FINANCE,
    content: 'beli set airbrush',
    status: 'done',
    created_at: '2026-05-02T08:00:00.000Z',
    completed_at: '2026-05-02T08:00:00.000Z',
    meta: {
      date: '2026-05-02T08:00:00.000Z',
      amount: 756_000,
      financeType: 'expense',
      budgetCategory: 'wants',
      tags: ['electronics', 'purchase'],
      canonical: {
        commodity: {
          value: 'others',
          confidence: 0.2,
          source: 'system_rule',
          needsReview: false,
          reason: 'No commodity signal was available, so analytics use others.',
        },
        subcommodity: {
          value: 'others',
          confidence: 0.2,
          source: 'system_rule',
          needsReview: false,
          reason: 'No subcommodity signal was available, so analytics use others.',
        },
      },
    },
  };

  const analytics = getBudgetCategoryAnalytics([
    staleOtherExpense,
    expense('snack', 20_000, 'wants', 'food', 'snack'),
  ], new Date('2026-05-15T00:00:00.000Z'), budgetConfig, 'monthly');

  const wants = analytics.find(category => category.categoryId === 'wants');
  assert.ok(wants);
  assert.equal(wants!.commodities[0].name, 'hobby');
  assert.equal(wants!.commodities[0].subcommodities[0].name, 'airbrush');
});
