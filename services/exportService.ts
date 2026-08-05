import type { CellValue, Workbook, Worksheet } from 'exceljs';
import { ItemType } from '../types';
import type { AppSettings, BrainDumpItem, BudgetConfig, Skill, Wallet } from '../types';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const RUPIAH_NUMBER_FORMAT = '"Rp" #,##0;[Red]-"Rp" #,##0';
const DATE_NUMBER_FORMAT = 'dd mmm yyyy';
const DATE_TIME_NUMBER_FORMAT = 'dd mmm yyyy hh:mm';
const PERCENT_NUMBER_FORMAT = '0%';

const HEADER_FILL = 'FF1F4D3B';
const HEADER_FONT = 'FFFFFFFF';
const BORDER_COLOR = 'FFD8E2DC';
const SUCCESS_FILL = 'FFE2F3E9';
const SUCCESS_FONT = 'FF17643A';
const WARNING_FILL = 'FFFFF2CC';
const WARNING_FONT = 'FF8A5A00';
const ERROR_FILL = 'FFFDE2E2';
const ERROR_FONT = 'FF9C2F2F';

type WorkbookCellValue = Exclude<CellValue, undefined>;

interface WorkbookColumn {
  header: string;
  width: number;
  numberFormat?: string;
  validation?: readonly string[];
  horizontal?: 'left' | 'center' | 'right';
}

interface DataSheetDefinition {
  name: string;
  tableName: string;
  columns: WorkbookColumn[];
  rows: WorkbookCellValue[][];
  statusColumn?: number;
  priorityColumn?: number;
  amountColumn?: number;
  amountGuardColumn?: number;
}

export interface ArkaivWorkbookInput {
  items: BrainDumpItem[];
  skills: Skill[];
  wallets: Wallet[];
  budgetConfig: BudgetConfig;
  monthlyThemes: Record<string, string>;
  appSettings: AppSettings;
  monthlyThemeImages?: Record<string, string>;
  now?: Date;
}

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

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const toOptionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const toQuantity = (value: string | undefined): string | number => {
  const trimmed = value?.trim() || '';
  if (!trimmed) return '';
  if (/^-?\d+(?:[.,]\d+)?$/.test(trimmed)) {
    const parsed = Number(trimmed.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return trimmed;
};

const toDateCell = (value?: string): Date | string | null => {
  if (!value) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value);

  return Number.isFinite(parsed.getTime()) ? parsed : value;
};

const toProgress = (value: unknown) => {
  const numeric = toFiniteNumber(value, 0);
  return Math.max(0, Math.min(1, numeric > 1 ? numeric / 100 : numeric));
};

const joinTags = (item: BrainDumpItem) => item.meta.tags?.join(', ') || '';

const resolveWalletName = (value: string | undefined, wallets: Wallet[]) => {
  const normalizedValue = value?.trim();
  if (!normalizedValue) return '';
  const lookupValue = normalizedValue.toLocaleLowerCase();
  return wallets.find(wallet => (
    wallet.id.toLocaleLowerCase() === lookupValue
    || wallet.name.toLocaleLowerCase() === lookupValue
  ))?.name || normalizedValue;
};

const resolveBudgetCategory = (value: string | undefined, budgetConfig: BudgetConfig) => {
  const normalizedValue = value?.trim();
  if (!normalizedValue) return '';
  const lookupValue = normalizedValue.toLocaleLowerCase();
  return budgetConfig.rules.find(rule => (
    rule.id.toLocaleLowerCase() === lookupValue
    || rule.name.toLocaleLowerCase() === lookupValue
  ))?.name || normalizedValue;
};

const newestFirst = (left: BrainDumpItem, right: BrainDumpItem) => {
  const leftTime = new Date(left.meta.date || left.meta.dateTime || left.completed_at || left.created_at).getTime();
  const rightTime = new Date(right.meta.date || right.meta.dateTime || right.completed_at || right.created_at).getTime();
  return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
};

const isGoal = (item: BrainDumpItem) => item.type === ItemType.SHOPPING
  && (item.meta.shoppingCategory === 'saving' || item.meta.shoppingCategory === 'investment');

const isTransaction = (item: BrainDumpItem) => item.type === ItemType.FINANCE
  || (item.type === ItemType.SHOPPING && item.status === 'done' && !isGoal(item));

const getTransactionType = (item: BrainDumpItem) => (
  item.type === ItemType.SHOPPING ? 'expense' : (item.meta.financeType || 'expense')
);

const getTransactionDate = (item: BrainDumpItem) => (
  item.meta.date || item.meta.dateTime || item.completed_at || item.created_at
);

const getTaskDueDate = (item: BrainDumpItem) => (
  item.meta.date || item.meta.dateTime || item.meta.start || undefined
);

const getShoppingDueDate = (item: BrainDumpItem) => (
  item.meta.targetDay || item.meta.date || item.meta.dateTime || item.meta.start || undefined
);

const getCurrentTheme = (monthlyThemes: Record<string, string>, now: Date) => {
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return monthlyThemes[monthKey] || '';
};

const columnLetter = (worksheet: Worksheet, oneBasedColumnIndex: number) => (
  worksheet.getColumn(oneBasedColumnIndex).letter
);

const applyListValidation = (
  worksheet: Worksheet,
  oneBasedColumnIndex: number,
  values: readonly string[],
  throughRow: number,
) => {
  const formula = `"${values.join(',')}"`;
  for (let rowNumber = 2; rowNumber <= throughRow; rowNumber += 1) {
    worksheet.getCell(rowNumber, oneBasedColumnIndex).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: 'Invalid value',
      error: 'Choose a value from the dropdown list.',
    };
  }
};

