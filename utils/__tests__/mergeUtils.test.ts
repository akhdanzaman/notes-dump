import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeDbData } from '../mergeUtils';
import { DbSchema } from '../../types';

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
