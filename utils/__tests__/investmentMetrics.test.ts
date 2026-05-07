import test from 'node:test';
import assert from 'node:assert/strict';
import { BrainDumpItem, ItemType } from '../../types';
import { getInvestmentMetrics } from '../investmentMetrics';

const makeInvestment = (meta: BrainDumpItem['meta']): BrainDumpItem => ({
  id: 'investment-bbca',
  type: ItemType.SHOPPING,
  content: 'BBCA',
  status: 'pending',
  created_at: '2026-05-01T08:00:00.000Z',
  meta: {
    tags: [],
    shoppingCategory: 'investment',
    ...meta,
  },
});

test('investment P/L compares owned value against asset cost basis, not total funded capital', () => {
  const metrics = getInvestmentMetrics(makeInvestment({
    savedAmount: 500_000,
    investmentUnits: 100,
    investmentAveragePrice: 1_300,
    investmentCurrentPrice: 1_300,
  }));

  assert.equal(metrics.investedCapital, 500_000);
  assert.equal(metrics.ownedValue, 130_000);
  assert.equal(metrics.costBasis, 130_000);
  assert.equal(metrics.profitLoss, 0);
  assert.equal(metrics.roi, 0);
});

test('investment displayed value is the owned position value', () => {
  const metrics = getInvestmentMetrics(makeInvestment({
    savedAmount: 500_000,
    investmentUnits: 100,
    investmentAveragePrice: 1_300,
    investmentCurrentPrice: 1_500,
  }));

  assert.equal(metrics.displayValue, 150_000);
  assert.equal(metrics.profitLoss, 20_000);
  assert.equal(Number(metrics.roi.toFixed(1)), 15.4);
});
