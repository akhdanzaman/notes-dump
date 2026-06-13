import { BrainDumpItem, Skill, Wallet, BudgetConfig, AppSettings } from '../types';
import { generateExportData } from '../utils/exportUtils';

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const exportToExcel = (
  items: BrainDumpItem[],
  skills: Skill[],
  wallets: Wallet[],
  budgetConfig: BudgetConfig,
  monthlyThemes: Record<string, string>,
  appSettings: AppSettings,
  monthlyThemeImages: Record<string, string> = {}
) => {
  const sheets = generateExportData(items, skills, wallets, budgetConfig, monthlyThemes, appSettings, new Date(), { monthlyThemeImages });

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; }
      h2 { margin: 24px 0 8px; }
      table { border-collapse: collapse; margin-bottom: 24px; }
      th, td { border: 1px solid #d4d4d8; padding: 6px 8px; mso-number-format: "\\@"; }
      th { background: #f4f4f5; font-weight: 700; }
    </style>
  </head>
  <body>
    ${sheets.map(sheetData => `
      <h2>${escapeHtml(sheetData.name)}</h2>
      <table>
        ${sheetData.data.map((row, rowIndex) => `<tr>${row.map(cell => rowIndex === 0
          ? `<th>${escapeHtml(cell)}</th>`
          : `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
      </table>
    `).join('')}
  </body>
</html>`;

  // --- Generate File ---
  const dateStr = new Date().toISOString().split('T')[0];
  downloadBlob(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }), `Arkaiv_Export_${dateStr}.xls`);
};
