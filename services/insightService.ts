import { GoogleGenAI, Type } from "@google/genai";
import { BrainDumpItem, BudgetConfig, Wallet, Skill, ItemType } from '../types';
import { getGeminiKey } from './geminiService';
import { getFinanceItems } from '../utils/selectors';

export interface Insight {
  type: 'warning' | 'info' | 'success';
  title: string;
  message: string;
  iconType: 'finance' | 'task' | 'shopping' | 'skill';
}

export const generateAIInsights = async (
  items: BrainDumpItem[],
  budgetConfig: BudgetConfig,
  wallets: Wallet[],
  skills: Skill[]
): Promise<Insight[]> => {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    return [{
      type: 'warning',
      title: 'API Key Missing',
      message: 'Please configure your Gemini API key to get AI insights.',
      iconType: 'finance'
    }];
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Aggregate data
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();
  
  const lastMonthDate = new Date(now);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = lastMonthDate.getMonth();
  const lastYear = lastMonthDate.getFullYear();

  // Finance aggregation (Apple to Apple: up to current day)
  const getMonthExpenses = (month: number, year: number, upToDay: number) => {
    return items.filter(i => {
      if (i.type !== ItemType.FINANCE && i.type !== ItemType.SHOPPING && i.type !== ItemType.TODO) return false;
      if (i.status !== 'done') return false;
      const d = new Date(i.completed_at || i.meta.date || i.created_at);
      return d.getMonth() === month && d.getFullYear() === year && d.getDate() <= upToDay && (i.meta.amount || 0) > 0 && i.meta.financeType !== 'transfer' && i.meta.financeType !== 'income';
    });
  };

  const currentMonthExpenses = getMonthExpenses(currentMonth, currentYear, currentDay);
  const lastMonthExpenses = getMonthExpenses(lastMonth, lastYear, currentDay);

  const sumAmount = (arr: BrainDumpItem[]) => arr.reduce((sum, item) => sum + (item.meta.amount || 0), 0);
  const currentTotalExpense = sumAmount(currentMonthExpenses);
  const lastTotalExpense = sumAmount(lastMonthExpenses);

  const getTagBreakdown = (arr: BrainDumpItem[]) => {
    const breakdown: Record<string, { total: number, count: number, average: number }> = {};
    arr.forEach(item => {
      if (item.meta.tags) {
        item.meta.tags.forEach(tag => {
          if (!breakdown[tag]) breakdown[tag] = { total: 0, count: 0, average: 0 };
          breakdown[tag].total += (item.meta.amount || 0);
          breakdown[tag].count += 1;
        });
      }
    });
    Object.keys(breakdown).forEach(tag => {
      breakdown[tag].average = breakdown[tag].total / breakdown[tag].count;
    });
    return breakdown;
  };

  const currentTags = getTagBreakdown(currentMonthExpenses);
  const lastTags = getTagBreakdown(lastMonthExpenses);

  // Tasks aggregation (Apple to Apple: up to current day)
  const incompleteLastMonth = items.filter(i => 
    (i.type === ItemType.TODO || i.type === ItemType.EVENT) && 
    i.status === 'pending' && 
    i.meta.date && 
    new Date(i.meta.date).getMonth() === lastMonth &&
    new Date(i.meta.date).getFullYear() === lastYear
  ).map(i => i.content);

  const completedTasksCurrentMonth = items.filter(i => 
    (i.type === ItemType.TODO || i.type === ItemType.EVENT) && 
    i.status === 'done' && 
    i.completed_at && 
    new Date(i.completed_at).getMonth() === currentMonth &&
    new Date(i.completed_at).getFullYear() === currentYear &&
    new Date(i.completed_at).getDate() <= currentDay
  ).length;

  const completedTasksLastMonth = items.filter(i => 
    (i.type === ItemType.TODO || i.type === ItemType.EVENT) && 
    i.status === 'done' && 
    i.completed_at && 
    new Date(i.completed_at).getMonth() === lastMonth &&
    new Date(i.completed_at).getFullYear() === lastYear &&
    new Date(i.completed_at).getDate() <= currentDay
  ).length;

  // Budget and Planned Spending (Current Month)
  const { budgetMap, plannedBudgetMap, projectedExpense } = getFinanceItems(items, now, budgetConfig, '', '', '', '', '', '', '', 'newest');
  
  const budgetLimits = budgetConfig.rules.map(rule => ({
    category: rule.name,
    limit: (rule.percentage / 100) * budgetConfig.monthlyIncome,
    spent: budgetMap.get(rule.id) || 0,
    planned: plannedBudgetMap.get(rule.id) || 0
  }));

  const dataSummary = {
    currentMonth: {
      daysElapsed: currentDay,
      dailyAverageExpense: currentTotalExpense / currentDay,
      totalExpense: currentTotalExpense,
      projectedTotalExpense: currentTotalExpense + projectedExpense,
      expenseByTag: currentTags,
      completedTasks: completedTasksCurrentMonth,
      dailyAverageTasks: completedTasksCurrentMonth / currentDay
    },
    lastMonth: {
      daysElapsed: currentDay,
      dailyAverageExpense: lastTotalExpense / currentDay,
      totalExpense: lastTotalExpense,
      expenseByTag: lastTags,
      completedTasks: completedTasksLastMonth,
      dailyAverageTasks: completedTasksLastMonth / currentDay,
      incompleteTasks: incompleteLastMonth
    },
    budget: {
      totalIncome: budgetConfig.monthlyIncome,
      categories: budgetLimits
    }
  };

  const prompt = `
    You are an AI assistant analyzing a user's personal productivity and finance data.
    Compare the current month's data (up to today) with last month's data (up to the same day) and provide 3-5 deep, actionable insights.
    
    CRITICAL RULES:
    1. DO NOT write paragraphs.
    2. Keep the message extremely short, punchy, and to the point (max 1-2 short sentences).
    3. Use specific numbers and tags provided.
    4. Focus on Month-over-Month (MoM) comparisons using AVERAGES (e.g., daily average expense, average expense per transaction for a tag).
    5. Consider the budget limits and planned spending. Warn if projected expenses exceed the budget.
    6. Focus MORE on financial insights if task/skill entries are sparse. Be flexible and proportional to the data available.
    7. Highlight neglected tasks from last month if any.
    
    Data Summary (Apple-to-Apple comparison up to day ${currentDay} of the month):
    ${JSON.stringify(dataSummary, null, 2)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, description: "One of: warning, info, success" },
              title: { type: Type.STRING },
              message: { type: Type.STRING },
              iconType: { type: Type.STRING, description: "One of: finance, task, shopping, skill" }
            },
            required: ["type", "title", "message", "iconType"]
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to generate AI insights:", error);
    return [];
  }
};
