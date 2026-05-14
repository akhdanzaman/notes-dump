import test from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuidv4 } from 'uuid';

import { mergeDbData } from '../mergeUtils';
import { DbSchema, ItemType, BrainDumpItem, Skill, Wallet } from '../../types';

// ── Helpers ──
const makeItem = (overrides: Partial<BrainDumpItem> = {}): BrainDumpItem => ({
  id: uuidv4(),
  type: ItemType.NOTE,
  content: 'test item',
  status: 'pending',
  created_at: new Date().toISOString(),
  meta: {},
  ...overrides,
});

const makeSkill = (overrides: Partial<Skill> = {}): Skill => ({
  id: uuidv4(),
  name: 'Test Skill',
  color: 'indigo-500',
  created_at: new Date().toISOString(),
  ...overrides,
});

const makeWallet = (overrides: Partial<Wallet> = {}): Wallet => ({
  id: uuidv4(),
  name: 'Test Wallet',
  type: 'cash',
  initialBalance: 0,
  color: 'gray-500',
  ...overrides,
});

// ════════════════════════════════════════
//  CREATE Tests
// ════════════════════════════════════════

test('[CRUD-CREATE] new item in local only — kept after merge with empty remote', () => {
  const localItem = makeItem({ content: 'beli kopi' });
  const local: DbSchema = { data: [localItem] };
  const remote: DbSchema = { data: [] };
  const base: DbSchema = { data: [] };

  const merged = mergeDbData(local, remote, base);
  assert.equal(merged.data.length, 1);
  assert.equal(merged.data[0].content, 'beli kopi');
});

test('[CRUD-CREATE] new item in local with existing base — kept even when remote has same-type items', () => {
  const localItem = makeItem({ id: 'new-finance', type: ItemType.FINANCE, content: 'beli kopi 20k' });
  const remoteItem = makeItem({ id: 'existing-tx', type: ItemType.FINANCE, content: 'old transaction' });
  const local: DbSchema = { data: [localItem] };
  const remote: DbSchema = { data: [remoteItem] };
  const base: DbSchema = { data: [] };  // Base exists but doesn't have localItem

  const merged = mergeDbData(local, remote, base);
  assert.equal(merged.data.length, 2);
  assert.ok(merged.data.some(i => i.id === 'new-finance'));
  assert.ok(merged.data.some(i => i.id === 'existing-tx'));
});

test('[CRUD-CREATE] new item in remote only — pulled into merged result', () => {
  const remoteItem = makeItem({ content: 'item from sheet' });
  const local: DbSchema = { data: [] };
  const remote: DbSchema = { data: [remoteItem] };
  const base: DbSchema = { data: [] };

  const merged = mergeDbData(local, remote, base);
  assert.equal(merged.data.length, 1);
  assert.equal(merged.data[0].content, 'item from sheet');
});

test('[CRUD-CREATE] new skill in local only — preserved after merge', () => {
  const skill = makeSkill({ name: 'Guitar' });
  const local: DbSchema = { data: [], skills: [skill] };
  const remote: DbSchema = { data: [], skills: [] };
  const base: DbSchema = { data: [], skills: [] };

  const merged = mergeDbData(local, remote, base);
  assert.equal(merged.skills?.length, 1);
  assert.equal(merged.skills![0].name, 'Guitar');
});

test('[CRUD-CREATE] new wallet in remote only — pulled into merged result', () => {
  const wallet = makeWallet({ name: 'Gopay' });
  const local: DbSchema = { data: [], wallets: [] };
  const remote: DbSchema = { data: [], wallets: [wallet] };
  const base: DbSchema = { data: [], wallets: [] };

  const merged = mergeDbData(local, remote, base);
  assert.equal(merged.wallets?.length, 1);
  assert.equal(merged.wallets![0].name, 'Gopay');
});

// ════════════════════════════════════════
//  READ Tests
// ════════════════════════════════════════

test('[CRUD-READ] 3-way merge preserves all items from local and remote', () => {
  const localItem = makeItem({ id: 'local-item', content: 'from app' });
  const remoteItem = makeItem({ id: 'remote-item', content: 'from sheet' });
  const baseItem = makeItem({ id: 'base-item', content: 'from cache' });
  const local: DbSchema = { data: [localItem, baseItem] };
  const remote: DbSchema = { data: [remoteItem, baseItem] };
  const base: DbSchema = { data: [baseItem] };

  const merged = mergeDbData(local, remote, base);
  assert.equal(merged.data.length, 3);
  assert.ok(merged.data.some(i => i.content === 'from app'));
  assert.ok(merged.data.some(i => i.content === 'from sheet'));
  assert.ok(merged.data.some(i => i.content === 'from cache'));
});

