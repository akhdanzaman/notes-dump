import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import LibraryView from '../views/LibraryView';
import MoneyView from '../views/MoneyView';
import PlanView from '../views/PlanView';
import SummaryView from '../views/SummaryView';
import type { AppSettings, ItemUpdateHandler } from '../../types';
import { ItemType } from '../../types';

const noop = () => undefined;
const updateItem: ItemUpdateHandler = () => undefined;
const appSettings: AppSettings = { defaultCollapsed: true, hideMoney: false, language: 'id' };
const budgetConfig = { monthlyIncome: 0, rules: [] };

test('Plan applies workspace search to shopping, saving goals and investments', () => {
  const items = (['not_urgent', 'saving', 'investment'] as const).map(category => ({
    id: category, type: ItemType.SHOPPING, status: 'pending' as const,
    content: `SEARCH_TARGET_${category}`, created_at: '2026-09-01T12:00:00Z',
    meta: { shoppingCategory: category, targetAmount: 1000 },
  }));
  const props: React.ComponentProps<typeof PlanView> = {
    items, skills: [], planSubTab: 'shopping', setPlanSubTab: noop,
    focusDate: new Date('2026-09-01T12:00:00Z'), setFocusDate: noop,
    appSettings, handleToggleStatus: noop, handleDelete: noop,
    handleKeepRawTodo: noop, handleRetriggerDeepWorkTodo: noop,
    handleAcceptDeepWorkTodo: noop, handleUpdateItem: updateItem,
    handleOpenAddRoutine: noop, handleOpenAddTask: noop, handleOpenAddShopping: noop,
    handleOpenEditSkill: noop, handleOpenAddSkill: noop, setDeleteId: noop,
    setDeleteType: noop, searchQuery: '', selectedTag: '', wallets: [], budgetRules: [],
    handleResetRoutine: noop, onAddFunds: noop, onCompleteGoal: noop,
    handleOpenAddLoan: noop, setActiveTab: noop,
  };
  for (const planSubTab of ['shopping', 'savings'] as const) {
    const before = renderToStaticMarkup(React.createElement(PlanView, { ...props, planSubTab }));
    const after = renderToStaticMarkup(React.createElement(PlanView, { ...props, planSubTab, searchQuery: 'no-match' }));
    assert.match(before, /SEARCH_TARGET_/);
    assert.doesNotMatch(after, /SEARCH_TARGET_/);
  }
});

test('Summary keeps its empty dashboard actions and Indonesian copy', () => {
  const html = renderToStaticMarkup(React.createElement(SummaryView, {
    items: [], skills: [], wallets: [], budgetConfig, appSettings,
    themeNavDate: new Date('2026-09-01T12:00:00.000Z'), setThemeNavDate: noop,
    monthlyThemes: {}, onThemeEdit: noop, handleUpdateReceiptCapture: noop,
    handleToggleStatus: noop, setActiveTab: noop, setPlanSubTab: noop,
    showBalance: true, setShowBalance: noop, handleOpenAddTask: noop,
    handleOpenAddShopping: noop, handleOpenAddExpense: noop, handleOpenAddNote: noop,
    handleUpdateItem: updateItem, handleDelete: noop, handleKeepRawTodo: noop,
    handleRetriggerDeepWorkTodo: noop, handleAcceptDeepWorkTodo: noop,
    handleResetRoutine: noop,
  }));

  assert.match(html, /Uang, rencana, dan kehidupan harian/);
  assert.match(html, /Catat transaksi/);
});

test('Plan keeps task navigation and empty-state actions', () => {
  const html = renderToStaticMarkup(React.createElement(PlanView, {
    items: [], skills: [], planSubTab: 'tasks', setPlanSubTab: noop,
    focusDate: new Date('2026-09-01T12:00:00.000Z'), setFocusDate: noop,
    appSettings, handleToggleStatus: noop, handleDelete: noop,
    handleKeepRawTodo: noop, handleRetriggerDeepWorkTodo: noop,
    handleAcceptDeepWorkTodo: noop, handleUpdateItem: updateItem,
    handleOpenAddRoutine: noop, handleOpenAddTask: noop, handleOpenAddShopping: noop,
    handleOpenEditSkill: noop, handleOpenAddSkill: noop, setDeleteId: noop,
    setDeleteType: noop, searchQuery: '', selectedTag: '', wallets: [], budgetRules: [],
    handleResetRoutine: noop, onAddFunds: noop, onCompleteGoal: noop,
    handleOpenAddLoan: noop, setActiveTab: noop,
  }));

  assert.match(html, /Tugas &amp; rutinitas/);
  assert.match(html, /Tambah tugas/);
});

test('Money keeps wallet summary and transaction action with no records', () => {
  const html = renderToStaticMarkup(React.createElement(MoneyView, {
    items: [], wallets: [], budgetConfig, moneyView: 'wallets', setMoneyView: noop,
    financeDate: new Date('2026-09-01T12:00:00.000Z'), setFinanceDate: noop,
    showBalance: true, setShowBalance: noop, appSettings, handleDelete: noop,
    handleUpdateItem: updateItem, handleUpdateReceiptCapture: noop,
    handleToggleStatus: noop, handleOpenEditWallet: noop, handleOpenAddWallet: noop,
    setDeleteId: noop, setDeleteType: noop, setIsSettingsOpen: noop,
    filterWallet: 'all', filterTransactionType: 'all', filterCategory: 'all',
    filterMinAmount: '', filterMaxAmount: '', selectedTag: '', searchQuery: '',
    sortOrder: 'newest', savingGoals: [], setActiveTab: noop, onAddItem: noop,
  }));

  assert.match(html, /Kekayaan bersih saat ini/);
  assert.match(html, /Catat transaksi/);
});

test('Library keeps notes navigation and its empty state', () => {
  const html = renderToStaticMarkup(React.createElement(LibraryView, {
    items: [], skills: [], librarySubTab: 'general', setLibrarySubTab: noop,
    appSettings, handleDelete: noop, handleUpdateItem: updateItem,
    handleOpenEditSkill: noop, handleOpenAddSkill: noop,
    handleUpsertSkillSessionLog: noop, setDeleteId: noop, setDeleteType: noop,
    selectedTag: '', filterDate: '', filterDateTo: '', searchQuery: '',
    sortOrder: 'newest', setActiveTab: noop, onAddItem: noop,
  }));

  assert.match(html, /Semua catatan/);
  assert.match(html, /Belum ada catatan/);
});
