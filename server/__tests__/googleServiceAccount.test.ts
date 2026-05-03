import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SERVICE_ACCOUNT_EMAIL,
  checkServiceAccountSpreadsheetAccess,
  getConfiguredServiceAccountEmail,
  validateSheetsPath,
  validateSpreadsheetId,
} from '../googleServiceAccount';

test('service account helpers expose configured email without requiring OAuth', async () => {
  const originalJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const originalKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const originalPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  try {
    assert.equal(getConfiguredServiceAccountEmail(), DEFAULT_SERVICE_ACCOUNT_EMAIL);
    const status = await checkServiceAccountSpreadsheetAccess('spreadsheet_123-ABC');
    assert.deepEqual(status, {
      configured: false,
      serviceAccountEmail: DEFAULT_SERVICE_ACCOUNT_EMAIL,
      accessible: false,
      error: 'Server service account private key is not configured.',
    });
  } finally {
    if (originalJson === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    else process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalJson;
    if (originalKey === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    else process.env.GOOGLE_SERVICE_ACCOUNT_KEY = originalKey;
    if (originalPrivateKey === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    else process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = originalPrivateKey;
    if (originalEmail === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    else process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalEmail;
  }
});

test('service account proxy validators restrict spreadsheet ids and Sheets API paths', () => {
  assert.equal(validateSpreadsheetId('abc_123-DEF'), 'abc_123-DEF');
  assert.equal(validateSheetsPath(''), '');
  assert.equal(validateSheetsPath(':batchUpdate'), ':batchUpdate');
  assert.equal(validateSheetsPath('/values/Transactions!A%3AK'), '/values/Transactions!A%3AK');
  assert.equal(validateSheetsPath('/values/Transactions!A%3AK?valueInputOption=USER_ENTERED'), '/values/Transactions!A%3AK?valueInputOption=USER_ENTERED');

  assert.throws(() => validateSpreadsheetId('../secret'), /Invalid spreadsheetId/);
  assert.throws(() => validateSheetsPath('https://sheets.googleapis.com/v4/spreadsheets/x'), /Invalid Google Sheets API path/);
  assert.throws(() => validateSheetsPath('/developerMetadata'), /Unsupported Google Sheets API path/);
});
