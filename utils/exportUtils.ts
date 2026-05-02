import { BrainDumpItem, Skill, Wallet, BudgetConfig, AppSettings, ItemType } from '../types';
import { getCanonicalOrRawItemValue, getCanonicalMetaValue } from './canonicalization/accessors';
import { ACHIEVED_GOAL_FINANCE_TYPE } from './financeTypeUtils';

export interface SheetData {
  name: string;
  data: (string | number | boolean | null)[][];
}

// Helper to format date
const fmtDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString() + ' ' + new Date(dateStr).toLocaleTimeString();
};

// Helper to resolve wallet name
const getWalletName = (id: string | undefined, wallets: Wallet[]) => {
    if (!id) return '';
    const w = wallets.find(w => w.id === id);
    return w ? w.name : id;
};

// Helper to resolve budget category
const getCategoryName = (id: string | undefined, budgetConfig: BudgetConfig) => {
    if (!id) return '';
    const r = budgetConfig.rules.find(r => r.id === id);
    return r ? r.name : id;
};

export const generateExportData = (
  items: BrainDumpItem[],
  skills: Skill[],
  wallets: Wallet[],
  budgetConfig: BudgetConfig,
  monthlyThemes: Record<string, string>,
  appSettings: AppSettings
): SheetData[] => {
  const sheets: SheetData[] = [];

  // --- Sheet 1: Transactions (Money Tab) ---
  const transactions = items
    .filter(i => i.type === ItemType.FINANCE || (i.type === ItemType.SHOPPING && i.status === 'done' && i.meta.shoppingCategory !== 'saving'))
    .map(item => {
      const isShopping = item.type === ItemType.SHOPPING;
      const date = isShopping ? (item.completed_at || item.created_at) : (item.meta.date || item.created_at);
      
      return {
        Date: fmtDate(date),
        Type: isShopping ? 'expense' : (item.meta.financeType === ACHIEVED_GOAL_FINANCE_TYPE ? 'Achieved Goals' : (item.meta.financeType || 'expense')),
        Category: getCategoryName(item.meta.budgetCategory, budgetConfig),
        Description: item.content,
        Amount: item.meta.amount || 0,
        Wallet: getWalletName(getCanonicalOrRawItemValue(item, 'paymentMethod') || item.meta.paymentMethod, wallets),
        To_Wallet: getWalletName(item.meta.toWallet, wallets),
        Tags: item.meta.tags?.join(', ') || '',
        Canonical_Merchant: getCanonicalMetaValue(item.meta, 'merchant'),
        Canonical_Subcommodity: getCanonicalMetaValue(item.meta, 'subcommodity'),
        ID: item.id
      };
    });

  if (transactions.length > 0) {
    sheets.push({
      name: "Transactions",
      data: [
        ["Date", "Type", "Category", "Description", "Amount", "Wallet", "To_Wallet", "Tags", "Canonical_Merchant", "Canonical_Subcommodity", "ID"],
        ...transactions.map(t => [t.Date, t.Type, t.Category, t.Description, t.Amount, t.Wallet, t.To_Wallet, t.Tags, t.Canonical_Merchant, t.Canonical_Subcommodity, t.ID])
      ]
    });
  }

  // --- Sheet 2: Todos ---
  const todos = items.filter(i => i.type === ItemType.TODO).map(item => ({
      Type: item.type,
      Status: item.status,
      Priority: item.meta.priority || 'normal',
      Content: item.content,
      Due_Date: fmtDate(item.meta.date || item.meta.dateTime),
      Start_Date: fmtDate(item.meta.start),
      End_Date: fmtDate(item.meta.end),
      Tags: item.meta.tags?.join(', ') || '',
      Created_At: fmtDate(item.created_at),
      Completed_At: fmtDate(item.completed_at),
      Progress: item.meta.progress ? `${item.meta.progress}%` : '',
      Progress_Notes: item.meta.progressNotes || '',
      ID: item.id
  }));
  if (todos.length > 0) {
    sheets.push({
      name: "Todos",
      data: [
        ["Type", "Status", "Priority", "Content", "Due_Date", "Start_Date", "End_Date", "Tags", "Created_At", "Completed_At", "Progress", "Progress_Notes", "ID"],
        ...todos.map(t => [t.Type, t.Status, t.Priority, t.Content, t.Due_Date, t.Start_Date, t.End_Date, t.Tags, t.Created_At, t.Completed_At, t.Progress, t.Progress_Notes, t.ID])
      ]
    });
  }

  // --- Sheet 3: Shopping ---
  const shopping = items.filter(i => i.type === ItemType.SHOPPING).map(item => ({
      Status: item.status,
      Item: item.content,
      Amount: item.meta.amount || 0,
      Category: item.meta.shoppingCategory || '',
      Quantity: item.meta.quantity || '',
      Due_Date: fmtDate(item.meta.date || item.meta.dateTime),
      Tags: item.meta.tags?.join(', ') || '',
      Completed_At: fmtDate(item.completed_at),
      ID: item.id
  }));
  if (shopping.length > 0) {
    sheets.push({
      name: "Shopping",
      data: [
        ["Status", "Item", "Amount", "Category", "Quantity", "Due_Date", "Tags", "Completed_At", "ID"],
        ...shopping.map(s => [s.Status, s.Item, s.Amount, s.Category, s.Quantity, s.Due_Date, s.Tags, s.Completed_At, s.ID])
      ]
    });
  }

  // --- Sheet 4: Events ---
  const events = items.filter(i => i.type === ItemType.EVENT).map(item => ({
      Type: item.type,
      Date: fmtDate(item.meta.date),
      Start_Date: fmtDate(item.meta.start),
      End_Date: fmtDate(item.meta.end),
      Priority: item.meta.priority || 'normal',
      Event: item.content,
      Tags: item.meta.tags?.join(', ') || '',
      ID: item.id
  }));
  if (events.length > 0) {
    sheets.push({
      name: "Events",
      data: [
        ["Type", "Date", "Start_Date", "End_Date", "Priority", "Event", "Tags", "ID"],
        ...events.map(e => [e.Type, e.Date, e.Start_Date, e.End_Date, e.Priority, e.Event, e.Tags, e.ID])
      ]
    });
  }

  // --- Sheet 5: Notes & Journals ---
  const notes = items.filter(i => i.type === ItemType.NOTE || i.type === ItemType.JOURNAL).map(item => ({
      Date: fmtDate(item.created_at),
      Type: item.type,
      Content: item.content,
      Tags: item.meta.tags?.join(', ') || '',
      ID: item.id
  }));
  if (notes.length > 0) {
    sheets.push({
      name: "Notes & Journals",
      data: [
        ["Date", "Type", "Content", "Tags", "ID"],
        ...notes.map(n => [n.Date, n.Type, n.Content, n.Tags, n.ID])
      ]
    });
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
    Canonical_Payment_Method: getCanonicalMetaValue(item.meta, 'paymentMethod'),
    Merchant: item.meta.merchant || '',
    Canonical_Merchant: getCanonicalMetaValue(item.meta, 'merchant'),
    Commodity: item.meta.commodity || '',
    Canonical_Commodity: getCanonicalMetaValue(item.meta, 'commodity'),
    Subcommodity: item.meta.subcommodity || '',
    Canonical_Subcommodity: getCanonicalMetaValue(item.meta, 'subcommodity'),
    To_Wallet: item.meta.toWallet || '',
    Finance_Type: item.meta.financeType || '',
    Budget_Category: item.meta.budgetCategory || '',
    Skill_Name: item.meta.skillName || '',
    Skill_ID: item.meta.skillId || '',
    Duration_Minutes: item.meta.durationMinutes || 0,
    Shopping_Category: item.meta.shoppingCategory || '',
    Recurrence_Days: item.meta.recurrenceDays || '',
    Priority: item.meta.priority || 'normal',
  }));
  
  sheets.push({
    name: "All Items (Raw)",
    data: [
      ["ID", "Type", "Content", "Status", "Created_At", "Completed_At", "Date", "Amount", "Tags", "Payment_Method", "Canonical_Payment_Method", "Merchant", "Canonical_Merchant", "Commodity", "Canonical_Commodity", "Subcommodity", "Canonical_Subcommodity", "To_Wallet", "Finance_Type", "Budget_Category", "Skill_Name", "Skill_ID", "Duration_Minutes", "Shopping_Category", "Recurrence_Days", "Priority"],
      ...itemsData.map(i => [i.ID, i.Type, i.Content, i.Status, i.Created_At, i.Completed_At, i.Date, i.Amount, i.Tags, i.Payment_Method, i.Canonical_Payment_Method, i.Merchant, i.Canonical_Merchant, i.Commodity, i.Canonical_Commodity, i.Subcommodity, i.Canonical_Subcommodity, i.To_Wallet, i.Finance_Type, i.Budget_Category, i.Skill_Name, i.Skill_ID, i.Duration_Minutes, i.Shopping_Category, i.Recurrence_Days, i.Priority])
    ]
  });

  // --- Sheet 8: Wallets ---
  const walletsData = wallets.map(w => ({
    ID: w.id,
    Name: w.name,
    Type: w.type,
    Initial_Balance: w.initialBalance,
    Color: w.color
  }));
  sheets.push({
    name: "Wallets Config",
    data: [
      ["ID", "Name", "Type", "Initial_Balance", "Color"],
      ...walletsData.map(w => [w.ID, w.Name, w.Type, w.Initial_Balance, w.Color])
    ]
  });

  // --- Sheet 9: Skills ---
  const skillsData = skills.map(s => ({
    ID: s.id,
    Name: s.name,
    Weekly_Target_Minutes: s.weeklyTargetMinutes || 0,
    Created_At: s.created_at,
    Color: s.color
  }));
  sheets.push({
    name: "Skills Config",
    data: [
      ["ID", "Name", "Weekly_Target_Minutes", "Created_At", "Color"],
      ...skillsData.map(s => [s.ID, s.Name, s.Weekly_Target_Minutes, s.Created_At, s.Color])
    ]
  });

  // --- Sheet 10: Budget Config ---
  const budgetData = [
    { Property: 'Monthly Income', Value: budgetConfig.monthlyIncome, Color: '' },
    ...budgetConfig.rules.map(r => ({
      Property: `Rule: ${r.name}`,
      Value: `${r.percentage}% (ID: ${r.id})`,
      Color: r.color || 'bg-gray-500'
    }))
  ];
  sheets.push({
    name: "Budget Rules",
    data: [
      ["Property", "Value", "Color"],
      ...budgetData.map(b => [b.Property, b.Value, b.Color])
    ]
  });

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

  sheets.push({
    name: "Themes & Settings",
    data: [
      ["Type", "Key", "Value"],
      ...[...themesData, ...settingsData].map(d => [d.Type, d.Key, d.Value])
    ]
  });

  return sheets;
};
