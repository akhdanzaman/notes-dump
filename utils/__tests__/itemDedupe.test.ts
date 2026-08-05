import test from 'node:test';
import assert from 'node:assert/strict';

import { ItemType, BrainDumpItem } from '../../types';
import { dedupeBrainDumpItems } from '../itemDedupe';

const finance = (id: string, overrides: Partial<BrainDumpItem> = {}): BrainDumpItem => {
  const { meta: metaOverrides, ...itemOverrides } = overrides;
  return {
    id,
    type: ItemType.FINANCE,
    content: 'beli tws sparepart',
    status: 'done',
    created_at: '2026-05-08T10:00:00.000Z',
    completed_at: '2026-05-08T10:00:00.000Z',
    ...itemOverrides,
    meta: {
      financeType: 'expense',
      date: '2026-05-08T10:00:00.000Z',
      amount: 125_000,
      paymentMethod: 'BCA',
      ...(metaOverrides || {}),
    },
  };
};

test('dedupeBrainDumpItems removes physical rows only when their normalized IDs match', () => {
  const duplicated = finance('540c9ae3-ba1f-43c0-832f-01d62154edbe');
  const result = dedupeBrainDumpItems([
    duplicated,
    { ...duplicated, id: ' 540C9AE3-BA1F-43C0-832F-01D62154EDBE ' },
  ]);

  assert.equal(result.items.length, 1);
  assert.equal(result.removedCount, 1);
  assert.deepEqual(result.duplicateIds, [{ id: '540c9ae3-ba1f-43c0-832f-01d62154edbe', count: 2 }]);
  assert.equal(result.reviewCandidates.length, 0);
});

test('dedupeBrainDumpItems removes all repeated shopping rows for the same ID', () => {
  const repeated: BrainDumpItem[] = Array.from({ length: 17 }, (_, index) => ({
    id: 'fa6c9b77-4c61-49a8-bb79-3f12d806e0b5',
    type: ItemType.SHOPPING,
    content: 'PARKIR',
    status: 'pending',
    created_at: `2026-05-08T10:00:${String(index).padStart(2, '0')}.000Z`,
    meta: { shoppingCategory: 'routine', amount: 15_000 },
  }));

  const result = dedupeBrainDumpItems(repeated);

  assert.equal(result.items.length, 1);
  assert.equal(result.removedCount, 16);
  assert.equal(result.duplicateIds[0]?.count, 17);
});

test('different-ID semantic transaction duplicates are retained and sent to review', () => {
  const items = [
    finance('9bc80ed5-2a3e-4bdd-8d32-7f53d5e9f49c', {
      content: 'Send laundry',
      created_at: '2026-05-08T10:00:00.050Z',
      meta: { amount: 0, paymentMethod: '', date: '2026-05-08T10:00:00.050Z' },
    }),
    finance('ba3249e8-9677-49ec-b450-bd11b7be946f', {
      content: ' send  laundry ',
      created_at: '2026-05-08T10:00:00.900Z',
      meta: { amount: 0, paymentMethod: '', date: '2026-05-08T10:00:00.900Z' },
    }),
  ];

  const result = dedupeBrainDumpItems(items);

  assert.equal(result.removedCount, 0);
  assert.deepEqual(result.items.map(item => item.id), items.map(item => item.id));
  assert.equal(result.reviewCandidates.length, 1);
  assert.deepEqual(new Set(result.reviewCandidates[0].itemIds), new Set(items.map(item => item.id)));
});

test('repeated legitimate purchases with different IDs are never silently deleted', () => {
  const items = [
    finance('parking-1', { content: 'Parkir', meta: { amount: 15_000, date: '2026-05-08T08:00:00.000Z' } }),
    finance('parking-2', { content: 'Parkir', meta: { amount: 15_000, date: '2026-05-08T12:00:00.000Z' } }),
  ];

  const result = dedupeBrainDumpItems(items);

  assert.equal(result.removedCount, 0);
  assert.equal(result.items.length, 2);
  assert.equal(result.reviewCandidates.length, 0);
});

test('canonical same-ID selection is deterministic across input order', () => {
  const sparse = finance('same-id', {
    content: 'older sparse version',
    status: 'pending',
    completed_at: undefined,
    meta: { amount: 50_000 },
  });
  const complete = finance('same-id', {
    content: 'complete version',
    meta: { amount: 50_000, paymentMethod: 'BCA', budgetCategory: 'needs', merchant: 'Toko Audio' },
  });

  const forward = dedupeBrainDumpItems([sparse, complete]).items[0];
  const reverse = dedupeBrainDumpItems([complete, sparse]).items[0];

  assert.deepEqual(forward, complete);
  assert.deepEqual(reverse, complete);
});

test('items without IDs are preserved because identity cannot be established safely', () => {
  const first = finance('', { content: 'Cash expense' });
  const second = finance('   ', { content: 'Cash expense' });
  const result = dedupeBrainDumpItems([first, second]);

  assert.equal(result.items.length, 2);
  assert.equal(result.removedCount, 0);
});

