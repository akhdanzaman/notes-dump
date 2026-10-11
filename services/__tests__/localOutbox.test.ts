import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { ItemType, type DbSchema } from '../../types';
import { persistLocalState, readLocalState, reconstructBaseline, changeOperationState, acknowledgeOperations, closeLocalStore, persistDraft, readDrafts } from '../localOutbox';
import { mergeFetchedItemsPreservingUnsavedLocal } from '../../hooks/useBrainDumpData';
import { mergeDbData } from '../../utils/mergeUtils';
import { __test__ } from '../spreadsheetService';
Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: indexedDB });
const item = { id: 'one', type: ItemType.NOTE, content: 'old', created_at: '2026-10-01', status: 'pending' as const, meta: {} };
const base: DbSchema = { data: [item], appSettings: { defaultCollapsed: false, hideMoney: false }, customPrompt: 'old', monthlyThemes: { '2026-10': 'old' } };
test('entity + delete tombstone survive store restart; scopes do not mix', async () => {
  await persistLocalState('offline-a', { ...base, data: [] }, base);
  await persistLocalState('offline-b', base, { data: [] });
  closeLocalStore();
  const local = await readLocalState('offline-a');
  assert.deepEqual(local.data?.data, []);
  assert.equal(local.operations.length, 1);
  assert.equal(local.operations[0].after, null);
  assert.deepEqual(reconstructBaseline(local.data!, local.operations).data, base.data);
  assert.deepEqual((await readLocalState('offline-b')).data?.data, base.data);
});
test('pending edits coalesce, but a sending operation is immutable and an old ack cannot remove a new edit', async () => {
  const scope = 'burst';
  await persistLocalState(scope, { ...base, data: [{ ...item, content: 'a' }] }, base);
  await persistLocalState(scope, { ...base, data: [{ ...item, content: 'b' }] });
  let local = await readLocalState(scope);
  assert.equal(local.operations.length, 1);
  assert.equal((local.operations[0].before as any).content, 'old');
  const first = local.operations[0].operationId;
  await changeOperationState(scope, [first], 'sending');
  await persistLocalState(scope, { ...base, data: [{ ...item, content: 'c' }] });
  await acknowledgeOperations(scope, [first]);
  local = await readLocalState(scope);
  assert.equal(local.operations.length, 1);
  assert.notEqual(local.operations[0].operationId, first);
  assert.equal((local.operations[0].after as any).content, 'c');
  assert.equal(local.data?.data[0].content, 'c');
});
test('raw parser drafts survive close before parsing completes', async () => {
  await persistDraft('draft-scope', 'draft-one', 'makan 25rb'); closeLocalStore();
  assert.equal((await readDrafts('draft-scope'))[0].text, 'makan 25rb');
});
test('refresh and save never resurrect a known deletion', () => {
  assert.deepEqual(mergeFetchedItemsPreservingUnsavedLocal(base.data, [], base.data), []);
  assert.deepEqual(__test__.preserveLocalItemsStillPresentInApp(base, { ...base, data: [] }, base).data, []);
});
test('remote-only settings, cleared prompt and themes win against an unchanged local baseline', () => {
  const remote = { ...base, appSettings: { defaultCollapsed: true, hideMoney: true }, customPrompt: '', monthlyThemes: { '2026-10': 'new' } };
  const merged = mergeDbData(base, remote, base);
  assert.deepEqual(merged.appSettings, remote.appSettings);
  assert.equal(merged.customPrompt, '');
  assert.deepEqual(merged.monthlyThemes, remote.monthlyThemes);
});
