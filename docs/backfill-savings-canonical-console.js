/**
 * Savings Canonical Backfill — Browser Console Version
 *
 * Paste the ENTIRE block below into your browser's DevTools console
 * (F12 → Console) while on the notes-dump app page.
 *
 * This will:
 * 1. Load all items from app state
 * 2. Find all FINANCE+saving entries
 * 3. Run sweepHistoricalCanonicalMeta on them
 * 4. Save the updated items back
 * 5. Reload the page
 *
 * === PASTE BELOW THIS LINE ===
 */
(async () => {
  'use strict';

  // Access React fiber internals to get app state
  const root = document.getElementById('__next') || document.getElementById('root');
  if (!root) return console.error('No app root found');

  // Get the app's React state via __REACT_DEVTOOLS_GLOBAL_HOOK__
  // Alternatively, find the localStorage key
  const raw = localStorage.getItem('braindump_chat_history');
  if (!raw) return console.error('No braindump data found in localStorage');

  const data = JSON.parse(raw);
  const items = data.items || [];
  const wallets = data.wallets || [];
  const budgetRules = data.budgetConfig?.rules || [];

  // Find savings
  const savings = items.filter(i =>
    i.type === 'FINANCE' && (i.meta?.financeType === 'saving' || i.meta?.financeType === 'saved')
  );
  console.log(`📊 Total items: ${items.length}, Savings entries: ${savings.length}`);

  if (savings.length === 0) {
    console.log('✅ No savings entries to fix');
    return;
  }

  // Show current state
  console.log('Before:');
  savings.slice(0, 5).forEach(s =>
    console.log(`  ${s.content?.slice(0, 40)}: budget=${s.meta?.budgetCategory}, commodity=${s.meta?.commodity}`)
  );

  // Since we can't easily import sweepHistoricalCanonicalMeta in the browser,
  // we do a simplified backfill inline:
  let updated = 0;
  const updatedItems = items.map(item => {
    if (item.type !== 'FINANCE') return item;
    const ft = item.meta?.financeType;
    if (ft !== 'saving' && ft !== 'saved') return item;

    const meta = { ...item.meta };

    // Set commodity if missing
    if (!meta.commodity) meta.commodity = 'saving';
    if (!meta.subcommodity) meta.subcommodity = 'goal_funding';

    // Set budgetCategory if missing
    if (!meta.budgetCategory && budgetRules.length > 0) {
      // Try to match 'savings' rule
      const savingsRule = budgetRules.find(r =>
        r.id?.toLowerCase() === 'savings' || r.name?.toLowerCase() === 'savings' ||
        r.id?.toLowerCase() === 'tabungan' || r.name?.toLowerCase() === 'tabungan'
      );
      meta.budgetCategory = savingsRule?.id || budgetRules[0].id;
    }

    // Set canonical
    const canonical = { ...(meta.canonical || {}) };
    if (meta.commodity && (!canonical.commodity || canonical.commodity.needsReview)) {
      canonical.commodity = {
        rawValue: meta.commodity,
        value: meta.commodity,
        confidence: 0.85,
        source: 'context_inference',
        needsReview: false,
        reason: 'Backfilled by savings canonical repair script.',
      };
    }
    if (meta.subcommodity && (!canonical.subcommodity || canonical.subcommodity.needsReview)) {
      canonical.subcommodity = {
        rawValue: meta.subcommodity,
        value: meta.subcommodity,
        confidence: 0.85,
        source: 'context_inference',
        needsReview: false,
        reason: 'Backfilled by savings canonical repair script.',
      };
    }
    if (Object.keys(canonical).length > 0) meta.canonical = canonical;

    const changed = JSON.stringify(item.meta) !== JSON.stringify(meta);
    if (changed) updated++;
    return { ...item, meta };
  });

  console.log(`✅ Updated ${updated} savings entries`);

  if (updated > 0) {
    // Save back
    data.items = updatedItems;
    localStorage.setItem('braindump_chat_history', JSON.stringify(data));

    // Also try to notify the app to reload
    window.dispatchEvent(new CustomEvent('braindump-data-changed', { detail: { source: 'backfill-savings' } }));
    console.log('💾 Data saved! Reloading page...');
    setTimeout(() => location.reload(), 1000);
  } else {
    console.log('💡 No changes needed — savings already have canonical values.');
  }
})();
