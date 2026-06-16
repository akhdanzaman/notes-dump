import assert from 'node:assert/strict';
import test from 'node:test';
import {
  encodeShoppingLineItemsForSheet,
  parseShoppingLineItemsFromSheet,
  sanitizeShoppingLineItems,
  sumShoppingLineItems,
} from '../shoppingLineItems';

test('sanitizeShoppingLineItems keeps valid rows and normalizes optional values', () => {
  const rows = sanitizeShoppingLineItems([
    { id: '', name: '  Eggs ', quantity: ' 12 pcs ', amount: 32000 },
    { id: 'empty', name: '   ', quantity: '', amount: undefined },
    { id: 'bad-amount', name: 'Milk', amount: Number.NaN },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, 'Eggs');
  assert.equal(rows[0].quantity, '12 pcs');
  assert.equal(rows[0].amount, 32000);
  assert.equal(rows[1].name, 'Milk');
  assert.equal(rows[1].amount, undefined);
});

test('sumShoppingLineItems totals line item amounts only', () => {
  assert.equal(sumShoppingLineItems([
    { id: 'a', name: 'Rice', amount: 78000 },
    { id: 'b', name: 'Oil', amount: 41000 },
    { id: 'c', name: 'Note only' },
  ]), 119000);
});

test('shopping line items round-trip through sheet JSON', () => {
  const encoded = encodeShoppingLineItemsForSheet([
    { id: 'a', name: 'Rice', quantity: '5 kg', amount: 78000 },
  ]);

  assert.deepEqual(parseShoppingLineItemsFromSheet(encoded), [
    { id: 'a', name: 'Rice', quantity: '5 kg', amount: 78000 },
  ]);
  assert.equal(parseShoppingLineItemsFromSheet('not json'), undefined);
});
