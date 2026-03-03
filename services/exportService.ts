
import * as XLSX from 'xlsx';
import { BrainDumpItem, Skill, Wallet, BudgetConfig, AppSettings, ItemType } from '../types';

export const exportToExcel = (
  items: BrainDumpItem[],
  skills: Skill[],
  wallets: Wallet[],
  budgetConfig: BudgetConfig,
  monthlyThemes: Record<string, string>,
  appSettings: AppSettings
) => {
  const workbook = XLSX.utils.book_new();

  // Helper to format date
  const fmtDate = (dateStr?: string) => {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleDateString() + ' ' + new Date(dateStr).toLocaleTimeString();
  };

  // Helper to resolve wallet name
  const getWalletName = (id?: string) => {
      if (!id) return '';
      const w = wallets.find(w => w.id === id);
      return w ? w.name : id;
  };

  // Helper to resolve budget category
  const getCategoryName = (id?: string) => {
      if (!id) return '';
      const r = budgetConfig.rules.find(r => r.id === id);
      return r ? r.name : id;
  };

  // --- Sheet 1: Transactions (Money Tab) ---
  const transactions = items
    .filter(i => i.type === ItemType.FINANCE || (i.type === ItemType.SHOPPING && i.status === 'done'))
    .map(item => {
      const isShopping = item.type === ItemType.SHOPPING;
      const date = isShopping ? (item.completed_at || item.created_at) : (item.meta.date || item.created_at);
      
      return {
        Date: fmtDate(date),
        Type: isShopping ? 'expense' : (item.meta.financeType || 'expense'),
        Category: getCategoryName(item.meta.budgetCategory),
        Description: item.content,
        Amount: item.meta.amount || 0,
        Wallet: getWalletName(item.meta.paymentMethod),
        To_Wallet: getWalletName(item.meta.toWallet),
        Tags: item.meta.tags?.join(', ') || ''
      };
    });

  if (transactions.length > 0) {
      const sheet = XLSX.utils.json_to_sheet(transactions);
      XLSX.utils.book_append_sheet(workbook, sheet, "Transactions");
  }

  // --- Sheet 2: Todos ---
  const todos = items.filter(i => i.type === ItemType.TODO).map(item => ({
      Status: item.status,
      Content: item.content,
      Tags: item.meta.tags?.join(', ') || '',
      Created_At: fmtDate(item.created_at),
      Completed_At: fmtDate(item.completed_at),
      Progress: item.meta.progress ? `${item.meta.progress}%` : '',
      Progress_Notes: item.meta.progressNotes || ''
  }));
  if (todos.length > 0) {
      const sheet = XLSX.utils.json_to_sheet(todos);
      XLSX.utils.book_append_sheet(workbook, sheet, "Todos");
  }

  // --- Sheet 3: Shopping ---
  const shopping = items.filter(i => i.type === ItemType.SHOPPING).map(item => ({
      Status: item.status,
      Item: item.content,
      Amount: item.meta.amount || 0,
      Category: item.meta.shoppingCategory || '',
      Quantity: item.meta.quantity || '',
      Tags: item.meta.tags?.join(', ') || ''
  }));
  if (shopping.length > 0) {
      const sheet = XLSX.utils.json_to_sheet(shopping);
      XLSX.utils.book_append_sheet(workbook, sheet, "Shopping");
  }

  // --- Sheet 4: Events ---
  const events = items.filter(i => i.type === ItemType.EVENT).map(item => ({
      Date: fmtDate(item.meta.date),
      Event: item.content,
      Tags: item.meta.tags?.join(', ') || ''
  }));
  if (events.length > 0) {
      const sheet = XLSX.utils.json_to_sheet(events);
      XLSX.utils.book_append_sheet(workbook, sheet, "Events");
  }

  // --- Sheet 5: Notes & Journals ---
  const notes = items.filter(i => i.type === ItemType.NOTE || i.type === ItemType.JOURNAL).map(item => ({
      Date: fmtDate(item.created_at),
      Type: item.type,
      Content: item.content,
      Tags: item.meta.tags?.join(', ') || ''
  }));
  if (notes.length > 0) {
      const sheet = XLSX.utils.json_to_sheet(notes);
      XLSX.utils.book_append_sheet(workbook, sheet, "Notes & Journals");
  }

  // --- Sheet 6: Skill Logs ---
  const skillLogs = items.filter(i => i.type === ItemType.SKILL_LOG).map(item => ({
      Date: fmtDate(item.meta.date || item.created_at),
      Skill: item.meta.skillName || '',
      Duration_Minutes: item.meta.durationMinutes || 0,
      Content: item.content,
      Tags: item.meta.tags?.join(', ') || ''
  }));
  if (skillLogs.length > 0) {
      const sheet = XLSX.utils.json_to_sheet(skillLogs);
      XLSX.utils.book_append_sheet(workbook, sheet, "Skill Logs");
  }

  // --- Sheet 7: All Items (Backup) ---
  const itemsData = items.map(item => ({
    ID: item.id,
    Type: item.type,
    Content: item.content,
    Status: item.status,
    Created_At: item.created_at,
    Completed_At: item.completed_at || '',
    Date: item.meta.date || '',
    Amount: item.meta.amount || 0,
    Tags: item.meta.tags?.join(', ') || '',
    Payment_Method: item.meta.paymentMethod || '',
    To_Wallet: item.meta.toWallet || '',
    Finance_Type: item.meta.financeType || '',
    Budget_Category: item.meta.budgetCategory || '',
    Skill_Name: item.meta.skillName || '',
    Skill_ID: item.meta.skillId || '',
    Duration_Minutes: item.meta.durationMinutes || 0,
    Shopping_Category: item.meta.shoppingCategory || '',
    Recurrence_Days: item.meta.recurrenceDays || '',
  }));

  const itemsSheet = XLSX.utils.json_to_sheet(itemsData);
  XLSX.utils.book_append_sheet(workbook, itemsSheet, "All Items (Raw)");

  // --- Sheet 8: Wallets ---
  const walletsData = wallets.map(w => ({
    ID: w.id,
    Name: w.name,
    Type: w.type,
    Initial_Balance: w.initialBalance,
    Color: w.color
  }));
  const walletsSheet = XLSX.utils.json_to_sheet(walletsData);
  XLSX.utils.book_append_sheet(workbook, walletsSheet, "Wallets Config");

  // --- Sheet 9: Skills ---
  const skillsData = skills.map(s => ({
    ID: s.id,
    Name: s.name,
    Weekly_Target_Minutes: s.weeklyTargetMinutes || 0,
    Created_At: s.created_at,
    Color: s.color
  }));
  const skillsSheet = XLSX.utils.json_to_sheet(skillsData);
  XLSX.utils.book_append_sheet(workbook, skillsSheet, "Skills Config");

  // --- Sheet 10: Budget Config ---
  const budgetData = [
    { Property: 'Monthly Income', Value: budgetConfig.monthlyIncome },
    ...budgetConfig.rules.map(r => ({
      Property: `Rule: ${r.name}`,
      Value: `${r.percentage}% (ID: ${r.id})`
    }))
  ];
  const budgetSheet = XLSX.utils.json_to_sheet(budgetData);
  XLSX.utils.book_append_sheet(workbook, budgetSheet, "Budget Rules");

  // --- Sheet 11: Themes & Settings ---
  const themesData = Object.entries(monthlyThemes).map(([key, value]) => ({
    Type: 'Theme',
    Key: key,
    Value: value
  }));
  
  const settingsData = [
    { Type: 'Setting', Key: 'Default Collapsed', Value: appSettings.defaultCollapsed ? 'TRUE' : 'FALSE' },
    { Type: 'Setting', Key: 'Hide Money', Value: appSettings.hideMoney ? 'TRUE' : 'FALSE' }
  ];

  const miscSheet = XLSX.utils.json_to_sheet([...themesData, ...settingsData]);
  XLSX.utils.book_append_sheet(workbook, miscSheet, "Themes & Settings");

  // --- Generate File ---
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `BrainDump_Export_${dateStr}.xlsx`);
};