const addStatusFormatting = (worksheet: Worksheet, oneBasedColumnIndex: number, throughRow: number) => {
  const letter = columnLetter(worksheet, oneBasedColumnIndex);
  worksheet.addConditionalFormatting({
    ref: `${letter}2:${letter}${throughRow}`,
    rules: [
      {
        type: 'expression',
        priority: 1,
        formulae: [`LOWER($${letter}2)="done"`],
        style: {
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: SUCCESS_FILL } },
          font: { color: { argb: SUCCESS_FONT }, bold: true },
        },
      },
      {
        type: 'expression',
        priority: 2,
        formulae: [`LOWER($${letter}2)="pending"`],
        style: {
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: WARNING_FILL } },
          font: { color: { argb: WARNING_FONT } },
        },
      },
    ],
  });
};

const addPriorityFormatting = (worksheet: Worksheet, oneBasedColumnIndex: number, throughRow: number) => {
  const letter = columnLetter(worksheet, oneBasedColumnIndex);
  worksheet.addConditionalFormatting({
    ref: `${letter}2:${letter}${throughRow}`,
    rules: [{
      type: 'expression',
      priority: 3,
      formulae: [`LOWER($${letter}2)="high"`],
      style: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: ERROR_FILL } },
        font: { color: { argb: ERROR_FONT }, bold: true },
      },
    }],
  });
};

const addInvalidAmountFormatting = (
  worksheet: Worksheet,
  amountColumnIndex: number,
  guardColumnIndex: number,
  throughRow: number,
) => {
  const amountLetter = columnLetter(worksheet, amountColumnIndex);
  const guardLetter = columnLetter(worksheet, guardColumnIndex);
  worksheet.addConditionalFormatting({
    ref: `${amountLetter}2:${amountLetter}${throughRow}`,
    rules: [{
      type: 'expression',
      priority: 4,
      formulae: [`AND($${guardLetter}2<>"",$${amountLetter}2<=0)`],
      style: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: ERROR_FILL } },
        font: { color: { argb: ERROR_FONT }, bold: true },
      },
    }],
  });
};

