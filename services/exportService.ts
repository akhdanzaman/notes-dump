
import * as XLSX from 'xlsx';
import { BrainDumpItem, Skill, Wallet, BudgetConfig, AppSettings } from '../types';
import { generateExportData } from '../utils/exportUtils';

export const exportToExcel = (
  items: BrainDumpItem[],
  skills: Skill[],
  wallets: Wallet[],
  budgetConfig: BudgetConfig,
  monthlyThemes: Record<string, string>,
  appSettings: AppSettings
) => {
  const workbook = XLSX.utils.book_new();
  const sheets = generateExportData(items, skills, wallets, budgetConfig, monthlyThemes, appSettings);

  sheets.forEach(sheetData => {
    const sheet = XLSX.utils.aoa_to_sheet(sheetData.data);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetData.name);
  });

  // --- Generate File ---
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Arkaiv_Export_${dateStr}.xlsx`);
};
