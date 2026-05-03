import test from 'node:test';
import assert from 'node:assert/strict';

import { FEATURE_TUTORIALS, getFeatureTutorialKey, parseSeenFeatureTutorials } from '../featureTutorials';

test('feature tutorial key follows discovered tab and sub-feature', () => {
  assert.equal(getFeatureTutorialKey({
    activeTab: 'summary',
    planSubTab: 'tasks',
    librarySubTab: 'general',
    moneyView: 'transactions',
    isControlCenterOpen: false,
  }), 'summary');

  assert.equal(getFeatureTutorialKey({
    activeTab: 'plan',
    planSubTab: 'shopping',
    librarySubTab: 'general',
    moneyView: 'transactions',
    isControlCenterOpen: false,
  }), 'plan.shopping');

  assert.equal(getFeatureTutorialKey({
    activeTab: 'library',
    planSubTab: 'tasks',
    librarySubTab: 'journal',
    moneyView: 'transactions',
    isControlCenterOpen: false,
  }), 'library.journal');

  assert.equal(getFeatureTutorialKey({
    activeTab: 'money',
    planSubTab: 'tasks',
    librarySubTab: 'general',
    moneyView: 'wallets',
    isControlCenterOpen: false,
  }), 'money.wallets');

  assert.equal(getFeatureTutorialKey({
    activeTab: 'calendar',
    planSubTab: 'tasks',
    librarySubTab: 'general',
    moneyView: 'transactions',
    isControlCenterOpen: true,
  }), 'control-center');
});

test('parseSeenFeatureTutorials tolerates corrupt storage and drops unknown keys', () => {
  assert.deepEqual(parseSeenFeatureTutorials(null), []);
  assert.deepEqual(parseSeenFeatureTutorials('not json'), []);
  assert.deepEqual(parseSeenFeatureTutorials(JSON.stringify(['summary', 'unknown', 'money.budget'])), ['summary', 'money.budget']);
});

test('every feature tutorial includes manual and input-bar examples', () => {
  for (const tutorial of Object.values(FEATURE_TUTORIALS)) {
    assert.match(tutorial.manualExample, /^Manual:/);
    assert.match(tutorial.inputBarExample, /^Input bar:/);
  }
});
