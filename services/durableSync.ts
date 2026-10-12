import { authenticatedAppFetch, getSpreadsheetConfig } from './spreadsheetService';
import { readLocalState, changeOperationState, acknowledgeOperations, claimOperations, scheduleOperationStatus, type LocalMutation } from './localOutbox';
import type { SyncReceipt } from '../utils/syncProtocol';
import { shouldPollOperation, shouldSubmitOperation } from '../utils/outboxPolicy';
import { packSyncOperations } from '../utils/syncBatch';
export async function durableCapabilities(scope: string): Promise<{ enabled: boolean; ready: boolean }> {
  const response = await authenticatedAppFetch('/api/spreadsheets/sync/capabilities', { spreadsheetId: scope });
  if (response.status === 404) return { enabled: false, ready: false }; // Previous deployment has no durable API.
  if (!response.ok) throw new Error('Cannot check server sync mode; local changes remain pending');
  return response.json();
}
export async function reconcileDurableReceipts(scope: string, operations: LocalMutation[]): Promise<boolean> {
  operations=operations.filter(operation=>shouldPollOperation(operation));
  if (!operations.length) return false;
  let committed = false;
  const changedOperations:LocalMutation[]=[];
  for (let i = 0; i < operations.length; i += 200) {
    const response = await authenticatedAppFetch('/api/spreadsheets/sync/status', { spreadsheetId: scope, operationIds: operations.slice(i, i + 200).map(operation => operation.operationId) });
    const data = await response.json();
    const checked=operations.slice(i,i+200).map(operation=>operation.operationId);
    await scheduleOperationStatus(scope,checked, response.ok ? 0 : Math.max(60000,Number(response.headers.get('Retry-After'))*1000 || 60000));
    if (!response.ok) throw new Error(data.error || 'Cannot confirm Sheets commit');
    const receipts: SyncReceipt[] = data.receipts;
    const ids = receipts.filter(receipt => receipt.state === 'committed').map(receipt => receipt.operationId);
    if (ids.length) {
      const settled=operations.filter(operation=>ids.includes(operation.operationId));
      changedOperations.push(...settled);
      await acknowledgeOperations(scope, ids); committed = true;
    }
    for (const receipt of receipts.filter(receipt => receipt.state === 'conflict')) await changeOperationState(scope, [receipt.operationId], 'conflict', undefined, receipt.error);
  }
  if(committed && typeof window!=='undefined') window.dispatchEvent(new CustomEvent('arkaiv-sync-committed',{detail:{operations:changedOperations}}));
  return committed;
}
export async function submitDurableOperations(scope: string, operations: LocalMutation[]) {
  operations=operations.filter(operation=>shouldSubmitOperation(operation));
  if(!operations.length) return;
  for (const candidates of packSyncOperations(operations)) {
    const batch = await claimOperations(scope, candidates.map(operation => operation.operationId));
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
const remoteVersions=new Map<string,number>();
let nextVersionAt=0;
export async function checkDurableVersion() {
  const config=getSpreadsheetConfig();if(!config || config.authMode==='oauth' || Date.now()<nextVersionAt) return;
  nextVersionAt=Date.now()+30000;
  const response=await authenticatedAppFetch('/api/spreadsheets/sync/version',{spreadsheetId:config.spreadsheetId});if(!response.ok) return;
  const {shared,version}=await response.json();if(!shared) return;
  const previous=remoteVersions.get(config.spreadsheetId);remoteVersions.set(config.spreadsheetId,version.revision);
  if((previous!==undefined ? previous!==version.revision : version.revision>0) && typeof window!=='undefined') window.dispatchEvent(new CustomEvent('arkaiv-sync-committed',{detail:{tables:version.tables?.length ? version.tables : undefined}}));
}
export function replayDurableOutbox() {
  if (replaying) return replaying;
  const run=async () => {
    const config = getSpreadsheetConfig();
    if (!config || config.authMode === 'oauth' || typeof indexedDB === 'undefined') return;
    const scope = config.spreadsheetId; const local = await readLocalState(scope);
    if (!local.operations.some(operation=>shouldPollOperation(operation) || shouldSubmitOperation(operation))) return;
    const capabilities = await durableCapabilities(scope);
    if (!capabilities.enabled) return;
    // Status is advisory: an unavailable read must not block durable acceptance of new writes.
    await reconcileDurableReceipts(scope, local.operations).catch(()=>{});
    const remaining = await readLocalState(scope);
    const conflicts = remaining.operations.filter(operation => operation.state === 'conflict');
    if (conflicts.length && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('arkaiv-sync-conflict', { detail: conflicts }));
    if (!capabilities.ready) throw new Error('Migration/configuration is incomplete; local changes are safe');
    // Stable IDs make re-submission safe even after an unknown queue acceptance or retention expiry.
    await submitDurableOperations(scope, remaining.operations.filter(operation => operation.state !== 'conflict'));
  };
  replaying=(typeof navigator!=='undefined' && navigator.locks ? navigator.locks.request('arkaiv-outbox-replay',{ifAvailable:true},lock=>lock ? run() : undefined) : run()).finally(()=>{replaying=undefined;});
  return replaying;
}
