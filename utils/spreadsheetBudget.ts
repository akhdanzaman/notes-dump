import type { BudgetConfig } from '../types';

const parsePercentage = (value: unknown, rowNumber: number) => {
  const text = String(value ?? '').trim().replace(/%$/, '').trim().replace(',', '.');
  const percentage = text === '' ? NaN : Number(text);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error(`Budget Rules row ${rowNumber}: Percentage must be between 0 and 100 (for example 50 or 50%).`);
  }
  return percentage;
};

// One parser for initial loading and reconciliation. Percentages use 0–100
// (50 means 50%), matching the app and the existing structured sheet format.
export const parseSpreadsheetBudget = (rows: unknown[][]): Partial<BudgetConfig> => {
  const headers = (rows[0] || []).map(value => String(value ?? '').trim());
  const legacy = headers[0] === 'Property';
  const cell = (row: unknown[], name: string, fallback: number) =>
    row[headers.includes(name) ? headers.indexOf(name) : fallback];
  const result: Partial<BudgetConfig> = { rules: [] };
  for (const [index, row] of rows.slice(1).entries()) {
    if (row.every(value => String(value ?? '').trim() === '')) continue;
    if (legacy) {
      const property = String(row[0] ?? '').trim();
      if (property === 'Monthly Income') {
        result.monthlyIncome = Number(row[1]) || 0;
      } else if (property.startsWith('Rule: ')) {
        const name = property.slice(6).trim();
        const raw = String(row[1] ?? '').trim();
        const match = raw.match(/([\d.]+)%?\s*(?:\(ID:\s*(.+?)\))?$/i);
        result.rules!.push({
          id: match?.[2]?.trim() || name,
          name,
          percentage: parsePercentage(match ? match[1] : raw, index + 2),
          color: String(row[2] || 'bg-gray-500'),
        });
      }
    } else {
      const id = String(cell(row, 'ID', 0) ?? '').trim();
      const name = String(cell(row, 'Name', 1) ?? '').trim();
      if (!id || !name) {
        throw new Error(`Budget Rules row ${index + 2}: fill in both ID and Name before syncing.`);
      }
      result.rules!.push({
        id,
        name,
        percentage: parsePercentage(cell(row, 'Percentage', 2), index + 2),
        color: String(cell(row, 'Color', 3) || 'bg-gray-500'),
      });
    }
  }
  const ids = new Set<string>();
  for (const rule of result.rules!) {
    if (ids.has(rule.id)) throw new Error(`Budget Rules: duplicate ID "${rule.id}". Each category needs a unique ID.`);
    ids.add(rule.id);
  }
  return result;
};
