import { Wallet, Skill, BudgetConfig, AppSettings, ChatMessage, CanonicalRule } from '../types';
import { parseSpreadsheetBudget } from './spreadsheetBudget';
import { v4 as uuidv4 } from 'uuid';
export const readHeaderAwareCell = (headers: unknown[], row: any[], name: string, fallbackIndex: number, aliases: string[] = []) => {
  const normalizedHeaders = headers.map(header => String(header || '').trim());
  const candidates = [name, ...aliases];
  const index = candidates
    .map(candidate => normalizedHeaders.indexOf(candidate))
    .find(candidateIndex => candidateIndex >= 0);
  return index !== undefined && index >= 0 ? row[index] : row[fallbackIndex];
};

const truthySheetValue = (value: unknown) => ['true', '1', 'yes', 'y', 'on'].includes(String(value || '').trim().toLowerCase());

const splitSheetListValue = (value: unknown): string[] => String(value || '')
  .split(/[;,\n]/)
  .map(part => part.trim())
  .filter(Boolean);

const normalizeTime = (value: unknown, fallback: string): string => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  return `${String(Math.min(Number(match[1]), 23)).padStart(2, '0')}:${String(Math.min(Number(match[2]), 59)).padStart(2, '0')}`;
};

export const parseConfigSheets = (valueRanges: any[], options: { createSkillIds?: boolean } = {}): {
  wallets: Wallet[];
  skills: Skill[];
  budgetConfig: BudgetConfig | undefined;
  hasBudgetIncome: boolean;
  monthlyThemes: Record<string, string>;
  monthlyThemeImages: Record<string, string>;
  appSettings: AppSettings | undefined;
  customPrompt: string | undefined;
  chatHistory: ChatMessage[] | undefined;
  canonicalRules: CanonicalRule[] | undefined;
} => {
  const wallets: Wallet[] = [];
  const skills: Skill[] = [];
  const chatHistory: ChatMessage[] = [];
  const canonicalRules: CanonicalRule[] = [];
  let budgetConfig: BudgetConfig | undefined;
  let hasBudgetIncome = false;
  const monthlyThemes: Record<string, string> = {};
  const monthlyThemeImages: Record<string, string> = {};
  let appSettings: AppSettings | undefined;
  let customPrompt: string | undefined;
  const ensureBudgetConfig = () => {
    if (!budgetConfig) budgetConfig = { monthlyIncome: 0, rules: [] };
    return budgetConfig;
  };
  const ensureAppSettings = () => {
    if (!appSettings) appSettings = { defaultCollapsed: false, hideMoney: false };
    return appSettings;
  };

  for (const vr of valueRanges) {
    const name = vr.range?.split('!')[0]?.replace(/'/g, '') || '';
    const rows = vr.values || [];
    if (rows.length < 2 && name !== 'Budget Rules') continue;
    const headers = rows[0] || [];
    const cell = (row: any[], header: string, fallbackIndex: number, aliases: string[] = []) => readHeaderAwareCell(headers, row, header, fallbackIndex, aliases);

    if (name === 'Wallets Config') {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const id = cell(r, 'ID', 0);
        if (!id) continue;
        wallets.push({
          id: String(id),
          name: String(cell(r, 'Name', 1) || ''),
          type: (String(cell(r, 'Type', 2) || 'cash')) as Wallet['type'],
          initialBalance: Number(cell(r, 'Initial_Balance', 3, ['Initial Balance'])) || 0,
          color: String(cell(r, 'Color', 4) || 'bg-gray-500'),
        });
      }
    } else if (name === 'Skills Config') {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const skillName = String(cell(r, 'Name', 1) || '').trim();
        const id = cell(r, 'ID', 0) || (options.createSkillIds && skillName ? uuidv4() : '');
        if (!id) continue;
        const enabledCell = cell(r, 'Schedule_Enabled', 5, ['Schedule Enabled']);
        const hasEnabledCell = String(enabledCell ?? '').trim() !== '';
        const hasSchedule = hasEnabledCell || [
          cell(r, 'Schedule_Interval', 6, ['Schedule Interval']),
          cell(r, 'Schedule_Start_Time', 10, ['Schedule Start Time']),
          cell(r, 'Schedule_End_Time', 11, ['Schedule End Time']),
        ].some(value => String(value || '').trim());
        const scheduleEnabled = hasEnabledCell ? truthySheetValue(enabledCell) : true;
        const scheduleIntervalRaw = String(cell(r, 'Schedule_Interval', 6, ['Schedule Interval']) || 'weekly').trim().toLowerCase();
        const scheduleInterval = ['daily', 'weekly', 'monthly', 'yearly'].includes(scheduleIntervalRaw)
          ? scheduleIntervalRaw as NonNullable<Skill['schedule']>['interval']
          : 'weekly';
        const scheduleStartTime = String(cell(r, 'Schedule_Start_Time', 10, ['Schedule Start Time']) || '09:00').trim();
        const scheduleEndTime = String(cell(r, 'Schedule_End_Time', 11, ['Schedule End Time']) || '10:00').trim();

        skills.push({
          id: String(id),
          name: skillName,
          description: String(cell(r, 'Description', 2, ['Desc']) || '') || undefined,
          imageUrl: String(cell(r, 'Image_URL', 3, ['Image URL', 'Image_Url', 'ImageUrl']) || '') || undefined,
          weeklyTargetMinutes: Number(cell(r, 'Weekly_Target_Minutes', 4, ['Weekly Target Minutes'])) || Number(cell(r, 'Weekly_Target_Minutes', 2, ['Weekly Target Minutes'])) || undefined,
          created_at: String(cell(r, 'Created_At', 12, ['Created At']) || cell(r, 'Created_At', 3, ['Created At']) || new Date().toISOString()),
          color: String(cell(r, 'Color', 13) || cell(r, 'Color', 4) || 'indigo-500'),
          schedule: hasSchedule ? {
            enabled: scheduleEnabled,
            interval: scheduleInterval,
            daysOfWeek: splitSheetListValue(cell(r, 'Schedule_Days_Of_Week', 7, ['Schedule Days Of Week'])).map(Number).filter(Number.isFinite),
            daysOfMonth: splitSheetListValue(cell(r, 'Schedule_Days_Of_Month', 8, ['Schedule Days Of Month'])).map(Number).filter(Number.isFinite),
            monthsOfYear: splitSheetListValue(cell(r, 'Schedule_Months_Of_Year', 9, ['Schedule Months Of Year'])).map(Number).filter(Number.isFinite),
            startTime: normalizeTime(scheduleStartTime, '09:00'),
            endTime: normalizeTime(scheduleEndTime, '10:00'),
          } : undefined,
        });
      }
    } else if (name === 'Budget Rules') {
      const parsedBudget = parseSpreadsheetBudget(rows);
      hasBudgetIncome ||= parsedBudget.monthlyIncome !== undefined;
      Object.assign(ensureBudgetConfig(), parsedBudget);
    } else if (name === 'Themes & Settings') {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const first = String(r[0] || '').trim();
        const second = String(r[1] || '').trim();
        if (!first) continue;

        if (first === 'Setting') {
          if (second === 'Monthly Income') {
            hasBudgetIncome = true;
            ensureBudgetConfig().monthlyIncome = Number(r[2]) || 0;
            continue;
          }
          const settings = ensureAppSettings();
          if (second === 'Default Collapsed') settings.defaultCollapsed = truthySheetValue(r[2]);
          if (second === 'Hide Money') settings.hideMoney = truthySheetValue(r[2]);
          if (second === 'Theme') {
            const rawTheme = String(r[2] || '').trim().toLowerCase();
            if (rawTheme === 'light' || rawTheme === 'dark') settings.theme = rawTheme;
          }
          if (second === 'Google Calendar Sync') settings.googleCalendarSyncEnabled = truthySheetValue(r[2]);
          if (second === 'Google Calendar ID') settings.googleCalendarId = String(r[2] || 'primary');
          if (second === 'Security Password') settings.securityPasswordHash = String(r[2] || '');
          if (second === 'Custom Prompt') customPrompt = String(r[2] || '');
          continue;
        }

        if (first === 'Theme') {
          if (second) {
            monthlyThemes[second] = String(r[2] || '');
            const heroImageUrl = cell(r, 'Hero_Image_URL', 3, ['Hero Image URL', 'Hero_Image_Url', 'Hero URL', 'Hero_URL', 'Image_URL', 'Image URL']);
            if (heroImageUrl) monthlyThemeImages[second] = String(heroImageUrl);
          }
          continue;
        }

        // Legacy key/value shape: monthlyIncome | 1000000, defaultCollapsed | true, theme_YYYY-MM | text
        if (first === 'monthlyIncome') {
          hasBudgetIncome = true;
          ensureBudgetConfig().monthlyIncome = Number(r[1]) || 0;
        } else if (first === 'defaultCollapsed') {
          ensureAppSettings().defaultCollapsed = truthySheetValue(r[1]);
        } else if (first === 'hideMoney') {
          ensureAppSettings().hideMoney = truthySheetValue(r[1]);
        } else if (first === 'theme') {
          const rawTheme = String(r[1] || '').trim().toLowerCase();
          if (rawTheme === 'light' || rawTheme === 'dark') ensureAppSettings().theme = rawTheme;
        } else if (first === 'googleCalendarSyncEnabled') {
          ensureAppSettings().googleCalendarSyncEnabled = truthySheetValue(r[1]);
        } else if (first === 'googleCalendarId') {
          ensureAppSettings().googleCalendarId = String(r[1] || 'primary');
        } else if (first === 'securityPasswordHash') {
          ensureAppSettings().securityPasswordHash = String(r[1] || '');
        } else if (first === 'customPrompt') {
          customPrompt = String(r[1] || '');
        } else if (first.startsWith('theme_')) {
          monthlyThemes[first.replace('theme_', '')] = String(r[1] || '');
        } else if (first.startsWith('themeImage_')) {
          monthlyThemeImages[first.replace('themeImage_', '')] = String(r[1] || '');
        }
      }
    } else if (name === 'Chat History') {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const role = String(cell(r, 'Role', 1) || '').trim();
        const text = String(cell(r, 'Text', 2) || '');
        if ((role === 'user' || role === 'model') && text) {
          chatHistory.push({ role, text });
        }
      }
    } else if (name === 'Canonical Rules') {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const id = String(cell(r, 'ID', 0) || '').trim();
        const field = String(cell(r, 'Field', 1) || '').trim() as CanonicalRule['field'];
        const canonicalValue = String(cell(r, 'Canonical_Value', 2, ['Canonical Value']) || '').trim();
        if (!id || !field || !canonicalValue) continue;

        const conditions: CanonicalRule['conditions'] = {};
        const financeType = splitSheetListValue(cell(r, 'Condition_Finance_Types', 8));
        const budgetCategory = splitSheetListValue(cell(r, 'Condition_Budget_Categories', 9));
        const commodity = splitSheetListValue(cell(r, 'Condition_Commodities', 10));
        const paymentMethod = splitSheetListValue(cell(r, 'Condition_Payment_Methods', 11));
        const amountMin = Number(cell(r, 'Condition_Amount_Min', 12));
        const amountMax = Number(cell(r, 'Condition_Amount_Max', 13));
        if (financeType.length) conditions.financeType = financeType as any;
        if (budgetCategory.length) conditions.budgetCategory = budgetCategory;
        if (commodity.length) conditions.commodity = commodity;
        if (paymentMethod.length) conditions.paymentMethod = paymentMethod;
        if (Number.isFinite(amountMin)) conditions.amountMin = amountMin;
        if (Number.isFinite(amountMax)) conditions.amountMax = amountMax;

        canonicalRules.push({
          id,
          field,
          canonicalValue,
          aliases: splitSheetListValue(cell(r, 'Aliases', 3)),
          source: (String(cell(r, 'Source', 4) || 'manual') as CanonicalRule['source']),
          confidenceBoost: Number(cell(r, 'Confidence_Boost', 5)) || undefined,
          approvalCount: Number(cell(r, 'Approval_Count', 6)) || 0,
          rejectionCount: Number(cell(r, 'Rejection_Count', 7)) || 0,
          conditions: Object.keys(conditions).length ? conditions : undefined,
          createdAt: String(cell(r, 'Created_At', 14) || new Date().toISOString()),
          updatedAt: String(cell(r, 'Updated_At', 15) || new Date().toISOString()),
          lastApprovedAt: String(cell(r, 'Last_Approved_At', 16) || '') || undefined,
          lastRejectedAt: String(cell(r, 'Last_Rejected_At', 17) || '') || undefined,
          autoApplyDisabled: truthySheetValue(cell(r, 'Auto_Apply_Disabled', 18)),
          disabled: truthySheetValue(cell(r, 'Disabled', 19)),
          disabledReason: String(cell(r, 'Disabled_Reason', 20) || '') || undefined,
        });
      }
    }
  }

  return {
    wallets,
    skills,
    budgetConfig,
    hasBudgetIncome,
    monthlyThemes,
    monthlyThemeImages,
    appSettings,
    customPrompt,
    chatHistory: chatHistory.length ? chatHistory : undefined,
    canonicalRules: canonicalRules.length ? canonicalRules : undefined,
  };
};
