import test from 'node:test';
import assert from 'node:assert/strict';
import { BrainDumpItem, ItemType } from '../../types';
import { applyInvestmentFundingToInvestment, getDefaultInvestmentUnitPrice, resolveInvestmentFundingInput } from '../investmentFunding';

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

test('investment funding resolves units from invested capital and unit price', () => {
  const resolved = resolveInvestmentFundingInput({ investedCapital: 260_000, unitPrice: 1_300 });

  assert.equal(resolved.investedCapital, 260_000);
  assert.equal(resolved.units, 200);
  assert.equal(resolved.unitPrice, 1_300);
});

test('investment funding resolves invested capital from units and unit price', () => {
  const resolved = resolveInvestmentFundingInput({ units: 125, unitPrice: 1_600 });

  assert.equal(resolved.investedCapital, 200_000);
  assert.equal(resolved.units, 125);
  assert.equal(resolved.unitPrice, 1_600);
});

test('investment funding keeps units optional when no unit price exists', () => {
  const resolved = resolveInvestmentFundingInput({ investedCapital: 500_000 });

  assert.equal(resolved.investedCapital, 500_000);
  assert.equal(resolved.units, undefined);
  assert.equal(resolved.unitPrice, undefined);
});

test('investment funding adds bought units and recalculates weighted average buy', () => {
  const updated = applyInvestmentFundingToInvestment(
    makeInvestment({ investmentUnits: 100, investmentAveragePrice: 1_000, investmentCurrentPrice: 1_200 }),
    resolveInvestmentFundingInput({ investedCapital: 180_000, units: 100, unitPrice: 1_800 })
  );

  assert.equal(updated.meta.investmentUnits, 200);
  assert.equal(updated.meta.investmentAveragePrice, 1_400);
  assert.equal(updated.meta.investmentCurrentPrice, 1_200);
});

test('default investment unit price prefers average buy before current price', () => {
  assert.equal(getDefaultInvestmentUnitPrice(makeInvestment({ investmentAveragePrice: 1_300, investmentCurrentPrice: 1_500 })), 1_300);
  assert.equal(getDefaultInvestmentUnitPrice(makeInvestment({ investmentCurrentPrice: 1_500 })), 1_500);
});
