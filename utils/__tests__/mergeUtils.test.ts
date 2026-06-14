import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeDbData } from '../mergeUtils';
import { DbSchema, ItemType } from '../../types';

test('mergeDbData preserves canonical rules from local and remote snapshots', () => {
  const local: DbSchema = {
    data: [],
    canonicalRules: [
      {
        id: 'rule-local',
        field: 'merchant',
        canonicalValue: 'Mie Gacoan',
        aliases: ['gacoan'],
        source: 'learned',
        approvalCount: 2,
        rejectionCount: 0,
        createdAt: '2026-05-02T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z',
      },
    ],
  };

  const remote: DbSchema = {
    data: [],
    canonicalRules: [
      {
        id: 'rule-remote',
        field: 'paymentMethod',
        canonicalValue: 'BCA',
        aliases: ['debit bca'],
        source: 'system',
        approvalCount: 999,
        rejectionCount: 0,
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
    ],
  };

  const merged = mergeDbData(local, remote);

  assert.equal(merged.canonicalRules?.length, 2);
  assert.deepEqual(
    merged.canonicalRules?.map(rule => rule.id).sort(),
    ['rule-local', 'rule-remote']
  );
});

test('mergeDbData consolidates duplicate learned canonical rules across snapshots', () => {
  const local: DbSchema = {
    data: [],
    canonicalRules: [
      {
        id: 'local-kopken',
        field: 'merchant',
        canonicalValue: 'Kopi Kenangan',
        aliases: ['kopken'],
        source: 'learned',
        approvalCount: 2,
        rejectionCount: 0,
        createdAt: '2026-05-02T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z',
      },
    ],
  };

  const remote: DbSchema = {
    data: [],
    canonicalRules: [
      {
        id: 'remote-kopken',
        field: 'merchant',
        canonicalValue: 'kopi kenangan',
        aliases: ['kopi kenangan official'],
        source: 'learned',
        approvalCount: 1,
        rejectionCount: 0,
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
    ],
  };

  const merged = mergeDbData(local, remote);

  assert.equal(merged.canonicalRules?.length, 1);
  assert.deepEqual(merged.canonicalRules?.[0].aliases.sort(), ['kopi kenangan official', 'kopken']);
  assert.equal(merged.canonicalRules?.[0].approvalCount, 3);
});

test('mergeDbData round-trips background enrichment without overwriting remote manual item edits', () => {
  const baseItem = {
    id: 'sync-item',
    type: ItemType.FINANCE,
    content: 'sarapan 14000 cash',
    status: 'done' as const,
    created_at: '2026-05-09T01:00:00.000Z',
    completed_at: '2026-05-09T01:00:00.000Z',
    meta: {
      amount: 14000,
      financeType: 'expense' as const,
    },
  };

  const local: DbSchema = {
    data: [{
      ...baseItem,
      meta: {
        ...baseItem.meta,
        commodity: 'food',
        subcommodity: 'breakfast',
        canonical: {
          commodity: { rawValue: 'food', value: 'food', confidence: 1, source: 'context_inference' as const, needsReview: false },
          subcommodity: { rawValue: 'breakfast', value: 'breakfast', confidence: 1, source: 'context_inference' as const, needsReview: false },
        },
        enrichment: {
          status: 'applied' as const,
          version: 1,
          updatedAt: '2026-05-09T01:01:00.000Z',
          appliedFields: ['commodity', 'subcommodity', 'canonical.commodity', 'canonical.subcommodity'],
        },
      },
    }],
  };

  const remote: DbSchema = {
    data: [{
      ...baseItem,
      content: 'manual edited breakfast',
      meta: {
        ...baseItem.meta,
        paymentMethod: 'cash-wallet',
      },
    }],
  };

  const merged = mergeDbData(local, remote, { data: [baseItem] });
  const item = merged.data[0];

  assert.equal(item.content, 'manual edited breakfast');
  assert.equal(item.meta.paymentMethod, 'cash-wallet');
  assert.equal(item.meta.commodity, 'food');
  assert.equal(item.meta.subcommodity, 'breakfast');
  assert.equal(item.meta.canonical?.commodity?.value, 'food');
  assert.equal(item.meta.enrichment?.status, 'applied');
});

test('mergeDbData preserves manual spreadsheet edits to existing skills and wallets', () => {
  const base: DbSchema = {
    data: [],
    skills: [{ id: 'skill-1', name: 'Coding', color: 'blue', created_at: '2026-05-01T00:00:00.000Z', weeklyTargetMinutes: 120 }],
    wallets: [{ id: 'wallet-1', name: 'Cash', type: 'cash', initialBalance: 100000, color: 'green' }],
  };

  const local: DbSchema = {
    ...base,
    data: [{ id: 'local-new', type: ItemType.NOTE, content: 'new local note', status: 'pending', created_at: '2026-05-02T00:00:00.000Z', meta: {} }],
  };

  const remote: DbSchema = {
    data: [],
    skills: [{ ...base.skills![0], name: 'Coding Pro', weeklyTargetMinutes: 180 }],
    wallets: [{ ...base.wallets![0], name: 'Pocket Cash', initialBalance: 125000 }],
  };

  const merged = mergeDbData(local, remote, base);

  assert.equal(merged.skills?.[0].name, 'Coding Pro');
  assert.equal(merged.skills?.[0].weeklyTargetMinutes, 180);
  assert.equal(merged.wallets?.[0].name, 'Pocket Cash');
  assert.equal(merged.wallets?.[0].initialBalance, 125000);
  assert.equal(merged.data.some(item => item.id === 'local-new'), true);
});

test('mergeDbData keeps skill metadata during concurrent skill edits', () => {
  const baseSkill = {
    id: 'skill-1',
    name: 'Coding',
    description: 'Old description',
    imageUrl: 'https://example.com/old.jpg',
    color: 'blue',
    created_at: '2026-05-01T00:00:00.000Z',
    weeklyTargetMinutes: 120,
    schedule: { enabled: true, interval: 'weekly' as const, daysOfWeek: [1], startTime: '09:00', endTime: '10:00' },
  };

  const base: DbSchema = { data: [], skills: [baseSkill] };
  const local: DbSchema = {
    data: [],
    skills: [{
      ...baseSkill,
      description: 'Local description',
      imageUrl: 'https://example.com/local.jpg',
      schedule: { enabled: true, interval: 'weekly' as const, daysOfWeek: [2], startTime: '10:00', endTime: '11:00' },
    }],
  };
  const remote: DbSchema = {
    data: [],
    skills: [{ ...baseSkill, name: 'Coding Pro', weeklyTargetMinutes: 180 }],
  };

  const merged = mergeDbData(local, remote, base);
  const skill = merged.skills?.[0];

  assert.equal(skill?.name, 'Coding Pro');
  assert.equal(skill?.description, 'Local description');
  assert.equal(skill?.imageUrl, 'https://example.com/local.jpg');
  assert.equal(skill?.weeklyTargetMinutes, 180);
  assert.deepEqual(skill?.schedule?.daysOfWeek, [2]);
});

