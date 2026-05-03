import test from 'node:test';
import assert from 'node:assert/strict';

import { createOnboardingSampleItems } from '../onboardingExamples';
import { ItemType, Wallet } from '../../types';

const wallet: Wallet = {
  id: 'wallet-main-bank',
  name: 'Main Bank',
  type: 'bank',
  initialBalance: 1000000,
  color: 'indigo-500',
};

test('onboarding sample data is valid BrainDump entries', () => {
  const samples = createOnboardingSampleItems(wallet, new Date('2026-05-03T12:00:00.000Z'));

  assert.equal(samples.length, 3);
  for (const item of samples) {
    assert.ok(item.id);
    assert.ok(Object.values(ItemType).includes(item.type));
    assert.ok(item.content);
    assert.ok(item.created_at);
    assert.ok(item.meta);
    assert.ok(item.status === 'pending' || item.status === 'done');
  }

  const finance = samples.find(item => item.type === ItemType.FINANCE);
  assert.equal(finance?.status, 'done');
  assert.equal(finance?.meta.paymentMethod, wallet.id);
  assert.equal(finance?.meta.financeType, 'expense');
  assert.equal(finance?.meta.amount, 150000);

  const todo = samples.find(item => item.type === ItemType.TODO);
  assert.equal(todo?.status, 'pending');
  assert.equal(todo?.meta.priority, 'normal');
});