const addDataSheet = (workbook: Workbook, definition: DataSheetDefinition) => {
  const worksheet = workbook.addWorksheet(definition.name, {
    properties: { defaultRowHeight: 20 },
    views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2', showGridLines: false }],
  });

  worksheet.columns = definition.columns.map(column => ({
    header: column.header,
    width: Math.max(8, Math.min(40, column.width)),
  }));

  worksheet.addTable({
    name: definition.tableName,
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium4',
      showFirstColumn: false,
      showLastColumn: false,
      showRowStripes: true,
      showColumnStripes: false,
    },
    columns: definition.columns.map(column => ({ name: column.header })),
    rows: definition.rows,
  });

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: definition.columns.length },
  };
  worksheet.getRow(1).height = 26;
  worksheet.getRow(1).font = { bold: true, color: { argb: HEADER_FONT } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'left' };

  const lastDataRow = definition.rows.length + 1;

  definition.columns.forEach((column, columnIndex) => {
    const excelColumn = worksheet.getColumn(columnIndex + 1);
    if (column.numberFormat) excelColumn.numFmt = column.numberFormat;
    for (let rowNumber = 2; rowNumber <= lastDataRow; rowNumber += 1) {
      const cell = worksheet.getCell(rowNumber, columnIndex + 1);
      cell.alignment = {
        vertical: 'top',
        horizontal: column.horizontal || 'left',
        wrapText: true,
      };
      cell.border = {
        bottom: { style: 'hair', color: { argb: BORDER_COLOR } },
      };
    }
    if (column.validation) {
      applyListValidation(worksheet, columnIndex + 1, column.validation, lastDataRow);
    }
  });

  if (definition.rows.length && definition.statusColumn) {
    addStatusFormatting(worksheet, definition.statusColumn, lastDataRow);
  }
  if (definition.rows.length && definition.priorityColumn) {
    addPriorityFormatting(worksheet, definition.priorityColumn, lastDataRow);
  }
  if (definition.rows.length && definition.amountColumn && definition.amountGuardColumn) {
    addInvalidAmountFormatting(
      worksheet,
      definition.amountColumn,
      definition.amountGuardColumn,
      lastDataRow,
    );
  }

  worksheet.pageSetup = {
    orientation: definition.columns.length > 7 ? 'landscape' : 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };

  return worksheet;
};

const buildTransactionSheet = (
  workbook: Workbook,
  items: BrainDumpItem[],
  wallets: Wallet[],
  budgetConfig: BudgetConfig,
) => {
  const rows = items
    .filter(isTransaction)
    .sort(newestFirst)
    .map(item => {
      const isShoppingItem = item.type === ItemType.SHOPPING;
      return [
        toDateCell(getTransactionDate(item)),
        getTransactionType(item),
        resolveBudgetCategory(item.meta.budgetCategory, budgetConfig),
        item.content,
        toFiniteNumber(item.meta.amount),
        resolveWalletName(item.meta.paymentMethod || (isShoppingItem ? item.meta.dedicatedWalletId : undefined), wallets),
        resolveWalletName(item.meta.toWallet, wallets),
        item.meta.merchant || '',
        joinTags(item),
        item.status === 'done',
      ];
    });

  addDataSheet(workbook, {
    name: 'Transactions',
    tableName: 'TransactionsTable',
    columns: [
      { header: 'Date', width: 19, numberFormat: DATE_TIME_NUMBER_FORMAT },
      { header: 'Type', width: 18, validation: ['expense', 'income', 'transfer', 'saving', 'saving_withdrawal', 'loan_out', 'loan_in'] },
      { header: 'Category', width: 20 },
      { header: 'Description', width: 36 },
      { header: 'Amount', width: 17, numberFormat: RUPIAH_NUMBER_FORMAT, horizontal: 'right' },
      { header: 'Wallet', width: 18 },
      { header: 'To Wallet', width: 18 },
      { header: 'Merchant', width: 20 },
      { header: 'Tags', width: 24 },
      { header: 'Completed', width: 12, horizontal: 'center' },
    ],
    rows,
    amountColumn: 5,
    amountGuardColumn: 4,
  });
};

const buildTaskSheet = (workbook: Workbook, items: BrainDumpItem[]) => {
  const rows = items
    .filter(item => item.type === ItemType.TODO || item.type === ItemType.SKILLS)
    .sort(newestFirst)
    .map(item => [
      item.status,
      item.meta.priority || 'normal',
      item.content,
      toDateCell(getTaskDueDate(item)),
      toProgress(item.meta.progress ?? (item.status === 'done' ? 100 : 0)),
      joinTags(item),
      toDateCell(item.created_at),
      toDateCell(item.completed_at),
      Boolean(item.meta.isRoutine),
      item.meta.deepWorkNextAction || '',
    ]);

  addDataSheet(workbook, {
    name: 'Tasks',
    tableName: 'TasksTable',
    columns: [
      { header: 'Status', width: 12, validation: ['pending', 'done'] },
      { header: 'Priority', width: 12, validation: ['low', 'normal', 'high'] },
      { header: 'Task', width: 38 },
      { header: 'Due Date', width: 18, numberFormat: DATE_TIME_NUMBER_FORMAT },
      { header: 'Progress', width: 12, numberFormat: PERCENT_NUMBER_FORMAT, horizontal: 'right' },
      { header: 'Tags', width: 22 },
      { header: 'Created', width: 19, numberFormat: DATE_TIME_NUMBER_FORMAT },
      { header: 'Completed At', width: 19, numberFormat: DATE_TIME_NUMBER_FORMAT },
      { header: 'Routine', width: 11, horizontal: 'center' },
      { header: 'Next Action', width: 36 },
    ],
    rows,
    statusColumn: 1,
    priorityColumn: 2,
  });
};

