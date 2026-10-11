import { authenticatedAppFetch, getSpreadsheetConfig } from './spreadsheetService';
import { readLocalState, changeOperationState, acknowledgeOperations, claimOperations, type LocalMutation } from './localOutbox';
import type { SyncReceipt } from '../utils/syncProtocol';
export async function durableCapabilities(scope: string): Promise<{ enabled: boolean; ready: boolean }> {
  const response = await authenticatedAppFetch('/api/spreadsheets/sync/capabilities', { spreadsheetId: scope });
  if (response.status === 404) return { enabled: false, ready: false }; // Previous deployment has no durable API.
  if (!response.ok) throw new Error('Cannot check server sync mode; local changes remain pending');
  return response.json();
}
export async function reconcileDurableReceipts(scope: string, operations: LocalMutation[]): Promise<boolean> {
  if (!operations.length) return false;
  let committed = false;
  for (let i = 0; i < operations.length; i += 200) {
    const response = await authenticatedAppFetch('/api/spreadsheets/sync/status', { spreadsheetId: scope, operationIds: operations.slice(i, i + 200).map(operation => operation.operationId) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Cannot confirm Sheets commit');
    const receipts: SyncReceipt[] = data.receipts;
    const ids = receipts.filter(receipt => receipt.state === 'committed').map(receipt => receipt.operationId);
    if (ids.length) { await acknowledgeOperations(scope, ids); committed = true; }
    for (const receipt of receipts.filter(receipt => receipt.state === 'conflict')) await changeOperationState(scope, [receipt.operationId], 'conflict', undefined, receipt.error);
  }
  return committed;
}
export async function submitDurableOperations(scope: string, operations: LocalMutation[]) {
  for (let i = 0; i < operations.length; i += 20) {
    const batch = await claimOperations(scope, operations.slice(i, i + 20).map(operation => operation.operationId));
    if (!batch.length) continue;
    const ids = batch.map(operation => operation.operationId);
    try {
      const response = await authenticatedAppFetch('/api/spreadsheets/sync/submit', { spreadsheetId: scope, operations: batch });
      const data = await response.json(); const accepted: string[] = data.accepted || [];
      await changeOperationState(scope, accepted, 'accepted');
      const rejected = ids.filter(id => !accepted.includes(id));
      if (rejected.length) await changeOperationState(scope, rejected, 'sending', undefined, data.error);
      if (!response.ok || rejected.length) throw new Error(data.error || 'Some changes remain local');
    } catch (error) {
      const latest = await readLocalState(scope);
      const retry = latest.operations.filter(operation => ids.includes(operation.operationId) && operation.state === 'sending');
      await changeOperationState(scope, retry.map(operation => operation.operationId), 'sending', undefined, String(error));
      throw error;
    }
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('arkaiv-outbox-pending'));
}
let replaying: Promise<void> | undefined;
export function replayDurableOutbox() {
  if (replaying) return replaying;
  replaying = (async () => {
    const config = getSpreadsheetConfig();
    if (!config || config.authMode === 'oauth' || typeof indexedDB === 'undefined') return;
    const scope = config.spreadsheetId; const local = await readLocalState(scope);
    if (!local.operations.length) return;
    const capabilities = await durableCapabilities(scope);
    if (!capabilities.enabled) return;
    const committed = await reconcileDurableReceipts(scope, local.operations);
    const remaining = await readLocalState(scope);
    const conflicts = remaining.operations.filter(operation => operation.state === 'conflict');
    if (conflicts.length && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('arkaiv-sync-conflict', { detail: conflicts }));
    if (committed && typeof window !== 'undefined') window.dispatchEvent(new Event('arkaiv-sync-committed'));
    if (!capabilities.ready) throw new Error('Migration/configuration is incomplete; local changes are safe');
    // Stable IDs make re-submission safe even after an unknown queue acceptance or retention expiry.
    await submitDurableOperations(scope, remaining.operations.filter(operation => operation.state !== 'conflict'));
  })().finally(() => { replaying = undefined; });
  return replaying;
}
