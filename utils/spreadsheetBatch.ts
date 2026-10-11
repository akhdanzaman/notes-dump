export const MAX_SHEETS_BATCH_BYTES = 1_500_000;
export function splitSheetsBatch<T>(entries: T[], maxBytes = MAX_SHEETS_BATCH_BYTES): T[][] {
  const groups: T[][] = []; let current: T[] = []; let bytes = 128;
  for (const entry of entries) {
    const size = new TextEncoder().encode(JSON.stringify(entry)).length + 1;
    if (size + 128 > maxBytes) throw new Error('One spreadsheet range exceeds the safe request size; reduce its row chunk size');
    if (bytes + size > maxBytes && current.length) { groups.push(current); current = []; bytes = 128; }
    current.push(entry); bytes += size;
  }
  if (current.length) groups.push(current);
  return groups;
}