const buildShoppingSheet = (
  workbook: Workbook,
  items: BrainDumpItem[],
  wallets: Wallet[],
  budgetConfig: BudgetConfig,
) => {
  const rows = items
    .filter(item => item.type === ItemType.SHOPPING && !isGoal(item))
    .sort(newestFirst)
    .map(item => [
      item.status,
      item.content,
      item.meta.shoppingCategory || '',
      toQuantity(item.meta.quantity),
      toFiniteNumber(item.meta.amount),
      resolveBudgetCategory(item.meta.budgetCategory, budgetConfig),
      resolveWalletName(item.meta.paymentMethod || item.meta.dedicatedWalletId, wallets),
      toDateCell(getShoppingDueDate(item)),
      toDateCell(item.completed_at),
      Boolean(item.meta.isRoutine),
    ]);

  addDataSheet(workbook, {
    name: 'Shopping',
    tableName: 'ShoppingTable',
    columns: [
      { header: 'Status', width: 12, validation: ['pending', 'done'] },
      { header: 'Item', width: 36 },
      { header: 'Category', width: 16, validation: ['urgent', 'not_urgent', 'routine'] },
      { header: 'Quantity', width: 12, horizontal: 'right' },
      { header: 'Amount', width: 17, numberFormat: RUPIAH_NUMBER_FORMAT, horizontal: 'right' },
      { header: 'Budget Category', width: 20 },
      { header: 'Wallet', width: 18 },
      { header: 'Due Date', width: 18, numberFormat: DATE_NUMBER_FORMAT },
      { header: 'Completed At', width: 19, numberFormat: DATE_TIME_NUMBER_FORMAT },
      { header: 'Routine', width: 11, horizontal: 'center' },
    ],
    rows,
    statusColumn: 1,
    amountColumn: 5,
    amountGuardColumn: 2,
  });
};

const buildCalendarSheet = (workbook: Workbook, items: BrainDumpItem[]) => {
  const calendarItems = items.filter(item => item.type === ItemType.EVENT).sort(newestFirst);
  if (!calendarItems.length) return;

  const rows = calendarItems.map(item => [
    toDateCell(item.meta.date || item.meta.dateTime || item.meta.start),
    toDateCell(item.meta.start),
    toDateCell(item.meta.end),
    item.content,
    item.meta.priority || 'normal',
    item.status,
    joinTags(item),
    Boolean(item.meta.hideFromCalendar),
  ]);

  addDataSheet(workbook, {
    name: 'Calendar',
    tableName: 'CalendarTable',
    columns: [
      { header: 'Date', width: 19, numberFormat: DATE_TIME_NUMBER_FORMAT },
      { header: 'Start', width: 19, numberFormat: DATE_TIME_NUMBER_FORMAT },
      { header: 'End', width: 19, numberFormat: DATE_TIME_NUMBER_FORMAT },
      { header: 'Event', width: 38 },
      { header: 'Priority', width: 12, validation: ['low', 'normal', 'high'] },
      { header: 'Status', width: 12, validation: ['pending', 'done'] },
      { header: 'Tags', width: 24 },
      { header: 'Hidden', width: 11, horizontal: 'center' },
    ],
    rows,
    statusColumn: 6,
    priorityColumn: 5,
  });
};

const buildNotesSheet = (workbook: Workbook, items: BrainDumpItem[]) => {
  const noteItems = items
    .filter(item => item.type === ItemType.NOTE || item.type === ItemType.JOURNAL)
    .sort(newestFirst);
  if (!noteItems.length) return;

  const rows = noteItems.map(item => [
    toDateCell(item.created_at),
    item.type === ItemType.JOURNAL ? 'Journal' : 'Note',
    item.meta.title || '',
    item.content,
    joinTags(item),
    item.status === 'done',
  ]);

  addDataSheet(workbook, {
    name: 'Notes',
    tableName: 'NotesTable',
    columns: [
      { header: 'Date', width: 19, numberFormat: DATE_TIME_NUMBER_FORMAT },
      { header: 'Type', width: 12, validation: ['Note', 'Journal'] },
      { header: 'Title', width: 28 },
      { header: 'Content', width: 40 },
      { header: 'Tags', width: 24 },
      { header: 'Completed', width: 12, horizontal: 'center' },
    ],
    rows,
  });
};

