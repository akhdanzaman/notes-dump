
import * as XLSX from 'xlsx';
import { BrainDumpItem, Skill, Wallet, BudgetConfig, AppSettings } from '../types';

export const exportToExcel = (
  items: BrainDumpItem[],
  skills: Skill[],
  wallets: Wallet[],
  budgetConfig: BudgetConfig,
  monthlyThemes: Record<string, string>,
  appSettings: AppSettings
) => {
  const workbook = XLSX.utils.book_new();

  // --- Sheet 1: All Items ---
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
  XLSX.utils.book_append_sheet(workbook, itemsSheet, "All Items");

  // --- Sheet 2: Wallets ---
  const walletsData = wallets.map(w => ({
    ID: w.id,
    Name: w.name,
    Type: w.type,
    Initial_Balance: w.initialBalance,
    Color: w.color
  }));
  const walletsSheet = XLSX.utils.json_to_sheet(walletsData);
  XLSX.utils.book_append_sheet(workbook, walletsSheet, "Wallets");

  // --- Sheet 3: Skills ---
  const skillsData = skills.map(s => ({
    ID: s.id,
    Name: s.name,
    Weekly_Target_Minutes: s.weeklyTargetMinutes || 0,
    Created_At: s.created_at,
    Color: s.color
  }));
  const skillsSheet = XLSX.utils.json_to_sheet(skillsData);
  XLSX.utils.book_append_sheet(workbook, skillsSheet, "Skills");

  // --- Sheet 4: Budget Config ---
  const budgetData = [
    { Property: 'Monthly Income', Value: budgetConfig.monthlyIncome },
    ...budgetConfig.rules.map(r => ({
      Property: `Rule: ${r.name}`,
      Value: `${r.percentage}% (ID: ${r.id})`
    }))
  ];
  const budgetSheet = XLSX.utils.json_to_sheet(budgetData);
  XLSX.utils.book_append_sheet(workbook, budgetSheet, "Budget Rules");

  // --- Sheet 5: Themes & Settings ---
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