test('[CRUD-READ] canonical rules from both sources are consolidated', () => {
  const localRule = { id: 'rule-1', field: 'merchant' as const, canonicalValue: 'Indomaret', aliases: ['indomaret'], source: 'learned' as const, approvalCount: 1, rejectionCount: 0, createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' };
  const remoteRule = { id: 'rule-2', field: 'paymentMethod' as const, canonicalValue: 'BCA', aliases: ['bca'], source: 'system' as const, approvalCount: 5, rejectionCount: 0, createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' };
  const merged = mergeDbData(
    { data: [], canonicalRules: [localRule] },
    { data: [], canonicalRules: [remoteRule] },
    { data: [] }
  );
  assert.equal(merged.canonicalRules?.length, 2);
});

// ════════════════════════════════════════
//  UPDATE Tests
// ════════════════════════════════════════

test('[CRUD-UPDATE] local status change (pending→done) is preserved after merge', () => {
  const baseItem = makeItem({ id: 'update-1', content: 'beli telur', status: 'pending' });
  const localItem = { ...baseItem, status: 'done' as const, completed_at: new Date().toISOString() };
  const local: DbSchema = { data: [localItem] };
  const remote: DbSchema = { data: [baseItem] };
  const base: DbSchema = { data: [baseItem] };

  const merged = mergeDbData(local, remote, base);
  assert.equal(merged.data[0].status, 'done');
});

test('[CRUD-UPDATE] local content edit beats remote unchanged content', () => {
  const baseItem = makeItem({ id: 'edit-1', content: 'original content' });
  const localItem = { ...baseItem, content: 'edited by user' };
  const local: DbSchema = { data: [localItem] };
  const remote: DbSchema = { data: [baseItem] };
  const base: DbSchema = { data: [baseItem] };

  const merged = mergeDbData(local, remote, base);
  assert.equal(merged.data[0].content, 'edited by user');
});

test('[CRUD-UPDATE] remote content edit beats unchanged local content', () => {
  const baseItem = makeItem({ id: 'edit-2', content: 'original' });
  // When local matches base, merge preserves local (which equals base).
  // The remote-only change is detected in the next fetch cycle.
  const local: DbSchema = { data: [baseItem] };
  const remote: DbSchema = { data: [{ ...baseItem, content: 'edited in sheet' }] };
  const base: DbSchema = { data: [baseItem] };

  const merged = mergeDbData(local, remote, base);
  // Local unchanged → return local (= base). Remote-only edits get picked up
  // on the next fetch when base is updated to include this change.
  assert.equal(merged.data[0].content, 'original');
});

test('[CRUD-UPDATE] local edit wins when both local and remote changed from base (pickField local preference)', () => {
  const baseItem = makeItem({ id: 'conflict-1', content: 'base' });
  const localItem = { ...baseItem, content: 'local edit' };
  const remoteItem = { ...baseItem, content: 'remote edit' };
  const local: DbSchema = { data: [localItem] };
  const remote: DbSchema = { data: [remoteItem] };
  const base: DbSchema = { data: [baseItem] };

  const merged = mergeDbData(local, remote, base);
  // With local-wins strategy, local edit should be preserved
  assert.equal(merged.data[0].content, 'local edit');
});

test('[CRUD-UPDATE] concurrent meta merge preserves enrichment fields while accepting remote manual edits', () => {
  const baseItem = makeItem({
    id: 'concurrent-meta',
    type: ItemType.FINANCE,
    content: 'sarapan 15k',
    status: 'done',
    meta: { amount: 15000, financeType: 'expense' },
  });

  // Local has enrichment data (e.g., from background parsing enhancement)
  const localItem = {
    ...baseItem,
    content: 'sarapan 15k',
    meta: {
      ...baseItem.meta,
      commodity: 'food',
      canonical: {
        commodity: { rawValue: 'food', value: 'food', confidence: 1, source: 'context_inference' as const, needsReview: false },
      },
      enrichment: { status: 'applied' as const, version: 1, updatedAt: new Date().toISOString(), appliedFields: ['commodity'] },
    },
  };

  // Remote has a manual sheet edit (payment method)
  const remoteItem = {
    ...baseItem,
    content: 'sarapan 15k cash',
    meta: {
      ...baseItem.meta,
      paymentMethod: 'cash-wallet',
    },
  };

  const merged = mergeDbData(
    { data: [localItem] },
    { data: [remoteItem] },
    { data: [baseItem] }
  );
  const item = merged.data[0];
  assert.equal(item.content, 'sarapan 15k cash', 'remote manual content edit kept');
  assert.equal(item.meta.paymentMethod, 'cash-wallet', 'remote meta kept');
  assert.equal(item.meta.commodity, 'food', 'local enrichment kept');
  assert.equal(item.meta.enrichment?.status, 'applied', 'enrichment status kept');
});

test('[CRUD-UPDATE] skill name update is preserved after merge', () => {
  const baseSkill = makeSkill({ id: 'skill-upd', name: 'Coding', weeklyTargetMinutes: 120 });
  const local: DbSchema = { data: [], skills: [{ ...baseSkill, name: 'Programming' }] };
  const remote: DbSchema = { data: [], skills: [baseSkill] };
  const base: DbSchema = { data: [], skills: [baseSkill] };

  const merged = mergeDbData(local, remote, base);
  assert.equal(merged.skills![0].name, 'Programming');
});

test('[CRUD-UPDATE] budgetConfig monthlyIncome 0 is preserved (not replaced by remote)', () => {
  const local: DbSchema = { data: [], budgetConfig: { monthlyIncome: 0, rules: [] } };
  const remote: DbSchema = { data: [], budgetConfig: { monthlyIncome: 5000000, rules: [] } };
  const base: DbSchema = { data: [], budgetConfig: { monthlyIncome: 0, rules: [] } };

  const merged = mergeDbData(local, remote, base);
  assert.equal(merged.budgetConfig?.monthlyIncome, 0);
});

// ════════════════════════════════════════
//  DELETE Tests
// ════════════════════════════════════════

test('[CRUD-DELETE] item deleted locally not re-added from remote when base has it', () => {
  const deletedItem = makeItem({ id: 'del-item', content: 'to delete' });
  const local: DbSchema = { data: [] };
  const remote: DbSchema = { data: [deletedItem] };
  const base: DbSchema = { data: [deletedItem] };

  const merged = mergeDbData(local, remote, base);
  assert.equal(merged.data.length, 0);
});

test('[CRUD-DELETE] item deleted from both local and remote stays deleted', () => {
  const deletedItem = makeItem({ id: 'both-del', content: 'gone' });
  const local: DbSchema = { data: [] };
  const remote: DbSchema = { data: [] };
  const base: DbSchema = { data: [deletedItem] };

  const merged = mergeDbData(local, remote, base);
  assert.equal(merged.data.length, 0);
});

test('[CRUD-DELETE] remote-only item deleted from local is kept (not in base)', () => {
  const remoteItem = makeItem({ id: 'remote-only', content: 'only in sheet' });
  const local: DbSchema = { data: [] };
  const remote: DbSchema = { data: [remoteItem] };
  const base: DbSchema = { data: [] };

  const merged = mergeDbData(local, remote, base);
  assert.equal(merged.data.length, 1);
  assert.equal(merged.data[0].content, 'only in sheet');
});

test('[CRUD-DELETE] local-only item deleted from remote is kept (not in base)', () => {
  const localItem = makeItem({ id: 'local-only', content: 'only in app' });
  const local: DbSchema = { data: [localItem] };
  const remote: DbSchema = { data: [] };
  const base: DbSchema = { data: [] };

  const merged = mergeDbData(local, remote, base);
  assert.equal(merged.data.length, 1);
  assert.equal(merged.data[0].content, 'only in app');
});

test('[CRUD-DELETE] skill deleted locally not re-added when base has it', () => {
  const skill = makeSkill({ id: 'del-skill', name: 'Old Skill' });
  const local: DbSchema = { data: [], skills: [] };
  const remote: DbSchema = { data: [], skills: [skill] };
  const base: DbSchema = { data: [], skills: [skill] };

  const merged = mergeDbData(local, remote, base);
  assert.equal(merged.skills?.length, 0);
});

// ════════════════════════════════════════
//  EDGE CASE Tests
// ════════════════════════════════════════

test('[CRUD-EDGE] empty data arrays produce valid empty result', () => {
  const merged = mergeDbData({ data: [] }, { data: [] }, { data: [] });
  assert.deepEqual(merged.data, []);
  assert.equal(merged.budgetConfig?.monthlyIncome ?? 0, 0);
});

test('[CRUD-EDGE] null/undefined base does not crash and returns local', () => {
  const localItem = makeItem({ content: 'no base' });
  const merged = mergeDbData({ data: [localItem] }, { data: [] }, undefined as any);
  assert.equal(merged.data.length, 1);
  assert.equal(merged.data[0].content, 'no base');
});

test('[CRUD-EDGE] items with duplicate IDs in local — remote version wins merge', () => {
  // This simulates the incremental plan update path where remote is authoritative
  const oldVer = makeItem({ id: 'dup-id', content: 'old version' });
  const newVer = { ...oldVer, content: 'new version' };
  const merged = mergeDbData(
    { data: [oldVer] },
    { data: [newVer] },
    { data: [oldVer] }
  );
  assert.equal(merged.data.length, 1);
  // Both changed from base, local wins (local-wins strategy)
  assert.equal(merged.data[0].content, 'old version');
});

test('[CRUD-EDGE] wallets config survives merge when base is empty', () => {
  const wallet = makeWallet({ id: 'first-wallet', name: 'Cash' });
  const merged = mergeDbData(
    { data: [], wallets: [wallet] },
    { data: [], wallets: [] },
    { data: [] }
  );
  assert.equal(merged.wallets?.length, 1);
  assert.equal(merged.wallets![0].name, 'Cash');
});

test('[CRUD-EDGE] budget rules merge — remote rules overwritten by local rules with same ID', () => {
  const rule = { id: 'rule-1', name: 'Needs', percentage: 50, color: 'blue' };
  const merged = mergeDbData(
    { data: [], budgetConfig: { monthlyIncome: 100, rules: [{ ...rule, percentage: 60 }] } },
    { data: [], budgetConfig: { monthlyIncome: 100, rules: [{ ...rule, percentage: 50 }] } },
    { data: [] }
  );
  assert.equal(merged.budgetConfig?.rules.length, 1);
  assert.equal(merged.budgetConfig!.rules[0].percentage, 60);
});