const buildSkillsSheet = (workbook: Workbook, items: BrainDumpItem[], skills: Skill[]) => {
  const skillLogs = items.filter(item => item.type === ItemType.SKILL_LOG);
  if (!skills.length && !skillLogs.length) return;

  const configuredRows = skills.map(skill => {
    const normalizedName = skill.name.toLocaleLowerCase();
    const matchingLogs = skillLogs.filter(log => (
      log.meta.skillId === skill.id
      || log.meta.skillName?.toLocaleLowerCase() === normalizedName
    ));
    const latestLog = [...matchingLogs].sort(newestFirst)[0];
    const scheduleParts = [
      skill.schedule?.interval,
      skill.schedule?.startTime && skill.schedule?.endTime
        ? `${skill.schedule.startTime}-${skill.schedule.endTime}`
        : skill.schedule?.startTime,
    ].filter(Boolean);

    return [
      skill.name,
      skill.description || '',
      toFiniteNumber(skill.weeklyTargetMinutes),
      matchingLogs.reduce((total, log) => total + toFiniteNumber(log.meta.durationMinutes), 0),
      matchingLogs.length,
      toDateCell(latestLog?.meta.actualEnd || latestLog?.completed_at || latestLog?.meta.date || latestLog?.created_at),
      Boolean(skill.schedule?.enabled),
      scheduleParts.join(' '),
      toDateCell(skill.created_at),
    ];
  });

  const configuredSkillIds = new Set(skills.map(skill => skill.id));
  const configuredSkillNames = new Set(skills.map(skill => skill.name.toLocaleLowerCase()));
  const unconfiguredLogs = skillLogs.filter(log => (
    (!log.meta.skillId || !configuredSkillIds.has(log.meta.skillId))
    && (!log.meta.skillName || !configuredSkillNames.has(log.meta.skillName.toLocaleLowerCase()))
  ));
  const unconfiguredGroups = new Map<string, BrainDumpItem[]>();
  unconfiguredLogs.forEach(log => {
    const name = log.meta.skillName?.trim() || 'Unassigned skill';
    const key = name.toLocaleLowerCase();
    unconfiguredGroups.set(key, [...(unconfiguredGroups.get(key) || []), log]);
  });

  const unconfiguredRows = Array.from(unconfiguredGroups.values()).map(logs => {
    const newestLog = [...logs].sort(newestFirst)[0];
    return [
      newestLog.meta.skillName?.trim() || 'Unassigned skill',
      '',
      0,
      logs.reduce((total, log) => total + toFiniteNumber(log.meta.durationMinutes), 0),
      logs.length,
      toDateCell(newestLog.meta.actualEnd || newestLog.completed_at || newestLog.meta.date || newestLog.created_at),
      false,
      '',
      null,
    ];
  });

  addDataSheet(workbook, {
    name: 'Skills',
    tableName: 'SkillsTable',
    columns: [
      { header: 'Skill', width: 24 },
      { header: 'Description', width: 38 },
      { header: 'Weekly Target (min)', width: 20, numberFormat: '#,##0', horizontal: 'right' },
      { header: 'Logged Minutes', width: 18, numberFormat: '#,##0', horizontal: 'right' },
      { header: 'Sessions', width: 12, numberFormat: '#,##0', horizontal: 'right' },
      { header: 'Last Session', width: 19, numberFormat: DATE_TIME_NUMBER_FORMAT },
      { header: 'Scheduled', width: 12, horizontal: 'center' },
      { header: 'Schedule', width: 24 },
      { header: 'Created', width: 19, numberFormat: DATE_TIME_NUMBER_FORMAT },
    ],
    rows: [...configuredRows, ...unconfiguredRows],
  });
};

