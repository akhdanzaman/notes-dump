/**
 * Savings Canonical Backfill Script
 *
 * Reads all FINANCE+saving items, runs sweepHistoricalCanonicalMeta to set
 * commodity, subcommodity, budgetCategory, and canonical metadata.
 *
 * Usage:
 *   1. Export your data from the app (Data → Export → JSON)
 *   2. npx tsx scripts/backfill-savings-canonical.ts < input.json > output.json
 *   3. Import output.json back into the app
 *
 * For browser console execution, paste the browser version below.
 */
import { sweepHistoricalCanonicalMeta, type CanonicalizerContext } from '../services/canonicalizerService';
import { enrichFinanceMetaFromText } from '../services/parserSignalService';
import { BrainDumpItem, BudgetRule, ItemType, Wallet } from '../types';
import { getSystemCanonicalRules } from '../utils/canonicalization/systemRules';

async function main() {
  const chunks: string[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const data = JSON.parse(chunks.join(''));

  // Expect either { items: [...] } or a flat array
  const items: BrainDumpItem[] = Array.isArray(data) ? data : (data.items || []);

  if (!items.length) {
    console.error('No items found. Pipe in a JSON array or {items: [...]}.');
    process.exit(1);
  }

  // Extract wallets and budget rules from the data (or from the app state)
  const wallets: Wallet[] = data.wallets || [];
  const budgetRules: BudgetRule[] = data.budgetRules || [];

  // Find all FINANCE saving items
  const savingItems = items.filter(
    (item) => item.type === ItemType.FINANCE && item.meta?.financeType === 'saving',
  );
  console.error(`Total items: ${items.length}, Saving items: ${savingItems.length}`);

  if (savingItems.length === 0) {
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  }

  const ctx: CanonicalizerContext = {
    wallets,
    budgetRules,
    existingItems: items,
    rules: getSystemCanonicalRules(wallets),
  };

  const result = sweepHistoricalCanonicalMeta(savingItems, ctx);
  const updatedIds = new Set(result.changedItemIds);
  console.error(`Updated: ${result.changedItemIds.length} items`);

  // Merge updated items back
  const updatedItems = items.map((item) => {
    const swept = result.items.find((s) => s.id === item.id);
    return swept || item;
  });

  // Collect reviews
  if (result.reviews.length > 0) {
    console.error(`Reviews generated: ${result.reviews.length}`);
  }

  // Show what changed
  for (const id of result.changedItemIds) {
    const updated = updatedItems.find((i) => i.id === id);
    if (updated) {
      console.error(
        `  ${updated.content.slice(0, 40)}: budget=${updated.meta?.budgetCategory}, commodity=${updated.meta?.commodity}, sub=${updated.meta?.subcommodity}`,
      );
    }
  }

  // Output
  const output = Array.isArray(data) ? updatedItems : { ...data, items: updatedItems };
  process.stdout.write(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
