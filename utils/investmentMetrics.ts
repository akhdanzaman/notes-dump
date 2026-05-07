import { BrainDumpItem } from '../types';

export interface InvestmentMetrics {
  investedCapital: number;
  units: number;
  averagePrice: number;
  currentPrice: number;
  ownedValue: number;
  displayValue: number;
  costBasis: number;
  profitLoss: number;
  roi: number;
}

const positiveNumber = (value: number | undefined) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);

export const getInvestmentMetrics = (investment: BrainDumpItem): InvestmentMetrics => {
  const investedCapital = positiveNumber(investment.meta.savedAmount);
  const units = positiveNumber(investment.meta.investmentUnits);
  const averagePrice = positiveNumber(investment.meta.investmentAveragePrice);
  const currentPrice = positiveNumber(investment.meta.investmentCurrentPrice);
  const ownedValue = units > 0 && currentPrice > 0 ? units * currentPrice : 0;
  const costBasis = units > 0 && averagePrice > 0 ? units * averagePrice : 0;
  const displayValue = ownedValue > 0 ? ownedValue : investedCapital;
  const pnlBasis = costBasis > 0 ? costBasis : investedCapital;
  const profitLoss = ownedValue > 0 && pnlBasis > 0 ? ownedValue - pnlBasis : 0;
  const roi = pnlBasis > 0 ? (profitLoss / pnlBasis) * 100 : 0;

  return {
    investedCapital,
    units,
    averagePrice,
    currentPrice,
    ownedValue,
    displayValue,
    costBasis,
    profitLoss,
    roi,
  };
};
