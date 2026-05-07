import { BrainDumpItem, ItemMeta } from '../types';

const positiveNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return value;
};

export type InvestmentFundingInput = {
  investedCapital?: number;
  units?: number;
  unitPrice?: number;
};

export type ResolvedInvestmentFunding = {
  investedCapital?: number;
  units?: number;
  unitPrice?: number;
};

export const resolveInvestmentFundingInput = ({ investedCapital, units, unitPrice }: InvestmentFundingInput): ResolvedInvestmentFunding => {
  const amount = positiveNumber(investedCapital);
  const unitCount = positiveNumber(units);
  const price = positiveNumber(unitPrice);

  if (!price) {
    return {
      investedCapital: amount,
      units: unitCount,
      unitPrice: undefined,
    };
  }

  if (amount && !unitCount) {
    return {
      investedCapital: amount,
      units: amount / price,
      unitPrice: price,
    };
  }

  if (!amount && unitCount) {
    return {
      investedCapital: unitCount * price,
      units: unitCount,
      unitPrice: price,
    };
  }

  return {
    investedCapital: amount,
    units: unitCount,
    unitPrice: price,
  };
};

export const getDefaultInvestmentUnitPrice = (investment?: BrainDumpItem): number | undefined => {
  if (!investment) return undefined;
  return positiveNumber(investment.meta.investmentAveragePrice) || positiveNumber(investment.meta.investmentCurrentPrice);
};

export const applyInvestmentFundingToMeta = (
  meta: ItemMeta,
  funding: ResolvedInvestmentFunding
): ItemMeta => {
  const addedUnits = positiveNumber(funding.units);
  const unitPrice = positiveNumber(funding.unitPrice);
  const addedCapital = positiveNumber(funding.investedCapital);

  if (!addedUnits) return meta;

  const previousUnits = positiveNumber(meta.investmentUnits) || 0;
  const nextUnits = previousUnits + addedUnits;
  const previousAveragePrice = positiveNumber(meta.investmentAveragePrice);
  let nextAveragePrice = meta.investmentAveragePrice;

  if (unitPrice) {
    if (previousUnits > 0 && previousAveragePrice) {
      const previousCostBasis = previousUnits * previousAveragePrice;
      const addedCostBasis = addedCapital || addedUnits * unitPrice;
      nextAveragePrice = (previousCostBasis + addedCostBasis) / nextUnits;
    } else if (previousUnits === 0) {
      nextAveragePrice = unitPrice;
    }
  }

  return {
    ...meta,
    investmentUnits: nextUnits,
    investmentAveragePrice: nextAveragePrice,
    investmentCurrentPrice: meta.investmentCurrentPrice ?? unitPrice,
  };
};

export const applyInvestmentFundingToInvestment = (
  investment: BrainDumpItem,
  funding: ResolvedInvestmentFunding
): BrainDumpItem => ({
  ...investment,
  meta: applyInvestmentFundingToMeta(investment.meta, funding),
});
