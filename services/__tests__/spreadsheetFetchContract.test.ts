import test from 'node:test';
import assert from 'node:assert/strict';

import { SPREADSHEET_FETCH_RANGES } from '../spreadsheetService';

test('spreadsheet fetch ranges include the expanded schema columns', () => {
  assert.equal(SPREADSHEET_FETCH_RANGES.Transactions, 'A:I');
  assert.equal(SPREADSHEET_FETCH_RANGES.Todos, 'A:AA');
  assert.equal(SPREADSHEET_FETCH_RANGES.Shopping, 'A:I');
  assert.equal(SPREADSHEET_FETCH_RANGES.Events, 'A:H');
});
