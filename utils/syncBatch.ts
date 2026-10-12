import type { SyncOperation } from './syncProtocol.js';
export interface MutationBatch {
  kind: 'mutations';
  scope: string;
  operations: SyncOperation[];
}
export const MAX_QUEUE_BATCH_BYTES = 200_000;
export function packSyncOperations<T extends SyncOperation>(
  operations: T[],
): T[][] {
  const batches: T[][] = [];
  let batch: T[] = [];
  for (const operation of operations) {
    const candidate = [...batch, operation];
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        kind: 'mutations',
        scope: operation.scope,
        operations: candidate,
      }),
    ).length;
    if (
      batch.length &&
      (candidate.length > 20 || bytes > MAX_QUEUE_BATCH_BYTES)
    ) {
      batches.push(batch);
      batch = [];
    }
    batch.push(operation);
    if (
      new TextEncoder().encode(
        JSON.stringify({
          kind: 'mutations',
          scope: operation.scope,
          operations: batch,
        }),
      ).length > MAX_QUEUE_BATCH_BYTES
    )
      throw new Error('Queue mutation exceeds 200 KB');
  }
  if (batch.length) batches.push(batch);
  return batches;
}
