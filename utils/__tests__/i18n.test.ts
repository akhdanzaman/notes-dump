import assert from 'node:assert/strict';
import test from 'node:test';
import { composerCopy, getAppLocale, normalizeAppLanguage, shellCopy } from '../i18n';

test('interface language defaults to Indonesian and exposes English explicitly', () => {
  assert.equal(normalizeAppLanguage(undefined), 'id');
  assert.equal(normalizeAppLanguage('en'), 'en');
  assert.equal(getAppLocale('id'), 'id-ID');
  assert.equal(getAppLocale('en'), 'en-US');
});

test('shell and composer copy switch together', () => {
  assert.equal(shellCopy('id').settings, 'Pengaturan');
  assert.equal(shellCopy('en').settings, 'Settings');
  assert.equal(composerCopy('id').capturePlaceholder, 'Catat sesuatu…');
  assert.equal(composerCopy('en').capturePlaceholder, 'Capture something…');
});