const buildGoalsSheet = (workbook: Workbook, items: BrainDumpItem[], wallets: Wallet[]) => {
  const goals = items.filter(isGoal).sort(newestFirst);
  if (!goals.length) return;

  const rows = goals.map(item => {
    const targetAmount = toFiniteNumber(item.meta.amount);
    const currentValue = item.meta.shoppingCategory === 'investment'
      ? toOptionalNumber(item.meta.investmentCurrentPrice) !== null
        ? toFiniteNumber(item.meta.investmentUnits) * toFiniteNumber(item.meta.investmentCurrentPrice)
        : toFiniteNumber(item.meta.savedAmount)
      : toFiniteNumber(item.meta.savedAmount);
    return [
      item.meta.shoppingCategory || 'saving',
      item.status,
      item.content,
      targetAmount,
      currentValue,
      targetAmount > 0 ? Math.max(0, currentValue / targetAmount) : 0,
      resolveWalletName(item.meta.dedicatedWalletId, wallets),
      toDateCell(getShoppingDueDate(item)),
      toDateCell(item.created_at),
      item.status === 'done',
    ];
  });

  addDataSheet(workbook, {
    name: 'Goals',
    tableName: 'GoalsTable',
    columns: [
      { header: 'Kind', width: 14, validation: ['saving', 'investment'] },
      { header: 'Status', width: 12, validation: ['pending', 'done'] },
      { header: 'Goal', width: 34 },
      { header: 'Target Amount', width: 18, numberFormat: RUPIAH_NUMBER_FORMAT, horizontal: 'right' },
      { header: 'Saved / Current Value', width: 22, numberFormat: RUPIAH_NUMBER_FORMAT, horizontal: 'right' },
      { header: 'Progress', width: 12, numberFormat: PERCENT_NUMBER_FORMAT, horizontal: 'right' },
      { header: 'Wallet', width: 18 },
      { header: 'Due Date', width: 18, numberFormat: DATE_NUMBER_FORMAT },
      { header: 'Created', width: 19, numberFormat: DATE_TIME_NUMBER_FORMAT },
      { header: 'Completed', width: 12, horizontal: 'center' },
    ],
    rows,
    statusColumn: 2,
  });
};

const buildOverviewSheet = (
  workbook: Workbook,
  input: ArkaivWorkbookInput,
  now: Date,
) => {
  const transactions = input.items.filter(isTransaction);
  const transactionTotal = (types: readonly string[]) => transactions
    .filter(item => types.includes(getTransactionType(item)))
    .reduce((total, item) => total + toFiniteNumber(item.meta.amount), 0);
  const income = transactionTotal(['income', 'loan_in', 'loan_repayment_in', 'saving_withdrawal']);
  const expenses = transactionTotal(['expense', 'loan_out', 'loan_repayment_out', 'saving']);
  const notes = input.items.filter(item => item.type === ItemType.NOTE || item.type === ItemType.JOURNAL);
  const activeGoals = input.items.filter(item => isGoal(item) && item.status !== 'done');

  const worksheet = workbook.addWorksheet('Overview', {
    properties: { defaultRowHeight: 21 },
    views: [{ state: 'frozen', ySplit: 4, activeCell: 'A5', showGridLines: false }],
  });
  worksheet.mergeCells('A1:D1');
  worksheet.getCell('A1').value = 'Arkaiv Overview';
  worksheet.getCell('A1').font = { bold: true, size: 20, color: { argb: HEADER_FONT } };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 34;

  worksheet.mergeCells('A2:D2');
  worksheet.getCell('A2').value = 'A concise, editable export of user-facing records. Technical sync data is intentionally excluded.';
  worksheet.getCell('A2').font = { italic: true, color: { argb: 'FF61706A' } };
  worksheet.getCell('A2').alignment = { wrapText: true, vertical: 'middle' };
  worksheet.getRow(2).height = 30;

  const metrics: Array<[string, WorkbookCellValue]> = [
    ['Generated At', now],
    ['All Records', input.items.length],
    ['Transactions', transactions.length],
    ['Income', income],
    ['Expenses', expenses],
    ['Net Cash Flow', income - expenses],
    ['Open Tasks', input.items.filter(item => (item.type === ItemType.TODO || item.type === ItemType.SKILLS) && item.status !== 'done').length],
    ['Open Shopping', input.items.filter(item => item.type === ItemType.SHOPPING && !isGoal(item) && item.status !== 'done').length],
    ['Notes & Journals', notes.length],
    ['Skills', input.skills.length],
    ['Active Goals', activeGoals.length],
    ['Wallets', input.wallets.length],
    ['Opening Wallet Balance', input.wallets.reduce((total, wallet) => total + toFiniteNumber(wallet.initialBalance), 0)],
    ['Monthly Income Plan', toFiniteNumber(input.budgetConfig.monthlyIncome)],
    ['Current Theme', getCurrentTheme(input.monthlyThemes, now) || '(not set)'],
    ['App Theme', input.appSettings.theme || 'dark'],
  ];

  worksheet.addTable({
    name: 'OverviewTable',
    ref: 'A4',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium4', showRowStripes: true },
    columns: [{ name: 'Metric' }, { name: 'Value' }],
    rows: metrics,
  });
  worksheet.autoFilter = { from: 'A4', to: 'B4' };
  worksheet.getRow(4).font = { bold: true, color: { argb: HEADER_FONT } };
  worksheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  worksheet.getRow(4).height = 26;
  worksheet.getColumn(1).width = 28;
  worksheet.getColumn(2).width = 28;

  metrics.forEach(([label], index) => {
    const rowNumber = index + 5;
    worksheet.getCell(rowNumber, 1).font = { bold: true, color: { argb: 'FF2B3D35' } };
    worksheet.getCell(rowNumber, 1).alignment = { vertical: 'middle', wrapText: true };
    worksheet.getCell(rowNumber, 2).alignment = { vertical: 'middle', wrapText: true };
    if (label === 'Generated At') worksheet.getCell(rowNumber, 2).numFmt = DATE_TIME_NUMBER_FORMAT;
    if (['Income', 'Expenses', 'Net Cash Flow', 'Opening Wallet Balance', 'Monthly Income Plan'].includes(label)) {
      worksheet.getCell(rowNumber, 2).numFmt = RUPIAH_NUMBER_FORMAT;
    }
  });

  worksheet.pageSetup = {
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
};

const loadExcelJs = async () => {
  const excelJsModule = await import('exceljs');
  const moduleWithDefault = excelJsModule as unknown as { default?: typeof excelJsModule };
  return moduleWithDefault.default || excelJsModule;
};

/**
 * Builds an in-memory workbook without accessing DOM or browser globals.
 * ExcelJS is loaded lazily so opening the app does not pull the XLSX engine into the startup bundle.
 */
export const buildArkaivWorkbook = async (input: ArkaivWorkbookInput): Promise<Workbook> => {
  const excelJs = await loadExcelJs();
  const workbook = new excelJs.Workbook();
  const now = input.now ? new Date(input.now) : new Date();

  workbook.creator = 'Arkaiv';
  workbook.company = 'Arkaiv';
  workbook.created = now;
  workbook.modified = now;
  workbook.lastPrinted = now;
  workbook.subject = 'User-facing Arkaiv data export';
  workbook.description = 'Readable Arkaiv records without sync snapshots, raw payloads, history, logs, or backups.';
  workbook.calcProperties.fullCalcOnLoad = true;

  buildOverviewSheet(workbook, input, now);
  buildTransactionSheet(workbook, input.items, input.wallets, input.budgetConfig);
  buildTaskSheet(workbook, input.items);
  buildShoppingSheet(workbook, input.items, input.wallets, input.budgetConfig);
  buildCalendarSheet(workbook, input.items);
  buildNotesSheet(workbook, input.items);
  buildSkillsSheet(workbook, input.items, input.skills);
  buildGoalsSheet(workbook, input.items, input.wallets);

  return workbook;
};

/** Serializes the pure in-memory workbook into genuine XLSX/ZIP bytes. */
export const buildArkaivWorkbookBuffer = async (input: ArkaivWorkbookInput): Promise<ArrayBuffer> => {
  const workbook = await buildArkaivWorkbook(input);
  const workbookBytes = await workbook.xlsx.writeBuffer();
  const source = new Uint8Array(workbookBytes);
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy.buffer;
};

export const exportToExcel = async (
  items: BrainDumpItem[],
  skills: Skill[],
  wallets: Wallet[],
  budgetConfig: BudgetConfig,
  monthlyThemes: Record<string, string>,
  appSettings: AppSettings,
  monthlyThemeImages: Record<string, string> = {},
) => {
  const now = new Date();
  const buffer = await buildArkaivWorkbookBuffer({
    items,
    skills,
    wallets,
    budgetConfig,
    monthlyThemes,
    appSettings,
    monthlyThemeImages,
    now,
  });
  const dateStr = now.toISOString().slice(0, 10);
  downloadBlob(new Blob([buffer], { type: XLSX_MIME_TYPE }), `Arkaiv_Export_${dateStr}.xlsx`);
};
